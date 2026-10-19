/**
 * 固定窗口限流（内存）：窗口内最多 maxAttempts 次，窗口结束自动恢复，
 * 不做永久锁定、不做渐进延迟。
 */

export interface FixedWindowLimiterOptions {
  readonly maxAttempts: number;
  readonly windowMs: number;
  readonly now: () => Date;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface FixedWindowLimiter {
  consume(key: string): RateLimitDecision;
  reset(key: string): void;
}

interface Window {
  count: number;
  readonly windowStartMs: number;
}

/** 防止恶意 IP 撑爆内存：超过阈值时清掉已过窗的键。 */
const PRUNE_THRESHOLD = 1_024;

export function createFixedWindowLimiter(
  options: FixedWindowLimiterOptions,
): FixedWindowLimiter {
  const windows = new Map<string, Window>();
  const { maxAttempts, windowMs, now } = options;

  function consume(key: string): RateLimitDecision {
    const nowMs = now().getTime();
    const current = windows.get(key);

    if (current === undefined || nowMs - current.windowStartMs >= windowMs) {
      if (windows.size >= PRUNE_THRESHOLD) {
        prune(nowMs);
      }
      windows.set(key, { count: 1, windowStartMs: nowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= maxAttempts) {
      const remainingMs = current.windowStartMs + windowMs - nowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1_000)),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  function prune(nowMs: number): void {
    for (const [key, window] of windows) {
      if (nowMs - window.windowStartMs >= windowMs) {
        windows.delete(key);
      }
    }
  }

  function reset(key: string): void {
    windows.delete(key);
  }

  return { consume, reset };
}
