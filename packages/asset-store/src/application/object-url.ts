/**
 * Object URL 生命周期：按 Blob 实例引用计数，避免同一内容重复创建 URL，
 * 也避免多个使用方互相提前撤销。只做编排，真正的 URL 创建/撤销交给注入的工厂。
 */
import type { AcquiredObjectUrl, ObjectUrlFactory } from './ports.js';

export interface ObjectUrlRegistry {
  /** 同一 Blob 引用计数共享同一个 URL；每次调用都必须成对释放。 */
  acquire(blob: Blob): AcquiredObjectUrl;
  /** 释放全部活跃 URL；幂等，调用后注册表仍可继续使用。 */
  releaseAll(): void;
  /** 当前活跃的 URL 数量（按不同 Blob 计）。 */
  readonly activeCount: number;
}

interface RegistryEntry {
  readonly url: string;
  refCount: number;
}

export function createObjectUrlRegistry(
  factory: ObjectUrlFactory,
): ObjectUrlRegistry {
  const entries = new Map<Blob, RegistryEntry>();
  // releaseAll 之后，之前发出的句柄必须失效，避免它们误伤同一 Blob 的新 URL。
  let epoch = 0;

  function releaseEntry(blob: Blob): void {
    const entry = entries.get(blob);
    if (entry === undefined) return;
    entry.refCount -= 1;
    if (entry.refCount > 0) return;
    entries.delete(blob);
    factory.revoke(entry.url);
  }

  return {
    acquire(blob: Blob): AcquiredObjectUrl {
      const existing = entries.get(blob);
      const entry: RegistryEntry = existing ?? {
        url: factory.create(blob),
        refCount: 0,
      };
      entry.refCount += 1;
      entries.set(blob, entry);
      const acquiredEpoch = epoch;
      let released = false;
      return {
        url: entry.url,
        release(): void {
          // 句柄自身的重复释放与 releaseAll 之后的释放都必须是无操作，
          // 否则会把计数器减成负数或二次撤销 URL。
          if (released || acquiredEpoch !== epoch) return;
          released = true;
          releaseEntry(blob);
        },
      };
    },

    releaseAll(): void {
      epoch += 1;
      for (const [blob, entry] of [...entries]) {
        entries.delete(blob);
        factory.revoke(entry.url);
      }
    },

    get activeCount(): number {
      return entries.size;
    },
  };
}
