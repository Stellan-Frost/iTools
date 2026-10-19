/**
 * 浏览器存储配额适配：把 `StorageManager` 包装成端口需要的形状。
 * 配额信息只用于提示与预警，任何缺失或失败都不得阻断资产写入。
 */
import type {
  StorageEstimateSnapshot,
  StorageQuota,
} from '../../application/ports.js';

export interface BrowserStorageQuotaOptions {
  /** 缺省使用 globalThis.navigator?.storage；测试可注入。 */
  readonly storage: StorageManager | undefined;
}

function resolveStorage(
  storage: StorageManager | undefined,
): StorageManager | undefined {
  if (storage !== undefined) return storage;
  return globalThis.navigator?.storage;
}

function toByteCount(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

export function createBrowserStorageQuota(
  options: BrowserStorageQuotaOptions,
): StorageQuota {
  const storage = resolveStorage(options.storage);

  return {
    async estimate(): Promise<StorageEstimateSnapshot> {
      if (storage === undefined) {
        return { usageBytes: 0 };
      }

      let estimate: StorageEstimate;
      try {
        estimate = await storage.estimate();
      } catch {
        // 配额查询失败不应影响主流程；按“未知用量”处理。
        return { usageBytes: 0 };
      }

      const usageBytes = toByteCount(estimate.usage) ?? 0;
      const quotaBytes = toByteCount(estimate.quota);

      // exactOptionalPropertyTypes 下不能显式写入 undefined，只能按需构造。
      return quotaBytes === undefined
        ? { usageBytes }
        : { usageBytes, quotaBytes };
    },

    async requestPersistence(): Promise<boolean> {
      if (storage === undefined || typeof storage.persist !== 'function') {
        return false;
      }
      try {
        const granted = await storage.persist();
        return granted === true;
      } catch {
        // 被拒绝或浏览器不支持都不算错误：调用方继续可用并提示回收风险。
        return false;
      }
    },
  };
}
