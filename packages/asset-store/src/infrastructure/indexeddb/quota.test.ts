import { describe, expect, it } from 'vitest';

import type { StorageEstimateSnapshot } from '../../application/ports.js';
import { createBrowserStorageQuota } from './quota.js';

function makeStorage(
  overrides: {
    readonly estimate?: () => Promise<StorageEstimate>;
    readonly persist?: () => Promise<boolean>;
  } = {},
): StorageManager {
  return {
    estimate: overrides.estimate ?? (async () => ({})),
    persist: overrides.persist ?? (async () => false),
    persisted: async () => false,
  } as unknown as StorageManager;
}

describe('createBrowserStorageQuota', () => {
  it('没有 storage 时返回零用量且不含配额字段', async () => {
    const quota = createBrowserStorageQuota({ storage: undefined });

    const snapshot = await quota.estimate();

    expect(snapshot).toEqual({ usageBytes: 0 });
    expect(Object.hasOwn(snapshot, 'quotaBytes')).toBe(false);
    await expect(quota.requestPersistence()).resolves.toBe(false);
  });

  it('usage 缺省按 0 处理，quota 存在时保留', async () => {
    const quota = createBrowserStorageQuota({
      storage: makeStorage({
        estimate: async () => ({ quota: 10_000 }),
      }),
    });

    await expect(quota.estimate()).resolves.toEqual({
      usageBytes: 0,
      quotaBytes: 10_000,
    });
  });

  it('quota 缺失时结果对象不含 quotaBytes 键', async () => {
    const quota = createBrowserStorageQuota({
      storage: makeStorage({
        estimate: async () => ({ usage: 512 }),
      }),
    });

    const snapshot: StorageEstimateSnapshot = await quota.estimate();

    expect(snapshot.usageBytes).toBe(512);
    expect(Object.hasOwn(snapshot, 'quotaBytes')).toBe(false);
  });

  it('estimate 失败时降级为零用量', async () => {
    const quota = createBrowserStorageQuota({
      storage: makeStorage({
        estimate: async () => {
          throw new Error('estimate failed');
        },
      }),
    });

    await expect(quota.estimate()).resolves.toEqual({ usageBytes: 0 });
  });

  it('persist 解析为 true 时返回 true', async () => {
    const quota = createBrowserStorageQuota({
      storage: makeStorage({ persist: async () => true }),
    });

    await expect(quota.requestPersistence()).resolves.toBe(true);
  });

  it('persist 被拒绝时返回 false 而不抛错', async () => {
    const quota = createBrowserStorageQuota({
      storage: makeStorage({
        persist: async () => {
          throw new Error('permission denied');
        },
      }),
    });

    await expect(quota.requestPersistence()).resolves.toBe(false);
  });

  it('persist 返回 false 时保持 false', async () => {
    const quota = createBrowserStorageQuota({
      storage: makeStorage({ persist: async () => false }),
    });

    await expect(quota.requestPersistence()).resolves.toBe(false);
  });

  it('storage 缺少 persist 能力时返回 false', async () => {
    const storage = { estimate: async () => ({}) } as unknown as StorageManager;
    const quota = createBrowserStorageQuota({ storage });

    await expect(quota.requestPersistence()).resolves.toBe(false);
  });
});
