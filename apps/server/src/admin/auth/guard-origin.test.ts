/**
 * 来源检查：管理写请求除了会话与 CSRF，还必须来自站点自身。
 * 未配置 allowedOrigin 时不做来源校验（保持既有测试与本地脚本可用）。
 */
import type { AdminSessionRepository } from '@itools/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { InMemoryAdminSessionRepository } from '../test-support/in-memory-admin-repositories.js';
import { createAdminGuard } from './guard.js';
import { hashToken } from './tokens.js';

const TOKEN = 'session-token-for-origin-test';
const CSRF = 'csrf-token-for-origin-test';
const ORIGIN = 'https://itools.test';

async function createGuardedApp(
  allowedOrigin: string | undefined,
): Promise<FastifyInstance> {
  const sessions: AdminSessionRepository = new InMemoryAdminSessionRepository();
  await sessions.create({
    sessionId: 'session-1',
    tokenHash: hashToken(TOKEN),
    createdAt: '2026-10-19T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });

  const app = Fastify({ logger: false });
  const guard = createAdminGuard({
    sessions,
    now: () => new Date('2026-10-19T00:00:00.000Z'),
    ...(allowedOrigin === undefined ? {} : { allowedOrigin }),
  });

  app.patch('/admin/tool', { preHandler: guard }, async () => ({ ok: true }));
  app.get('/admin/tool', { preHandler: guard }, async () => ({ ok: true }));
  await app.ready();
  return app;
}

function headers(origin?: string): Record<string, string> {
  return {
    cookie: `itools_admin=${TOKEN}; itools_admin_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    ...(origin === undefined ? {} : { origin }),
  };
}

describe('管理写请求来源检查', () => {
  it('来源匹配时放行', async () => {
    const app = await createGuardedApp(ORIGIN);
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/tool',
      headers: headers(ORIGIN),
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('缺少 Origin 时拒绝', async () => {
    const app = await createGuardedApp(ORIGIN);
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/tool',
      headers: headers(),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('ADMIN_CSRF_FAILED');
    await app.close();
  });

  it('跨源 Origin 时拒绝', async () => {
    const app = await createGuardedApp(ORIGIN);
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/tool',
      headers: headers('https://evil.test'),
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('读请求不受来源检查影响', async () => {
    const app = await createGuardedApp(ORIGIN);
    const response = await app.inject({
      method: 'GET',
      url: '/admin/tool',
      headers: { cookie: `itools_admin=${TOKEN}; itools_admin_csrf=${CSRF}` },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('未配置 allowedOrigin 时保持既有行为', async () => {
    const app = await createGuardedApp(undefined);
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/tool',
      headers: headers(),
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
