/**
 * 资产存储的对外端口，冻结文件：由根 Agent 维护，实施 Agent 不得修改。
 * 仓储是粗粒度、原子操作：一次写入要么全部成功，要么完全不留下记录。
 */
import type {
  AssetRecord,
  AssetReference,
  TaskRecord,
} from '@itools/contracts';

import type { CleanupPlan, CleanupSkip } from '../domain/asset-types.js';

export interface StoredAssetInput {
  readonly record: AssetRecord;
  readonly blob: Blob;
  /** 与资产同时写入的引用关系，避免出现“有资产没引用”的中间态。 */
  readonly references: readonly AssetReference[];
}

export interface ReferenceFilter {
  readonly taskId?: string;
  readonly assetId?: string;
}

export interface StoredAsset {
  readonly record: AssetRecord;
  readonly blob: Blob;
}

export interface AssetRepository {
  /** 原子写入：元数据 + 内容 + 引用。失败时不得留下任何部分记录。 */
  writeAsset(input: StoredAssetInput): Promise<void>;
  readAsset(assetId: string): Promise<StoredAsset | undefined>;
  listAssets(): Promise<readonly AssetRecord[]>;
  listReferences(filter?: ReferenceFilter): Promise<readonly AssetReference[]>;
  /** 同时删除资产、内容与相关引用；不存在的 ID 视为成功。 */
  deleteAssets(assetIds: readonly string[]): Promise<void>;
  listTaskRecords(): Promise<readonly TaskRecord[]>;
  writeTaskRecord(record: TaskRecord): Promise<void>;
  /** 仅由显式重置流程调用，禁止在升级路径中自动调用。 */
  clearAll(): Promise<void>;
  close(): void;
}

export interface StorageEstimateSnapshot {
  readonly usageBytes: number;
  /** 浏览器未提供配额时为 undefined。 */
  readonly quotaBytes?: number;
}

export interface StorageQuota {
  estimate(): Promise<StorageEstimateSnapshot>;
  /** 申请持久化存储；被拒绝不算错误，调用方继续可用但需提示回收风险。 */
  requestPersistence(): Promise<boolean>;
}

export interface ObjectUrlFactory {
  create(blob: Blob): string;
  revoke(url: string): void;
}

export interface AcquiredObjectUrl {
  readonly url: string;
  /** 必须成对调用；重复释放是幂等的。 */
  release(): void;
}

export interface AssetCreateInput {
  readonly name: string;
  readonly mimeType: string;
  readonly blob: Blob;
  readonly taskId?: string;
}

export interface CleanupOptions {
  readonly now: Date;
  readonly retentionMs: number;
  readonly activeTaskIds: readonly string[];
}

export interface CleanupResult {
  readonly removedAssetIds: readonly string[];
  readonly skipped: readonly CleanupSkip[];
  /** 完整判定结果，便于调用方与测试核对保留/删除明细。 */
  readonly plan: CleanupPlan;
}

export interface AssetService {
  createSource(input: AssetCreateInput): Promise<AssetRecord>;
  createIntermediate(input: AssetCreateInput): Promise<AssetRecord>;
  /** 结果与任务强绑定：缺少 taskId 属于调用错误。 */
  createResult(
    input: AssetCreateInput & { readonly taskId: string },
  ): Promise<AssetRecord>;
  getAsset(assetId: string): Promise<AssetRecord | undefined>;
  getBlob(assetId: string): Promise<Blob | undefined>;
  listAssets(): Promise<readonly AssetRecord[]>;
  acquireObjectUrl(assetId: string): Promise<AcquiredObjectUrl>;
  writeTaskRecord(record: TaskRecord): Promise<void>;
  listTaskRecords(): Promise<readonly TaskRecord[]>;
  cleanup(options: CleanupOptions): Promise<CleanupResult>;
  estimateStorage(): Promise<StorageEstimateSnapshot>;
  /** 清空本地数据；只能由用户明确触发的重置流程调用。 */
  reset(): Promise<void>;
}

export interface AssetServiceOptions {
  readonly repository: AssetRepository;
  readonly objectUrls: ObjectUrlFactory;
  readonly quota: StorageQuota;
  readonly now: () => Date;
  readonly createAssetId: () => string;
  readonly defaultSourceRetentionMs: number;
}

export interface ArchiveExportOptions {
  /** 是否把文件内容（base64）写进归档；false 时只导出元数据。 */
  readonly includeSourceData: boolean;
}

export interface ArchiveImportResult {
  readonly importedAssetIds: readonly string[];
  readonly importedTaskIds: readonly string[];
  /** 因缺少内容而只恢复元数据的资产。 */
  readonly metadataOnlyAssetIds: readonly string[];
}

export interface ArchiveImportOptions {
  /** true 表示先清空现有数据再导入；false 表示合并。 */
  readonly replaceExisting: boolean;
}

export interface ArchiveService {
  exportToJson(options: ArchiveExportOptions): Promise<string>;
  /** 校验全部通过后才写入；失败时回滚本次新增，不破坏已有数据。 */
  importFromJson(
    json: string,
    options: ArchiveImportOptions,
  ): Promise<ArchiveImportResult>;
}

export interface ArchiveServiceOptions {
  readonly repository: AssetRepository;
  readonly now: () => Date;
}
