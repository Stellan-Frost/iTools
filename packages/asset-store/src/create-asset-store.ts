/**
 * 组装入口：把 IndexedDB 仓储、对象 URL 注册表、配额适配与归档服务接成一个实例。
 * 应用层只需要拿到 AssetStore，不需要知道持久化细节。
 */
import { createArchiveService } from './application/archive-service.js';
import { createAssetService } from './application/asset-service.js';
import type {
  ArchiveService,
  AssetRepository,
  AssetService,
  ObjectUrlFactory,
  StorageQuota,
} from './application/ports.js';
import { DEFAULT_SOURCE_RETENTION_MS } from './domain/asset-types.js';
import { createIndexedDbAssetRepository } from './infrastructure/indexeddb/asset-repository.js';
import { createBrowserStorageQuota } from './infrastructure/indexeddb/quota.js';

export interface AssetStoreOptions {
  readonly database: IDBDatabase;
  /** 缺省使用 `URL.createObjectURL`；测试可注入替身。 */
  readonly objectUrls?: ObjectUrlFactory;
  /** 缺省读取 `navigator.storage`；不可用时降级为零用量。 */
  readonly quota?: StorageQuota;
  readonly now?: () => Date;
  readonly createAssetId?: () => string;
}

export interface AssetStore {
  readonly service: AssetService;
  readonly archive: ArchiveService;
  readonly repository: AssetRepository;
  /** 释放对象 URL 并关闭数据库连接。 */
  dispose(): void;
}

let assetSequence = 0;

function createDefaultAssetId(): string {
  const globalCrypto: Crypto | undefined = globalThis.crypto;
  if (
    globalCrypto !== undefined &&
    typeof globalCrypto.randomUUID === 'function'
  ) {
    return `asset-${globalCrypto.randomUUID()}`;
  }
  assetSequence += 1;
  return `asset-local-${assetSequence}`;
}

const browserObjectUrls: ObjectUrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

export function createAssetStore(options: AssetStoreOptions): AssetStore {
  const repository = createIndexedDbAssetRepository({
    database: options.database,
  });
  const service = createAssetService({
    repository,
    // 服务内部会创建引用计数注册表，这里只传工厂。
    objectUrls: options.objectUrls ?? browserObjectUrls,
    quota:
      options.quota ??
      createBrowserStorageQuota({
        storage: globalThis.navigator?.storage,
      }),
    now: options.now ?? (() => new Date()),
    createAssetId: options.createAssetId ?? createDefaultAssetId,
    defaultSourceRetentionMs: DEFAULT_SOURCE_RETENTION_MS,
  });
  const archive = createArchiveService({
    repository,
    now: options.now ?? (() => new Date()),
  });

  return {
    service,
    archive,
    repository,
    dispose: () => {
      service.dispose();
      repository.close();
    },
  };
}
