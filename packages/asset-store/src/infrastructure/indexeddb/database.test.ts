import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  ASSET_DATABASE_NAME,
  ASSET_DATABASE_VERSION,
  openAssetDatabase,
} from './database.js';

function storeNames(db: IDBDatabase): string[] {
  return Array.from(db.objectStoreNames).sort();
}

function writeMeta(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({ key, value });
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
    transaction.onabort = () => {
      reject(transaction.error);
    };
  });
}

function countMeta(db: IDBDatabase): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const request = db
      .transaction('meta', 'readonly')
      .objectStore('meta')
      .count();
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

describe('openAssetDatabase', () => {
  it('首次打开创建全部对象仓库与索引', async () => {
    const factory = new IDBFactory();
    const db = await openAssetDatabase({ factory });

    expect(ASSET_DATABASE_NAME).toBe('itools-assets');
    expect(ASSET_DATABASE_VERSION).toBe(1);
    expect(storeNames(db)).toEqual([
      'assets',
      'blobs',
      'meta',
      'references',
      'tasks',
    ]);

    const assets = db.transaction('assets', 'readonly').objectStore('assets');
    expect(assets.keyPath).toBe('assetId');
    expect(Array.from(assets.indexNames).sort()).toEqual([
      'by-created',
      'by-task',
    ]);
    expect(assets.index('by-task').keyPath).toBe('taskId');
    expect(assets.index('by-task').unique).toBe(false);
    expect(assets.index('by-created').keyPath).toBe('createdAt');

    const blobs = db.transaction('blobs', 'readonly').objectStore('blobs');
    expect(blobs.keyPath).toBe('assetId');

    const references = db
      .transaction('references', 'readonly')
      .objectStore('references');
    expect(references.keyPath).toEqual(['assetId', 'taskId']);
    expect(Array.from(references.indexNames).sort()).toEqual([
      'by-asset',
      'by-task',
    ]);

    const tasks = db.transaction('tasks', 'readonly').objectStore('tasks');
    expect(tasks.keyPath).toBe('taskId');

    const meta = db.transaction('meta', 'readonly').objectStore('meta');
    expect(meta.keyPath).toBe('key');

    db.close();
  });

  it('同版本重开不会重复建仓且数据保留', async () => {
    const factory = new IDBFactory();
    const first = await openAssetDatabase({ factory });
    await writeMeta(first, 'probe', 'kept');
    first.close();

    const second = await openAssetDatabase({ factory });

    expect(storeNames(second)).toEqual([
      'assets',
      'blobs',
      'meta',
      'references',
      'tasks',
    ]);
    await expect(countMeta(second)).resolves.toBe(1);
    second.close();
  });

  it('支持自定义数据库名称', async () => {
    const factory = new IDBFactory();
    const db = await openAssetDatabase({ factory, name: 'custom-assets' });
    expect(db.name).toBe('custom-assets');
    db.close();

    const reopened = await openAssetDatabase({
      factory,
      name: 'custom-assets',
    });
    expect(storeNames(reopened)).toHaveLength(5);
    reopened.close();
  });

  it('缺少迁移步骤时拒绝打开并回滚结构变更', async () => {
    const factory = new IDBFactory();

    await expect(
      openAssetDatabase({ factory, version: ASSET_DATABASE_VERSION + 1 }),
    ).rejects.toThrow(/迁移/);

    // 升级事务已回滚，旧版本仍可正常创建并补齐仓库。
    const db = await openAssetDatabase({ factory });
    expect(storeNames(db)).toHaveLength(5);
    db.close();
  });

  it('打开低于现有版本的数据库会被拒绝', async () => {
    const factory = new IDBFactory();

    await new Promise<void>((resolve, reject) => {
      const request = factory.open('itools-assets', 5);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });

    await expect(openAssetDatabase({ factory })).rejects.toThrow();
  });

  it('升级被其他连接阻塞时拒绝而不是静默挂起', async () => {
    const factory = new IDBFactory();
    const holder = await openAssetDatabase({ factory });

    await expect(
      openAssetDatabase({ factory, version: ASSET_DATABASE_VERSION + 1 }),
    ).rejects.toThrow(/阻塞/);

    holder.close();
  });
});
