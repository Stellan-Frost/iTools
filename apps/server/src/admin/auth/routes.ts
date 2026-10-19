/**
 * 管理认证路由：初始化、登录、会话查询与登出。
 * 口令、令牌、Cookie 值一律不写日志；所有响应 `cache-control: no-store`。
 */
import {
  AdminErrorCode,
  AdminLoginRequestSchema,
  AdminSetupRequestSchema,
} from '@itools/contracts';
import type {
  AdminCredentialRepository,
  AdminLoginRequest,
  AdminSetupRequest,
} from '@itools/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { sendAdminError } from '../http.js';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_LOGIN_RATE_LIMIT,
  ADMIN_SESSION_COOKIE,
} from '../types.js';
import type { AdminAuthDeps, RegisterAdminAuthRoutes } from '../types.js';
import { buildClearCookie, buildSetCookie, parseCookies } from './cookies.js';
import { createCsrfToken } from './csrf.js';
import { hashPassword, verifyPassword } from './password.js';
import { createFixedWindowLimiter } from './rate-limit.js';
import type { SessionService } from './session-service.js';
import { createSessionService } from './session-service.js';
import { timingSafeEqualString } from './tokens.js';

const SETUP_PATH = '/api/v1/admin/setup';
const SESSION_PATH = '/api/v1/admin/session';
const NO_STORE = 'no-store';

export const registerAdminAuthRoutes: RegisterAdminAuthRoutes = (app, deps) => {
  const sessions = createSessionService({
    sessions: deps.sessions,
    now: deps.now,
    createSessionId: deps.createSessionId,
    createToken: deps.createToken,
  });
  const loginLimiter = createFixedWindowLimiter({
    maxAttempts: ADMIN_LOGIN_RATE_LIMIT.maxAttempts,
    windowMs: ADMIN_LOGIN_RATE_LIMIT.windowMs,
    now: deps.now,
  });

  registerSetup(app, deps, sessions);
  registerSetupStatus(app, deps);
  registerLogin(app, deps, sessions, loginLimiter);
  registerSessionRead(app, deps, sessions);
  registerSessionDelete(app, deps, sessions);
};

function registerSetup(
  app: FastifyInstance,
  deps: AdminAuthDeps,
  sessions: SessionService,
): void {
  const setupToken = deps.setupToken;

  app.post<{ Body: AdminSetupRequest }>(
    SETUP_PATH,
    {
      attachValidation: true,
      schema: { body: AdminSetupRequestSchema },
    },
    async (request, reply) => {
      reply.header('cache-control', NO_STORE);

      if (request.validationError !== undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.invalidRequest);
      }
      if (setupToken === undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.notInitialized);
      }

      const existing = await deps.credentials.get();
      if (existing !== undefined) {
        return sendAdminError(
          reply,
          request.id,
          AdminErrorCode.alreadyInitialized,
        );
      }

      if (!timingSafeEqualString(request.body.token, setupToken)) {
        return sendAdminError(
          reply,
          request.id,
          AdminErrorCode.invalidCredentials,
        );
      }

      const created = await createCredential(
        deps.credentials,
        request.body.password,
      );
      if (!created) {
        return sendAdminError(
          reply,
          request.id,
          AdminErrorCode.alreadyInitialized,
        );
      }

      const issued = await sessions.issue();
      applySessionCookies(reply, deps, issued.token, issued.expiresAt);

      return reply.code(201).send({
        data: { expiresAt: issued.expiresAt, lastSeenAt: issued.lastSeenAt },
      });
    },
  );
}

function registerLogin(
  app: FastifyInstance,
  deps: AdminAuthDeps,
  sessions: SessionService,
  loginLimiter: ReturnType<typeof createFixedWindowLimiter>,
): void {
  app.post<{ Body: AdminLoginRequest }>(
    SESSION_PATH,
    {
      attachValidation: true,
      schema: { body: AdminLoginRequestSchema },
    },
    async (request, reply) => {
      reply.header('cache-control', NO_STORE);

      if (request.validationError !== undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.invalidRequest);
      }

      const decision = loginLimiter.consume(request.ip);
      if (!decision.allowed) {
        reply.header('retry-after', String(decision.retryAfterSeconds));
        return sendAdminError(reply, request.id, AdminErrorCode.rateLimited);
      }

      const credential = await deps.credentials.get();
      if (credential === undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.notInitialized);
      }

      const valid = await verifyPassword(
        request.body.password,
        credential.passwordHash,
      );
      if (!valid) {
        return sendAdminError(
          reply,
          request.id,
          AdminErrorCode.invalidCredentials,
        );
      }

      loginLimiter.reset(request.ip);
      await rotatePreviousSession(request.headers.cookie, sessions);

      const issued = await sessions.issue();
      applySessionCookies(reply, deps, issued.token, issued.expiresAt);

      return reply.send({
        data: { expiresAt: issued.expiresAt, lastSeenAt: issued.lastSeenAt },
      });
    },
  );
}

function registerSessionRead(
  app: FastifyInstance,
  deps: AdminAuthDeps,
  sessions: SessionService,
): void {
  app.get(SESSION_PATH, async (request, reply) => {
    reply.header('cache-control', NO_STORE);

    const token = readSessionToken(request.headers.cookie);
    if (token === undefined) {
      return sendAdminError(reply, request.id, AdminErrorCode.notAuthenticated);
    }

    const resolved = await sessions.resolve(token);
    if (resolved === undefined) {
      return sendAdminError(reply, request.id, AdminErrorCode.notAuthenticated);
    }

    return reply.send({
      data: {
        expiresAt: resolved.expiresAt,
        lastSeenAt: resolved.session.lastSeenAt,
      },
    });
  });
}

/**
 * 初始化入口是否可用：前端据此决定展示初始化表单还是登录表单。
 * 只暴露布尔值，不泄露令牌配置细节。
 */
function registerSetupStatus(app: FastifyInstance, deps: AdminAuthDeps): void {
  app.get(SETUP_PATH, async (_request, reply) => {
    reply.header('cache-control', NO_STORE);
    const credentials = await deps.credentials.get();
    const available =
      deps.setupToken !== undefined && credentials === undefined;
    return reply.send({ data: { available } });
  });
}

function registerSessionDelete(
  app: FastifyInstance,
  deps: AdminAuthDeps,
  sessions: SessionService,
): void {
  app.delete(SESSION_PATH, async (request, reply) => {
    reply.header('cache-control', NO_STORE);

    const token = readSessionToken(request.headers.cookie);
    if (token !== undefined) {
      await sessions.revoke(token);
    }

    clearSessionCookies(reply, deps);
    return reply.code(204).send();
  });
}

/** 已初始化判定以仓储为准；并发创建失败同样按 409 处理。 */
async function createCredential(
  credentials: AdminCredentialRepository,
  password: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return credentials.create(passwordHash);
}

/** 登录即轮换：客户端带来的旧会话作废，避免固定会话继续有效。 */
async function rotatePreviousSession(
  cookieHeader: string | undefined,
  sessions: SessionService,
): Promise<void> {
  const previous = readSessionToken(cookieHeader);
  if (previous !== undefined) {
    await sessions.revoke(previous);
  }
}

function readSessionToken(
  cookieHeader: string | undefined,
): string | undefined {
  const token = parseCookies(cookieHeader)[ADMIN_SESSION_COOKIE];
  return token === undefined || token.length === 0 ? undefined : token;
}

function applySessionCookies(
  reply: FastifyReply,
  deps: AdminAuthDeps,
  token: string,
  expiresAt: string,
): void {
  const maxAgeSeconds = maxAgeSecondsUntil(deps.now(), expiresAt);
  reply.header('set-cookie', [
    buildSetCookie(ADMIN_SESSION_COOKIE, token, {
      maxAgeSeconds,
      httpOnly: true,
      secure: deps.secureCookies,
    }),
    buildSetCookie(ADMIN_CSRF_COOKIE, createCsrfToken(), {
      maxAgeSeconds,
      httpOnly: false,
      secure: deps.secureCookies,
    }),
  ]);
}

function clearSessionCookies(reply: FastifyReply, deps: AdminAuthDeps): void {
  reply.header('set-cookie', [
    buildClearCookie(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      secure: deps.secureCookies,
    }),
    buildClearCookie(ADMIN_CSRF_COOKIE, {
      httpOnly: false,
      secure: deps.secureCookies,
    }),
  ]);
}

function maxAgeSecondsUntil(now: Date, expiresAt: string): number {
  const remainingMs = Date.parse(expiresAt) - now.getTime();
  return Math.max(0, Math.floor(remainingMs / 1_000));
}
