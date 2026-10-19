import { describe, expect, it } from 'vitest';

import { createFixedWindowLimiter } from './rate-limit.js';

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

const WINDOW_MS = 15 * 60 * 1_000;

describe('createFixedWindowLimiter', () => {
  it('窗口内允许 maxAttempts 次，第 6 次拒绝并给出 retry-after', () => {
    const clock = createClock('2026-01-01T00:00:00.000Z');
    const limiter = createFixedWindowLimiter({
      maxAttempts: 5,
      windowMs: WINDOW_MS,
      now: clock.now,
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(limiter.consume('127.0.0.1')).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
    }

    const blocked = limiter.consume('127.0.0.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1_000);
    expect(Number.isInteger(blocked.retryAfterSeconds)).toBe(true);
  });

  it('窗口结束自动恢复，不永久锁定', () => {
    const clock = createClock('2026-01-01T00:00:00.000Z');
    const limiter = createFixedWindowLimiter({
      maxAttempts: 1,
      windowMs: WINDOW_MS,
      now: clock.now,
    });

    expect(limiter.consume('ip').allowed).toBe(true);
    expect(limiter.consume('ip').allowed).toBe(false);

    clock.advance(WINDOW_MS);
    expect(limiter.consume('ip').allowed).toBe(true);
  });

  it('retry-after 按剩余时间向上取整', () => {
    const clock = createClock('2026-01-01T00:00:00.000Z');
    const limiter = createFixedWindowLimiter({
      maxAttempts: 1,
      windowMs: WINDOW_MS,
      now: clock.now,
    });

    limiter.consume('ip');
    clock.advance(WINDOW_MS - 1_500);

    expect(limiter.consume('ip')).toEqual({
      allowed: false,
      retryAfterSeconds: 2,
    });
  });

  it('reset 清空计数', () => {
    const clock = createClock('2026-01-01T00:00:00.000Z');
    const limiter = createFixedWindowLimiter({
      maxAttempts: 1,
      windowMs: WINDOW_MS,
      now: clock.now,
    });

    expect(limiter.consume('ip').allowed).toBe(true);
    expect(limiter.consume('ip').allowed).toBe(false);

    limiter.reset('ip');
    expect(limiter.consume('ip').allowed).toBe(true);
  });

  it('不同 key 互不影响', () => {
    const clock = createClock('2026-01-01T00:00:00.000Z');
    const limiter = createFixedWindowLimiter({
      maxAttempts: 1,
      windowMs: WINDOW_MS,
      now: clock.now,
    });

    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('a').allowed).toBe(false);
    expect(limiter.consume('b').allowed).toBe(true);
  });
});
