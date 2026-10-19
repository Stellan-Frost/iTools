import { describe, expect, it } from 'vitest';

import { InMemoryAdminSessionRepository } from '../test-support/in-memory-admin-repositories.js';
import { ADMIN_SESSION_ABSOLUTE_MS, ADMIN_SESSION_IDLE_MS } from '../types.js';
import { createSessionService } from './session-service.js';
import { hashToken } from './tokens.js';

const START = '2026-01-01T00:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1_000;

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

function createHarness() {
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

  return { clock, sessions, service };
}

describe('createSessionService.issue', () => {
  it('写入哈希后的会话并返回明文令牌', async () => {
    const { sessions, service } = createHarness();

    const issued = await service.issue();

    expect(issued.token).toBe('token-1');
    expect(issued.sessionId).toBe('session-1');
    expect(issued.expiresAt).toBe(
      new Date(Date.parse(START) + ADMIN_SESSION_IDLE_MS).toISOString(),
    );
    expect(issued.lastSeenAt).toBe(START);

    const stored = sessions.sessions.get('session-1');
    expect(stored).toEqual({
      sessionId: 'session-1',
      tokenHash: hashToken('token-1'),
      createdAt: START,
      lastSeenAt: START,
      expiresAt: issued.expiresAt,
    });
    expect(JSON.stringify(stored)).not.toContain('token-1');
  });
});

describe('createSessionService.resolve', () => {
  it('有效令牌返回会话并滑动续期', async () => {
    const { clock, sessions, service } = createHarness();
    const issued = await service.issue();

    clock.advance(DAY_MS);
    const resolved = await service.resolve(issued.token);

    const expectedExpiry = new Date(
      Date.parse(START) + DAY_MS + ADMIN_SESSION_IDLE_MS,
    ).toISOString();
    expect(resolved?.expiresAt).toBe(expectedExpiry);
    expect(resolved?.session.lastSeenAt).toBe(
      new Date(Date.parse(START) + DAY_MS).toISOString(),
    );
    expect(sessions.sessions.get(issued.sessionId)?.expiresAt).toBe(
      expectedExpiry,
    );
    expect(sessions.sessions.get(issued.sessionId)?.lastSeenAt).toBe(
      new Date(Date.parse(START) + DAY_MS).toISOString(),
    );
  });

  it('滑动续期不会突破 30 天绝对上限', async () => {
    const { clock, service } = createHarness();
    const issued = await service.issue();
    const absoluteDeadline = new Date(
      Date.parse(START) + ADMIN_SESSION_ABSOLUTE_MS,
    ).toISOString();

    clock.advance(6 * DAY_MS);
    await service.resolve(issued.token);
    clock.advance(6 * DAY_MS);
    await service.resolve(issued.token);
    clock.advance(6 * DAY_MS);
    await service.resolve(issued.token);

    // 第 24 天：空闲续期本应到第 31 天，被绝对上限截到第 30 天。
    clock.advance(6 * DAY_MS);
    const capped = await service.resolve(issued.token);
    expect(capped?.expiresAt).toBe(absoluteDeadline);

    clock.advance(5 * DAY_MS);
    const stillCapped = await service.resolve(issued.token);
    expect(stillCapped?.expiresAt).toBe(absoluteDeadline);

    clock.advance(DAY_MS + 1);
    await expect(service.resolve(issued.token)).resolves.toBeUndefined();
  });

  it('超过空闲期限返回 undefined', async () => {
    const { clock, service } = createHarness();
    const issued = await service.issue();

    clock.advance(ADMIN_SESSION_IDLE_MS + 1);

    await expect(service.resolve(issued.token)).resolves.toBeUndefined();
  });

  it('未知令牌返回 undefined', async () => {
    const { service } = createHarness();

    await expect(service.resolve('no-such-token')).resolves.toBeUndefined();
  });

  it('已撤销会话返回 undefined', async () => {
    const { service } = createHarness();
    const issued = await service.issue();

    await service.revoke(issued.token);

    await expect(service.resolve(issued.token)).resolves.toBeUndefined();
  });
});

describe('createSessionService.revoke', () => {
  it('撤销后记录 revokedAt，且重复撤销幂等', async () => {
    const { clock, sessions, service } = createHarness();
    const issued = await service.issue();

    clock.advance(1_000);
    await service.revoke(issued.token);
    await service.revoke(issued.token);

    expect(sessions.sessions.get(issued.sessionId)?.revokedAt).toBe(
      new Date(Date.parse(START) + 1_000).toISOString(),
    );
  });

  it('未知令牌静默返回', async () => {
    const { service } = createHarness();

    await expect(service.revoke('missing')).resolves.toBeUndefined();
  });
});
