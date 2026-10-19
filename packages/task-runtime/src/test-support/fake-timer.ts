/**
 * 定时器测试替身：手动推进超时，避免真实等待。
 */
import type { TimerApi } from '../infrastructure/timer.js';

export interface FakeTimerHandle {
  readonly delayMs: number;
  readonly callback: () => void;
  isCleared: boolean;
}

export class FakeTimer implements TimerApi {
  readonly handles: FakeTimerHandle[] = [];

  set(delayMs: number, callback: () => void): unknown {
    const handle: FakeTimerHandle = { delayMs, callback, isCleared: false };
    this.handles.push(handle);
    return handle;
  }

  clear(handle: unknown): void {
    const target = handle as FakeTimerHandle | undefined;
    if (target !== undefined) target.isCleared = true;
  }

  /** 触发所有未被清除的定时器，模拟“取消确认超时”。 */
  firePending(): void {
    for (const handle of [...this.handles]) {
      if (handle.isCleared) continue;
      handle.isCleared = true;
      handle.callback();
    }
  }

  get pendingCount(): number {
    return this.handles.filter((handle) => !handle.isCleared).length;
  }
}

/** 排空微任务队列，用于等待调度器的异步收尾（不依赖真实定时器）。 */
export async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}
