import { describe, expect, it } from 'vitest';

import {
  InMemoryAdminCredentialRepository,
  InMemoryAdminSessionRepository,
} from '../admin/test-support/in-memory-admin-repositories.js';
import { hashPassword, verifyPassword } from '../admin/auth/password.js';
import { ResetPasswordError, resetPassword } from './reset-password-core.js';

const INITIAL_PASSWORD = 'initial-admin-password';
const NEW_PASSWORD = 'replacement-password-2026';
const NOW = new Date('2026-02-03T04:05:06.789Z');
const NOW_ISO = NOW.toISOString();
const EXPIRES_AT = '2026-12-31T00:00:00.000Z';

function nowFixed(): Date {
  return new Date(NOW.getTime());
}

interface Harness {
  readonly credentials: InMemoryAdminCredentialRepository;
  readonly sessions: InMemoryAdminSessionRepository;
}

async function createHarness(sessionCount: number): Promise<Harness> {
  const credentials = new InMemoryAdminCredentialRepository();
  await credentials.create(await hashPassword(INITIAL_PASSWORD));

  const sessions = new InMemoryAdminSessionRepository();
  for (let index = 0; index < sessionCount; index += 1) {
    await sessions.create({
      sessionId: `session-${index}`,
      tokenHash: `token-hash-${index}`,
      createdAt: NOW_ISO,
      expiresAt: EXPIRES_AT,
    });
  }

  return { credentials, sessions };
}

function activeSessionCount(sessions: InMemoryAdminSessionRepository): number {
  return [...sessions.sessions.values()].filter(
    (session) => session.revokedAt === undefined,
  ).length;
}

async function readPasswordHash(
  credentials: InMemoryAdminCredentialRepository,
): Promise<string> {
  const record = await credentials.get();
  if (record === undefined) {
    throw new Error('测试前置条件缺少管理员记录');
  }
  return record.passwordHash;
}

describe('resetPassword 前置校验', () => {
  it('口令过短时抛 weak-password，且不更新口令', async () => {
    const { credentials, sessions } = await createHarness(1);
    const before = await readPasswordHash(credentials);

    const error: unknown = await resetPassword({
      credentials,
      sessions,
      password: 'short-pass1',
      now: nowFixed,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResetPasswordError);
    expect(error).toMatchObject({ code: 'weak-password' });

    expect(await readPasswordHash(credentials)).toBe(before);
    expect(activeSessionCount(sessions)).toBe(1);
  });

  it('管理员未初始化时抛 admin-not-initialized', async () => {
    const credentials = new InMemoryAdminCredentialRepository();
    const sessions = new InMemoryAdminSessionRepository();

    const attempt = resetPassword({
      credentials,
      sessions,
      password: NEW_PASSWORD,
      now: nowFixed,
    });

    await expect(attempt).rejects.toMatchObject({
      code: 'admin-not-initialized',
    });
    expect(await credentials.get()).toBeUndefined();
  });
});

describe('resetPassword 正常重置', () => {
  it('新口令可用、旧口令失效，并返回撤销数量与注入时间', async () => {
    const { credentials, sessions } = await createHarness(3);

    const result = await resetPassword({
      credentials,
      sessions,
      password: NEW_PASSWORD,
      now: nowFixed,
    });

    const record = await credentials.get();
    if (record === undefined) {
      throw new Error('重置后管理员记录不应消失');
    }

    expect(await verifyPassword(NEW_PASSWORD, record.passwordHash)).toBe(true);
    expect(await verifyPassword(INITIAL_PASSWORD, record.passwordHash)).toBe(
      false,
    );
    expect(result).toEqual({ revokedSessions: 3, updatedAt: NOW_ISO });
  });

  it('撤销数量与实际未撤销会话数一致', async () => {
    const { credentials, sessions } = await createHarness(4);
    const activeBefore = activeSessionCount(sessions);

    const result = await resetPassword({
      credentials,
      sessions,
      password: NEW_PASSWORD,
      now: nowFixed,
    });

    expect(result.revokedSessions).toBe(activeBefore);
    expect(activeSessionCount(sessions)).toBe(0);
    for (const session of sessions.sessions.values()) {
      expect(session.revokedAt).toBe(NOW_ISO);
    }
  });

  it('updatedAt 完全来自注入的 now', async () => {
    const { credentials, sessions } = await createHarness(0);
    const later = new Date('2030-07-08T09:10:11.121Z');

    const result = await resetPassword({
      credentials,
      sessions,
      password: NEW_PASSWORD,
      now: () => new Date(later.getTime()),
    });

    expect(result.updatedAt).toBe(later.toISOString());
    expect(result.revokedSessions).toBe(0);
  });
});
