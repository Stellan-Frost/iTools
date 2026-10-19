/**
 * 资产应用服务：把仓储、配额与 Object URL 端口编排成冻结的 AssetService。
 * 这里不直接触碰 IndexedDB，也不处理任何 UI 关注点。
 */
import type {
  AssetRecord,
  AssetReference,
  AssetRole,
  TaskRecord,
} from '@itools/contracts';

import type { CleanupPlan, CleanupSkip } from '../domain/asset-types.js';
import { assertValidAssetDraft } from '../domain/asset-validation.js';
import { planRetention } from '../domain/retention.js';

import { createObjectUrlRegistry } from './object-url.js';
import type {
  AcquiredObjectUrl,
  AssetCreateInput,
  AssetService,
  AssetServiceOptions,
  CleanupOptions,
  CleanupResult,
  StorageEstimateSnapshot,
} from './ports.js';

export class AssetNotFoundError extends Error {
  readonly code = 'asset-not-found' as const;

  constructor(assetId: string) {
    super(`资产不存在：${assetId}`);
    this.name = 'AssetNotFoundError';
  }
}

export type AssetUsageErrorCode = 'result-requires-task' | 'missing-task-id';

export class AssetUsageError extends Error {
  readonly code: AssetUsageErrorCode;

  constructor(code: AssetUsageErrorCode) {
    super(
      code === 'missing-task-id'
        ? '结果资产缺少 taskId'
        : '结果资产必须绑定非空 taskId',
    );
    this.name = 'AssetUsageError';
    this.code = code;
  }
}

export function createAssetService(
  options: AssetServiceOptions,
): AssetService & { dispose(): void } {
  const objectUrls = createObjectUrlRegistry(options.objectUrls);

  async function persist(
    input: AssetCreateInput,
    role: AssetRole,
    taskId: string | undefined,
  ): Promise<AssetRecord> {
    // 大小只认真实内容，不信任调用方提供的数字。
    const sizeBytes = input.blob.size;
    assertValidAssetDraft({
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes,
      role,
    });

    const assetId = options.createAssetId();
    const createdAt = options.now().toISOString();
    const record: AssetRecord = {
      assetId,
      role,
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes,
      createdAt,
      ...(taskId === undefined ? {} : { taskId }),
    };
    const references: readonly AssetReference[] =
      taskId === undefined ? [] : [{ assetId, role, taskId }];

    // 原子写入失败时直接向上抛，绝不返回一条并不存在的记录。
    await options.repository.writeAsset({
      record,
      blob: input.blob,
      references,
    });
    return record;
  }

  function normalizeOptionalTaskId(
    taskId: string | undefined,
  ): string | undefined {
    if (taskId === undefined) return undefined;
    const trimmed = taskId.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  return {
    async createSource(input: AssetCreateInput): Promise<AssetRecord> {
      return persist(input, 'source', normalizeOptionalTaskId(input.taskId));
    },

    async createIntermediate(input: AssetCreateInput): Promise<AssetRecord> {
      return persist(
        input,
        'intermediate',
        normalizeOptionalTaskId(input.taskId),
      );
    },

    async createResult(
      input: AssetCreateInput & { readonly taskId: string },
    ): Promise<AssetRecord> {
      const raw: unknown = input.taskId;
      if (typeof raw !== 'string') throw new AssetUsageError('missing-task-id');
      const taskId = raw.trim();
      if (taskId === '') throw new AssetUsageError('result-requires-task');
      return persist(input, 'result', taskId);
    },

    async getAsset(assetId: string): Promise<AssetRecord | undefined> {
      const stored = await options.repository.readAsset(assetId);
      return stored?.record;
    },

    async getBlob(assetId: string): Promise<Blob | undefined> {
      const stored = await options.repository.readAsset(assetId);
      return stored?.blob;
    },

    async listAssets(): Promise<readonly AssetRecord[]> {
      return options.repository.listAssets();
    },

    async acquireObjectUrl(assetId: string): Promise<AcquiredObjectUrl> {
      const stored = await options.repository.readAsset(assetId);
      if (stored === undefined) throw new AssetNotFoundError(assetId);
      return objectUrls.acquire(stored.blob);
    },

    async writeTaskRecord(record: TaskRecord): Promise<void> {
      await options.repository.writeTaskRecord(record);
    },

    async listTaskRecords(): Promise<readonly TaskRecord[]> {
      return options.repository.listTaskRecords();
    },

    async cleanup(cleanupOptions: CleanupOptions): Promise<CleanupResult> {
      const assets = await options.repository.listAssets();
      const references = await options.repository.listReferences();
      // 只把资产层面的 taskId 交给保留策略，引用用于判断“仍被使用”。
      const plan: CleanupPlan = planRetention({
        assets: assets.map((asset) => ({
          assetId: asset.assetId,
          role: asset.role,
          createdAt: asset.createdAt,
          ...(asset.taskId === undefined ? {} : { taskId: asset.taskId }),
        })),
        references: references.map((reference) => ({
          assetId: reference.assetId,
        })),
        now: cleanupOptions.now,
        retentionMs: cleanupOptions.retentionMs,
        activeTaskIds: cleanupOptions.activeTaskIds,
      });

      // 删除失败必须冒泡，让调用方知道磁盘并未按计划回收。
      await options.repository.deleteAssets(plan.remove);

      const skipped: readonly CleanupSkip[] = plan.skipped;
      return { removedAssetIds: plan.remove, skipped, plan };
    },

    async estimateStorage(): Promise<StorageEstimateSnapshot> {
      return options.quota.estimate();
    },

    async reset(): Promise<void> {
      await options.repository.clearAll();
    },

    dispose(): void {
      objectUrls.releaseAll();
    },
  };
}
