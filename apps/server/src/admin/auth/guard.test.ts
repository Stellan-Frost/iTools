import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryAdminSessionRepository } from '../test-support/in-memory-admin-repositories.js';
import { createAdminGuard } from './guard.js';
import { createSessionService } from './session-service.js';

const START = '2026-01-01T00:00:00.000Z';

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

interface GuardHarness {
  readonly app: FastifyInstance;
  readonly clock: Clock;
  readonly sessions: InMemoryAdminSessionRepository;
  issue(): Promise<{ token: string; sessionId: string }>;
}

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function createHarness(): GuardHarness {
  const clock = createClock(START);
  const sessions = new InMemoryAdminSessionRepository();
  let sessionSequence = 0;
  let tokenSequence = 0;

  const service = createSessionService({
    sessions,
    now: clock.now,
    createSessionId: () => `session-${(sessionSequence += 1)}`,
    createToken: () => `token-${(tokenSequence += 1)}`,
  });

  const app = Fastify({ logger: false });
  const guard = createAdminGuard({ sessions, now: clock.now });
  app.get('/guarded', { preHandler: guard }, async () => ({ ok: true }));
  app.post('/guarded', { preHandler: guard }, async () => ({ ok: true }));
  openApps.push(app);

  return {
    app,
    clock,
    sessions,
    issue: async () => {
      const issued = await service.issue();
      return { token: issued.token, sessionId: issued.sessionId };
    },
  };
}

describe('createAdminGuard', () => {
  it('无 Cookie 返回 401', async () => {
    const { app } = createHarness();

    const response = await app.inject({ method: 'GET', url: '/guarded' });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_NOT_AUTHENTICATED',
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('未知令牌返回 401', async () => {
    const { app } = createHarness();

    const response = await app.inject({
      method: 'GET',
      url: '/guarded',
      headers: { cookie: 'itools_admin=not-a-session' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('有效 GET 通过且滑动续期', async () => {
    const { app, clock, sessions, issue } = createHarness();
    const { token, sessionId } = await issue();

    clock.advance(1_000);
    const response = await app.inject({
      method: 'GET',
      url: '/guarded',
      headers: { cookie: `itools_admin=${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(sessions.sessions.get(sessionId)?.lastSeenAt).toBe(
      new Date(Date.parse(START) + 1_000).toISOString(),
    );
  });

  it('有效 POST 缺少 CSRF 头返回 403', async () => {
    const { app, issue } = createHarness();
    const { token } = await issue();

    const response = await app.inject({
      method: 'POST',
      url: '/guarded',
      headers: {
        cookie: `itools_admin=${token}; itools_admin_csrf=csrf-token`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('ADMIN_CSRF_FAILED');
  });

  it('CSRF 头与 Cookie 不一致返回 403', async () => {
    const { app, issue } = createHarness();
    const { token } = await issue();

    const response = await app.inject({
      method: 'POST',
      url: '/guarded',
      headers: {
        cookie: `itools_admin=${token}; itools_admin_csrf=csrf-token`,
        'x-csrf-token': 'other-token',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('CSRF 正确时 POST 通过', async () => {
    const { app, issue } = createHarness();
    const { token } = await issue();

    const response = await app.inject({
      method: 'POST',
      url: '/guarded',
      headers: {
        cookie: `itools_admin=${token}; itools_admin_csrf=csrf-token`,
        'x-csrf-token': 'csrf-token',
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('会话被撤销后返回 401', async () => {
    const { app, sessions, issue } = createHarness();
    const { token, sessionId } = await issue();
    await sessions.revoke(sessionId, START);

    const response = await app.inject({
      method: 'GET',
      url: '/guarded',
      headers: { cookie: `itools_admin=${token}` },
    });

    expect(response.statusCode).toBe(401);
  });
});
