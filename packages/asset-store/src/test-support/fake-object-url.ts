/**
 * Object URL 与配额的测试替身：记录创建/释放，避免依赖真实浏览器 API。
 */
import type {
  ObjectUrlFactory,
  StorageEstimateSnapshot,
  StorageQuota,
} from '../application/ports.js';

export class FakeObjectUrlFactory implements ObjectUrlFactory {
  readonly created: string[] = [];
  readonly revoked: string[] = [];
  readonly active = new Set<string>();
  private sequence = 0;

  create(_blob: Blob): string {
    this.sequence += 1;
    const url = `blob:fake/${this.sequence}`;
    this.created.push(url);
    this.active.add(url);
    return url;
  }

  revoke(url: string): void {
    this.revoked.push(url);
    this.active.delete(url);
  }
}

export class FakeStorageQuota implements StorageQuota {
  estimateValue: StorageEstimateSnapshot = {
    usageBytes: 0,
    quotaBytes: 1_000_000,
  };
  persistenceGranted = true;
  requestCount = 0;

  async estimate(): Promise<StorageEstimateSnapshot> {
    return this.estimateValue;
  }

  async requestPersistence(): Promise<boolean> {
    this.requestCount += 1;
    return this.persistenceGranted;
  }
}
