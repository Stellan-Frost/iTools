import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import {
  InMemoryAdminCredentialRepository,
  InMemoryAdminSessionRepository,
} from '../test-support/in-memory-admin-repositories.js';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_IDLE_MS,
} from '../types.js';
import { hashPassword } from './password.js';
import { registerAdminAuthRoutes } from './routes.js';

const START = '2026-01-01T00:00:00.000Z';
const SETUP_PATH = '/api/v1/admin/setup';
const SESSION_PATH = '/api/v1/admin/session';
const SETUP_TOKEN = 'setup-token-value';
const PASSWORD = 'correct horse battery staple';

interface Clock {
  now: () => Date;
  advance: (ms: number) => void;
}

function createClock(start: string): Clock {
  let current = new Date(start);
  return {
    now: () => current,
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

interface HarnessOptions {
  readonly setupToken?: string;
  readonly secureCookies?: boolean;
  readonly initialized?: boolean;
}

interface Harness {
  readonly app: FastifyInstance;
  readonly credentials: InMemoryAdminCredentialRepository;
  readonly sessions: InMemoryAdminSessionRepository;
  readonly clock: Clock;
}

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const clock = createClock(START);
  const credentials = new InMemoryAdminCredentialRepository();
  const sessions = new InMemoryAdminSessionRepository();

  if (options.initialized === true) {
    await credentials.create(await hashPassword(PASSWORD));
  }

  let sessionSequence = 0;
  let tokenSequence = 0;

  const app = Fastify({ logger: false });
  registerAdminAuthRoutes(app, {
    credentials,
    sessions,
    setupToken: options.setupToken,
    now: clock.now,
    secureCookies: options.secureCookies ?? false,
    createSessionId: () => `session-${(sessionSequence += 1)}`,
    createToken: () => `token-${(tokenSequence += 1)}`,
  });
  openApps.push(app);

  return { app, credentials, sessions, clock };
}

function headerValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function cookieValue(
  cookies: readonly string[],
  name: string,
): string | undefined {
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (match === undefined) {
    return undefined;
  }
  const pair = match.split(';')[0];
  return pair === undefined ? undefined : pair.slice(name.length + 1);
}

function authCookieHeader(cookies: readonly string[]): string {
  const session = cookieValue(cookies, ADMIN_SESSION_COOKIE) ?? '';
  const csrf = cookieValue(cookies, ADMIN_CSRF_COOKIE) ?? '';
  return `${ADMIN_SESSION_COOKIE}=${session}; ${ADMIN_CSRF_COOKIE}=${csrf}`;
}

async function login(
  app: FastifyInstance,
  password: string,
  cookieHeader?: string,
) {
  const base = {
    method: 'POST' as const,
    url: SESSION_PATH,
    payload: { password },
  };
  return app.inject(
    cookieHeader === undefined
      ? base
      : { ...base, headers: { cookie: cookieHeader } },
  );
}

describe('POST /api/v1/admin/setup', () => {
  it('未配置初始化令牌时返回 404', async () => {
    const { app, credentials } = await createHarness();

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_NOT_INITIALIZED',
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toBeUndefined();
    await expect(credentials.get()).resolves.toBeUndefined();
  });

  it('已初始化时返回 409', async () => {
    const { app } = await createHarness({
      setupToken: SETUP_TOKEN,
      initialized: true,
    });

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_ALREADY_INITIALIZED',
    );
  });

  it('令牌错误时返回 401', async () => {
    const { app, credentials } = await createHarness({
      setupToken: SETUP_TOKEN,
    });

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: 'wrong-token', password: PASSWORD },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_INVALID_CREDENTIALS',
    );
    await expect(credentials.get()).resolves.toBeUndefined();
  });

  it('请求体不合法时返回 400', async () => {
    const { app } = await createHarness({ setupToken: SETUP_TOKEN });

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: 'too-short' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_INVALID_REQUEST',
    );
  });

  it('成功初始化返回 201 并写入两个 Cookie', async () => {
    const { app, credentials, sessions } = await createHarness({
      setupToken: SETUP_TOKEN,
    });

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      data: { expiresAt: string; lastSeenAt: string };
    }>();
    expect(body.data.lastSeenAt).toBe(START);
    expect(body.data.expiresAt).toBe(
      new Date(Date.parse(START) + ADMIN_SESSION_IDLE_MS).toISOString(),
    );

    const cookies = headerValues(response.headers['set-cookie']);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toBe(
      `${ADMIN_SESSION_COOKIE}=token-1; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict`,
    );
    expect(cookies[1]).toContain(`${ADMIN_CSRF_COOKIE}=`);
    expect(cookies[1]).not.toContain('HttpOnly');
    expect(cookies[1]).toContain('Max-Age=604800');
    expect(response.headers['cache-control']).toBe('no-store');

    await expect(credentials.get()).resolves.toBeDefined();
    expect(sessions.sessions.size).toBe(1);
  });

  it('secureCookies 为 true 时附加 Secure', async () => {
    const { app } = await createHarness({
      setupToken: SETUP_TOKEN,
      secureCookies: true,
    });

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    const cookies = headerValues(response.headers['set-cookie']);
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toContain('; Secure');
    }
  });

  it('初始化后再次调用返回 409', async () => {
    const { app } = await createHarness({ setupToken: SETUP_TOKEN });
    await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    const response = await app.inject({
      method: 'POST',
      url: SETUP_PATH,
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    expect(response.statusCode).toBe(409);
  });
});

describe('POST /api/v1/admin/session', () => {
  it('未初始化时返回 404', async () => {
    const { app } = await createHarness();

    const response = await login(app, PASSWORD);

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_NOT_INITIALIZED',
    );
  });

  it('口令错误时返回 401 且不设置 Cookie', async () => {
    const { app } = await createHarness({ initialized: true });

    const response = await login(app, 'wrong-password');

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_INVALID_CREDENTIALS',
    );
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('请求体不合法时返回 400', async () => {
    const { app } = await createHarness({ initialized: true });

    const response = await app.inject({
      method: 'POST',
      url: SESSION_PATH,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_INVALID_REQUEST',
    );
  });

  it('登录成功返回 200 并签发会话', async () => {
    const { app, sessions } = await createHarness({ initialized: true });

    const response = await login(app, PASSWORD);

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: { expiresAt: string; lastSeenAt: string };
    }>();
    expect(body.data.lastSeenAt).toBe(START);

    const cookies = headerValues(response.headers['set-cookie']);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(`${ADMIN_SESSION_COOKIE}=token-1`);
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[1]).not.toContain('HttpOnly');
    expect(sessions.sessions.size).toBe(1);
  });

  it('第 6 次尝试返回 429 并带 retry-after', async () => {
    const { app } = await createHarness({ initialized: true });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(app, 'wrong-password');
      expect(response.statusCode).toBe(401);
    }

    const blocked = await login(app, 'wrong-password');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('ADMIN_RATE_LIMITED');
    expect(blocked.headers['cache-control']).toBe('no-store');

    const retryAfter = Number(blocked.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);

    // 超限后即使口令正确也被拒绝。
    const stillBlocked = await login(app, PASSWORD);
    expect(stillBlocked.statusCode).toBe(429);
  });

  it('限流按客户端 IP 隔离', async () => {
    const { app } = await createHarness({ initialized: true });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await login(app, 'wrong-password');
    }
    expect((await login(app, 'wrong-password')).statusCode).toBe(429);

    const otherClient = await app.inject({
      method: 'POST',
      url: SESSION_PATH,
      payload: { password: 'wrong-password' },
      remoteAddress: '10.0.0.9',
    });

    expect(otherClient.statusCode).toBe(401);
  });

  it('成功登录后重置失败计数', async () => {
    const { app } = await createHarness({ initialized: true });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect((await login(app, 'wrong-password')).statusCode).toBe(401);
    }
    expect((await login(app, PASSWORD)).statusCode).toBe(200);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await login(app, 'wrong-password')).statusCode).toBe(401);
    }
    expect((await login(app, 'wrong-password')).statusCode).toBe(429);
  });

  it('再次登录轮换旧会话', async () => {
    const { app, sessions } = await createHarness({ initialized: true });

    const first = await login(app, PASSWORD);
    const firstCookies = headerValues(first.headers['set-cookie']);
    const second = await login(app, PASSWORD, authCookieHeader(firstCookies));

    expect(second.statusCode).toBe(200);
    const secondCookies = headerValues(second.headers['set-cookie']);
    expect(cookieValue(secondCookies, ADMIN_SESSION_COOKIE)).toBe('token-2');
    expect(sessions.sessions.get('session-1')?.revokedAt).toBeDefined();
  });
});

describe('GET /api/v1/admin/session', () => {
  it('有效会话返回 200 与会话信息', async () => {
    const { app } = await createHarness({ initialized: true });
    const signedIn = await login(app, PASSWORD);
    const cookies = headerValues(signedIn.headers['set-cookie']);

    const response = await app.inject({
      method: 'GET',
      url: SESSION_PATH,
      headers: { cookie: authCookieHeader(cookies) },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: { expiresAt: string; lastSeenAt: string };
    }>();
    expect(body.data.lastSeenAt).toBe(START);
    expect(body.data.expiresAt).toBe(
      new Date(Date.parse(START) + ADMIN_SESSION_IDLE_MS).toISOString(),
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('无 Cookie 返回 401', async () => {
    const { app } = await createHarness({ initialized: true });

    const response = await app.inject({ method: 'GET', url: SESSION_PATH });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_NOT_AUTHENTICATED',
    );
  });

  it('无效 Cookie 返回 401', async () => {
    const { app } = await createHarness({ initialized: true });

    const response = await app.inject({
      method: 'GET',
      url: SESSION_PATH,
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=unknown` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('DELETE /api/v1/admin/session', () => {
  it('撤销会话、清除两个 Cookie 并返回 204', async () => {
    const { app, sessions } = await createHarness({ initialized: true });
    const signedIn = await login(app, PASSWORD);
    const cookies = headerValues(signedIn.headers['set-cookie']);

    const response = await app.inject({
      method: 'DELETE',
      url: SESSION_PATH,
      headers: { cookie: authCookieHeader(cookies) },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers['cache-control']).toBe('no-store');

    const cleared = headerValues(response.headers['set-cookie']);
    expect(cleared).toHaveLength(2);
    expect(cleared[0]).toContain(`${ADMIN_SESSION_COOKIE}=;`);
    expect(cleared[0]).toContain('Max-Age=0');
    expect(cleared[1]).toContain(`${ADMIN_CSRF_COOKIE}=;`);
    expect(cleared[1]).toContain('Max-Age=0');
    expect(sessions.sessions.get('session-1')?.revokedAt).toBeDefined();

    const afterRevoke = await app.inject({
      method: 'GET',
      url: SESSION_PATH,
      headers: { cookie: authCookieHeader(cookies) },
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('重复调用仍返回 204', async () => {
    const { app } = await createHarness({ initialized: true });
    const signedIn = await login(app, PASSWORD);
    const cookieHeader = authCookieHeader(
      headerValues(signedIn.headers['set-cookie']),
    );

    const first = await app.inject({
      method: 'DELETE',
      url: SESSION_PATH,
      headers: { cookie: cookieHeader },
    });
    const second = await app.inject({
      method: 'DELETE',
      url: SESSION_PATH,
      headers: { cookie: cookieHeader },
    });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
  });

  it('无 Cookie 也返回 204 并清除 Cookie', async () => {
    const { app } = await createHarness({ initialized: true });

    const response = await app.inject({
      method: 'DELETE',
      url: SESSION_PATH,
    });

    expect(response.statusCode).toBe(204);
    expect(headerValues(response.headers['set-cookie'])).toHaveLength(2);
  });
});
