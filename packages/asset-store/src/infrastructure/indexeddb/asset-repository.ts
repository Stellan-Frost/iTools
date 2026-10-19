/**
 * `AssetRepository` 的 IndexedDB 实现。
 *
 * 所有写操作都在单个 readwrite 事务内完成：任一请求失败（或测试注入失败）都会让
 * 事务 abort，IndexedDB 负责回滚，因此不会留下“有元数据没内容”或“有资产没引用”
 * 的中间态。错误信息只包含错误名与静态描述，绝不携带文件内容。
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
} from '../../application/ports.js';

export interface IndexedDbRepositoryOptions {
  readonly database: IDBDatabase;
  /** 可选：测试注入事务失败，用于验证原子性。每次操作最多消费一次。 */
  readonly failNextTransaction?: () => boolean;
}

const ASSET_STORES = ['assets', 'blobs', 'references'] as const;
const ALL_STORES = ['assets', 'blobs', 'references', 'tasks', 'meta'] as const;

interface BlobRecord {
  readonly assetId: string;
  readonly blob: Blob;
}

function toRepositoryError(
  error: DOMException | null,
  fallbackMessage: string,
): Error {
  if (error === null) return new Error(fallbackMessage);
  return new Error(`${fallbackMessage}（${error.name}）`);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(toRepositoryError(request.error, '数据库请求失败'));
    };
  });
}

function transactionCompletion(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(toRepositoryError(tx.error, '数据库事务失败'));
    };
    tx.onabort = () => {
      reject(toRepositoryError(tx.error, '数据库事务已中止'));
    };
  });
}

class IndexedDbAssetRepository implements AssetRepository {
  private readonly database: IDBDatabase;
  private readonly failNextTransaction: (() => boolean) | undefined;
  private closed = false;

  constructor(options: IndexedDbRepositoryOptions) {
    this.database = options.database;
    this.failNextTransaction = options.failNextTransaction;
  }

  async writeAsset(input: StoredAssetInput): Promise<void> {
    this.assertOpen();

    const transaction = this.database.transaction(
      [...ASSET_STORES],
      'readwrite',
    );
    const completion = transactionCompletion(transaction);

    const assets = transaction.objectStore('assets');
    let duplicateAssetId = false;
    const assetRequest = assets.add(input.record);
    assetRequest.onerror = () => {
      if (assetRequest.error?.name === 'ConstraintError') {
        duplicateAssetId = true;
      }
    };

    const blob: BlobRecord = {
      assetId: input.record.assetId,
      blob: input.blob,
    };
    transaction.objectStore('blobs').put(blob);

    const referenceStore = transaction.objectStore('references');
    for (const reference of input.references) {
      referenceStore.put(reference);
    }

    if (this.consumeInjectedFailure()) {
      transaction.abort();
    }

    try {
      await completion;
    } catch (error) {
      if (duplicateAssetId) {
        throw new Error(`资产已存在：${input.record.assetId}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  async readAsset(assetId: string): Promise<StoredAsset | undefined> {
    this.assertOpen();

    const transaction = this.database.transaction(
      ['assets', 'blobs'],
      'readonly',
    );
    const [record, blobRecord] = await Promise.all([
      requestResult<AssetRecord | undefined>(
        transaction.objectStore('assets').get(assetId),
      ),
      requestResult<BlobRecord | undefined>(
        transaction.objectStore('blobs').get(assetId),
      ),
    ]);

    // 元数据与内容必须同时存在；任一缺失视为资产不存在，但不做静默清理。
    if (record === undefined || blobRecord === undefined) {
      return undefined;
    }
    return { record, blob: blobRecord.blob };
  }

  async listAssets(): Promise<readonly AssetRecord[]> {
    this.assertOpen();
    const transaction = this.database.transaction('assets', 'readonly');
    return requestResult<AssetRecord[]>(
      transaction.objectStore('assets').getAll(),
    );
  }

  async listReferences(
    filter: ReferenceFilter = {},
  ): Promise<readonly AssetReference[]> {
    this.assertOpen();

    const transaction = this.database.transaction('references', 'readonly');
    const store = transaction.objectStore('references');
    const { taskId, assetId } = filter;

    if (taskId !== undefined && assetId !== undefined) {
      const byTask = await requestResult<AssetReference[]>(
        store.index('by-task').getAll(taskId),
      );
      return byTask.filter((reference) => reference.assetId === assetId);
    }
    if (taskId !== undefined) {
      return requestResult<AssetReference[]>(
        store.index('by-task').getAll(taskId),
      );
    }
    if (assetId !== undefined) {
      return requestResult<AssetReference[]>(
        store.index('by-asset').getAll(assetId),
      );
    }
    return requestResult<AssetReference[]>(store.getAll());
  }

  async deleteAssets(assetIds: readonly string[]): Promise<void> {
    this.assertOpen();

    const uniqueIds = [...new Set(assetIds)];
    if (uniqueIds.length === 0) return;

    const transaction = this.database.transaction(
      [...ASSET_STORES],
      'readwrite',
    );
    const completion = transactionCompletion(transaction);

    const assets = transaction.objectStore('assets');
    const blobs = transaction.objectStore('blobs');
    for (const assetId of uniqueIds) {
      // 不存在的 key 删除视为成功。
      assets.delete(assetId);
      blobs.delete(assetId);
    }

    // 用游标批量清理引用，避免在事务内 await 造成事务提前提交。
    const idSet = new Set(uniqueIds);
    const referenceStore = transaction.objectStore('references');
    const cursorRequest = referenceStore.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor === null) return;
      const reference: AssetReference = cursor.value;
      if (idSet.has(reference.assetId)) {
        cursor.delete();
      }
      cursor.continue();
    };

    if (this.consumeInjectedFailure()) {
      transaction.abort();
    }

    await completion;
  }

  async listTaskRecords(): Promise<readonly TaskRecord[]> {
    this.assertOpen();
    const transaction = this.database.transaction('tasks', 'readonly');
    return requestResult<TaskRecord[]>(
      transaction.objectStore('tasks').getAll(),
    );
  }

  async writeTaskRecord(record: TaskRecord): Promise<void> {
    this.assertOpen();

    const transaction = this.database.transaction('tasks', 'readwrite');
    const completion = transactionCompletion(transaction);
    transaction.objectStore('tasks').put(record);

    if (this.consumeInjectedFailure()) {
      transaction.abort();
    }

    await completion;
  }

  async clearAll(): Promise<void> {
    this.assertOpen();

    const transaction = this.database.transaction([...ALL_STORES], 'readwrite');
    const completion = transactionCompletion(transaction);
    for (const storeName of ALL_STORES) {
      transaction.objectStore(storeName).clear();
    }

    if (this.consumeInjectedFailure()) {
      transaction.abort();
    }

    await completion;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }

  private consumeInjectedFailure(): boolean {
    return this.failNextTransaction?.() ?? false;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('资产仓储已关闭');
    }
  }
}

export function createIndexedDbAssetRepository(
  options: IndexedDbRepositoryOptions,
): AssetRepository {
  return new IndexedDbAssetRepository(options);
}
