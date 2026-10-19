/**
 * 内存仓储测试替身：与 IndexedDB 实现共享同一端口语义（原子写入、引用联动）。
 * 只用于测试，由 tsconfig.build.json 排除。
 */
import type {
  AssetRecord,
  AssetReference,
  TaskRecord,
} from '@itools/contracts';

import type {
  AssetRepository,
  ReferenceFilter,
  StoredAsset,
  StoredAssetInput,
} from '../application/ports.js';

export class InMemoryAssetRepository implements AssetRepository {
  readonly assets = new Map<string, StoredAsset>();
  readonly references: AssetReference[] = [];
  readonly tasks = new Map<string, TaskRecord>();
  /** 设为 true 时下一次写入抛错，用于验证“写入失败不留残留”。 */
  failNextWrite = false;
  isClosed = false;

  async writeAsset(input: StoredAssetInput): Promise<void> {
    this.assertOpen();
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('写入失败（测试注入）');
    }
    if (this.assets.has(input.record.assetId)) {
      throw new Error(`资产已存在：${input.record.assetId}`);
    }
    this.assets.set(input.record.assetId, {
      record: input.record,
      blob: input.blob,
    });
    this.references.push(...input.references);
  }

  async readAsset(assetId: string): Promise<StoredAsset | undefined> {
    this.assertOpen();
    return this.assets.get(assetId);
  }

  async listAssets(): Promise<readonly AssetRecord[]> {
    this.assertOpen();
    return [...this.assets.values()].map((stored) => stored.record);
  }

  async listReferences(
    filter: ReferenceFilter = {},
  ): Promise<readonly AssetReference[]> {
    this.assertOpen();
    return this.references.filter(
      (reference) =>
        (filter.taskId === undefined || reference.taskId === filter.taskId) &&
        (filter.assetId === undefined || reference.assetId === filter.assetId),
    );
  }

  async deleteAssets(assetIds: readonly string[]): Promise<void> {
    this.assertOpen();
    for (const assetId of assetIds) this.assets.delete(assetId);
    for (let index = this.references.length - 1; index >= 0; index -= 1) {
      const reference = this.references[index];
      if (reference !== undefined && assetIds.includes(reference.assetId)) {
        this.references.splice(index, 1);
      }
    }
  }

  async listTaskRecords(): Promise<readonly TaskRecord[]> {
    this.assertOpen();
    return [...this.tasks.values()];
  }

  async writeTaskRecord(record: TaskRecord): Promise<void> {
    this.assertOpen();
    this.tasks.set(record.taskId, record);
  }

  async clearAll(): Promise<void> {
    this.assertOpen();
    this.assets.clear();
    this.references.length = 0;
    this.tasks.clear();
  }

  close(): void {
    this.isClosed = true;
  }

  private assertOpen(): void {
    if (this.isClosed) throw new Error('仓储已关闭');
  }
}
