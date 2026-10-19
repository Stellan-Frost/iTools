/**
 * 管理接口守卫：校验会话 Cookie，非安全方法再校验 CSRF 双提交。
 * 失败直接写 401/403 响应；成功时不装饰 request，交由路由自行取用。
 */
import { randomUUID } from 'node:crypto';

import { AdminErrorCode } from '@itools/contracts';
import type { AdminSessionRepository } from '@itools/contracts';
import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';

import { sendAdminError } from '../http.js';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_SESSION_COOKIE,
} from '../types.js';
import { parseCookies } from './cookies.js';
import { isValidCsrf } from './csrf.js';
import type { SessionService } from './session-service.js';
import { createSessionService } from './session-service.js';
import { createSessionToken } from './tokens.js';

export interface AdminGuardDeps {
  readonly sessions: AdminSessionRepository;
  readonly now: () => Date;
  /** 提供时，非 GET/HEAD 请求必须带匹配的 Origin（来源检查）。 */
  readonly allowedOrigin?: string;
}

export function createAdminGuard(deps: AdminGuardDeps): preHandlerHookHandler {
  const sessions = createSessionService({
    sessions: deps.sessions,
    now: deps.now,
    createSessionId: () => randomUUID(),
    createToken: createSessionToken,
  });

  return (request, reply, done) => {
    void authenticate(request, reply, sessions, deps.allowedOrigin).then(
      (handled) => {
        if (!handled) {
          done();
        }
      },
      (error: unknown) => {
        done(
          error instanceof Error
            ? error
            : new Error('Admin authentication failed.'),
        );
      },
    );
  };
}

/** 返回 true 表示已写出响应，守卫链路到此为止。 */
async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
  sessions: SessionService,
  allowedOrigin: string | undefined,
): Promise<boolean> {
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (token === undefined || token.length === 0) {
    sendAdminError(reply, request.id, AdminErrorCode.notAuthenticated);
    return true;
  }

  const resolved = await sessions.resolve(token);
  if (resolved === undefined) {
    sendAdminError(reply, request.id, AdminErrorCode.notAuthenticated);
    return true;
  }

  if (isUnsafeMethod(request.method)) {
    const headerValue = readHeader(request.headers[ADMIN_CSRF_HEADER]);
    if (!isValidCsrf(headerValue, cookies[ADMIN_CSRF_COOKIE])) {
      sendAdminError(reply, request.id, AdminErrorCode.csrfFailed, 403);
      return true;
    }

    // 来源检查：CSRF token 之外再确认请求来自站点自身，挡住跨源构造的写请求。
    if (allowedOrigin !== undefined) {
      const origin = readHeader(request.headers.origin);
      if (origin !== allowedOrigin) {
        sendAdminError(reply, request.id, AdminErrorCode.csrfFailed, 403);
        return true;
      }
    }
  }

  return false;
}

function isUnsafeMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
