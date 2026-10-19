/**
 * 公开入口：阶段 6 的本地文件资产存储。
 * 分层：domain（规则）→ application（服务）→ infrastructure（IndexedDB）。
 */
export { createAssetStore } from './create-asset-store.js';
export type { AssetStore, AssetStoreOptions } from './create-asset-store.js';

export {
  AssetNotFoundError,
  AssetUsageError,
  createAssetService,
} from './application/asset-service.js';
export type { AssetUsageErrorCode } from './application/asset-service.js';
export { createArchiveService } from './application/archive-service.js';
export { createObjectUrlRegistry } from './application/object-url.js';
export type { ObjectUrlRegistry } from './application/object-url.js';
export { createAssetResultCommitter } from './application/result-committer.js';
export type {
  ResultArtifact,
  ResultCommitterOptions,
} from './application/result-committer.js';
export type {
  AcquiredObjectUrl,
  ArchiveExportOptions,
  ArchiveImportOptions,
  ArchiveImportResult,
  ArchiveService,
  ArchiveServiceOptions,
  AssetCreateInput,
  AssetRepository,
  AssetService,
  AssetServiceOptions,
  CleanupOptions,
  CleanupResult,
  ObjectUrlFactory,
  ReferenceFilter,
  StorageEstimateSnapshot,
  StorageQuota,
  StoredAsset,
  StoredAssetInput,
} from './application/ports.js';

export {
  DEFAULT_SOURCE_RETENTION_MS,
  MAX_ASSET_NAME_LENGTH,
  MAX_MIME_TYPE_LENGTH,
} from './domain/asset-types.js';
export type {
  AssetDraft,
  AssetValidationCode,
  AssetValidationField,
  AssetValidationIssue,
  CleanupPlan,
  CleanupSkip,
  CleanupSkipReason,
  ReferenceIntegrityInput,
  ReferenceIssue,
  ReferenceIssueCode,
  RetentionInput,
} from './domain/asset-types.js';
export {
  ArchiveValidationError,
  buildArchive,
  decodeBase64ToBytes,
  encodeBytesToBase64,
  parseArchive,
  validateArchiveContent,
} from './domain/archive-format.js';
export type {
  ArchiveIssue,
  ArchiveIssueCode,
} from './domain/archive-format.js';
export {
  AssetValidationError,
  assertValidAssetDraft,
  validateAssetDraft,
} from './domain/asset-validation.js';
export { findReferenceIssues } from './domain/reference-integrity.js';
export { planRetention } from './domain/retention.js';

export {
  ASSET_DATABASE_NAME,
  ASSET_DATABASE_VERSION,
} from './infrastructure/indexeddb/database.js';
export type {
  AssetDatabaseMigration,
  OpenAssetDatabaseOptions,
} from './infrastructure/indexeddb/database.js';
export { openAssetDatabase } from './infrastructure/indexeddb/database.js';
export { createIndexedDbAssetRepository } from './infrastructure/indexeddb/asset-repository.js';
export type { IndexedDbRepositoryOptions } from './infrastructure/indexeddb/asset-repository.js';
export { createBrowserStorageQuota } from './infrastructure/indexeddb/quota.js';
export type { BrowserStorageQuotaOptions } from './infrastructure/indexeddb/quota.js';
