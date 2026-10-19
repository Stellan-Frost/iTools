import { fileURLToPath } from 'node:url';

import type { AdminSessionRepository } from '@itools/contracts';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import { migrate } from '../migrate.js';
import { withIsolatedSchema } from '../test-support/test-database.js';
import { createPgAdminSessionRepository } from './pg-admin-sessions.js';

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);
const SCHEMA = 'itools_admin_sessions_test';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const TOUCHED_AT = '2026-01-02T00:00:00.000Z';
const EXPIRES_AT = '2026-02-01T00:00:00.000Z';
const EXTENDED_AT = '2026-03-01T00:00:00.000Z';
const REVOKED_AT = '2026-01-03T00:00:00.000Z';

async function withRepository(
  work: (repo: AdminSessionRepository, pool: Pool) => Promise<void>,
): Promise<void> {
  await withIsolatedSchema(SCHEMA, async (pool) => {
    await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
    await work(createPgAdminSessionRepository({ pool }), pool);
  });
}

function inputOf(
  sessionId: string,
  expiresAt = EXPIRES_AT,
): {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
} {
  return {
    sessionId,
    tokenHash: `token-${sessionId}`,
    createdAt: CREATED_AT,
    expiresAt,
  };
}

describe('createPgAdminSessionRepository', () => {
  it('create 后可按 token 哈希查到，且不带 revokedAt 键', async () => {
    await withRepository(async (repo) => {
      await repo.create(inputOf('session-1'));

      const record = await repo.findByTokenHash('token-session-1');
      expect(record).toEqual({
        sessionId: 'session-1',
        tokenHash: 'token-session-1',
        createdAt: CREATED_AT,
        lastSeenAt: CREATED_AT,
        expiresAt: EXPIRES_AT,
      });
      expect(Object.hasOwn(record ?? {}, 'revokedAt')).toBe(false);

      await expect(
        repo.findByTokenHash('token-missing'),
      ).resolves.toBeUndefined();
    });
  });

  it('touch 同时刷新 last_seen_at 与 expires_at', async () => {
    await withRepository(async (repo) => {
      await repo.create(inputOf('session-1'));

      await repo.touch('session-1', TOUCHED_AT, EXTENDED_AT);

      const record = await repo.findByTokenHash('token-session-1');
      expect(record?.createdAt).toBe(CREATED_AT);
      expect(record?.lastSeenAt).toBe(TOUCHED_AT);
      expect(record?.expiresAt).toBe(EXTENDED_AT);
    });
  });

  it('revoke 后带 revokedAt，且 touch 不再生效', async () => {
    await withRepository(async (repo) => {
      await repo.create(inputOf('session-1'));

      await repo.revoke('session-1', REVOKED_AT);
      await repo.touch('session-1', TOUCHED_AT, EXTENDED_AT);

      const record = await repo.findByTokenHash('token-session-1');
      expect(record?.revokedAt).toBe(REVOKED_AT);
      expect(record?.lastSeenAt).toBe(CREATED_AT);
      expect(record?.expiresAt).toBe(EXPIRES_AT);
    });
  });

  it('重复 revoke 幂等：保留首次撤销时间', async () => {
    await withRepository(async (repo) => {
      await repo.create(inputOf('session-1'));

      await repo.revoke('session-1', REVOKED_AT);
      await repo.revoke('session-1', '2026-05-01T00:00:00.000Z');

      const record = await repo.findByTokenHash('token-session-1');
      expect(record?.revokedAt).toBe(REVOKED_AT);
    });
  });

  it('revokeAll 只撤销未撤销会话并返回数量', async () => {
    await withRepository(async (repo) => {
      await repo.create(inputOf('session-1'));
      await repo.create(inputOf('session-2'));
      await repo.create(inputOf('session-3'));
      await repo.revoke('session-3', REVOKED_AT);

      await expect(repo.revokeAll(EXTENDED_AT)).resolves.toBe(2);

      const first = await repo.findByTokenHash('token-session-1');
      const second = await repo.findByTokenHash('token-session-2');
      const third = await repo.findByTokenHash('token-session-3');
      expect(first?.revokedAt).toBe(EXTENDED_AT);
      expect(second?.revokedAt).toBe(EXTENDED_AT);
      expect(third?.revokedAt).toBe(REVOKED_AT);

      await expect(repo.revokeAll(EXTENDED_AT)).resolves.toBe(0);
    });
  });

  it('deleteExpired 删除已过期会话，保留未过期会话', async () => {
    await withRepository(async (repo) => {
      await repo.create(inputOf('expired', '2026-01-15T00:00:00.000Z'));
      await repo.create(inputOf('alive', '2026-06-01T00:00:00.000Z'));

      await expect(
        repo.deleteExpired('2026-03-01T00:00:00.000Z'),
      ).resolves.toBe(1);

      await expect(
        repo.findByTokenHash('token-expired'),
      ).resolves.toBeUndefined();
      const alive = await repo.findByTokenHash('token-alive');
      expect(alive?.sessionId).toBe('alive');
    });
  });
});
