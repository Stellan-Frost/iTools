import type {
  AssetRecord,
  AssetReference,
  TaskRecord,
} from '@itools/contracts';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  AssetRepository,
  StoredAssetInput,
} from '../../application/ports.js';
import { createIndexedDbAssetRepository } from './asset-repository.js';
import { openAssetDatabase } from './database.js';

const BLOB_BYTES: Uint8Array<ArrayBuffer> = new Uint8Array([
  0, 1, 2, 3, 254, 255,
]);

function makeRecord(
  assetId: string,
  overrides: Partial<AssetRecord> = {},
): AssetRecord {
  return {
    assetId,
    role: 'source',
    name: `${assetId}.bin`,
    mimeType: 'application/octet-stream',
    sizeBytes: BLOB_BYTES.byteLength,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBlob(bytes: Uint8Array<ArrayBuffer> = BLOB_BYTES): Blob {
  return new Blob([bytes], { type: 'application/octet-stream' });
}

function makeReference(assetId: string, taskId: string): AssetReference {
  return { assetId, taskId, role: 'source' };
}

function makeTask(taskId: string, status: TaskRecord['status']): TaskRecord {
  return {
    taskId,
    toolId: 'tool-a',
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:01.000Z',
    resultAssetIds: [],
  };
}

function input(
  record: AssetRecord,
  references: readonly AssetReference[] = [],
  blob: Blob = makeBlob(),
): StoredAssetInput {
  return { record, blob, references };
}

let factory: IDBFactory;
let db: IDBDatabase;
let repo: AssetRepository;

beforeEach(async () => {
  factory = new IDBFactory();
  db = await openAssetDatabase({ factory });
  repo = createIndexedDbAssetRepository({ database: db });
});

afterEach(() => {
  repo.close();
});

function countStore(storeName: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const request = db
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .count();
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

function deleteRaw(storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
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

describe('createIndexedDbAssetRepository', () => {
  it('写入后可读回元数据与 Blob 内容', async () => {
    await repo.writeAsset(
      input(makeRecord('asset-1', { taskId: 'task-1' }), [
        makeReference('asset-1', 'task-1'),
      ]),
    );

    const stored = await repo.readAsset('asset-1');
    if (stored === undefined) throw new Error('资产应当存在');

    expect(stored.record).toEqual(makeRecord('asset-1', { taskId: 'task-1' }));
    expect(stored.blob.size).toBe(BLOB_BYTES.byteLength);
    expect(stored.blob.type).toBe('application/octet-stream');
    expect([...new Uint8Array(await stored.blob.arrayBuffer())]).toEqual([
      ...BLOB_BYTES,
    ]);
    expect(await repo.listAssets()).toEqual([
      makeRecord('asset-1', { taskId: 'task-1' }),
    ]);
    expect(await repo.listReferences()).toEqual([
      makeReference('asset-1', 'task-1'),
    ]);
  });

  it('重复 assetId 被拒绝且不覆盖已有内容与引用', async () => {
    await repo.writeAsset(
      input(makeRecord('asset-1'), [makeReference('asset-1', 'task-1')]),
    );

    const conflicting = input(
      makeRecord('asset-1', { name: 'other.bin' }),
      [makeReference('asset-1', 'task-2')],
      makeBlob(new Uint8Array([9, 9])),
    );

    await expect(repo.writeAsset(conflicting)).rejects.toThrow(/已存在/);

    const stored = await repo.readAsset('asset-1');
    if (stored === undefined) throw new Error('资产应当存在');
    expect(stored.record.name).toBe('asset-1.bin');
    expect(stored.blob.size).toBe(BLOB_BYTES.byteLength);
    expect(await repo.listAssets()).toHaveLength(1);
    expect(await repo.listReferences()).toEqual([
      makeReference('asset-1', 'task-1'),
    ]);
  });

  it('事务失败时不留任何部分记录', async () => {
    let failOnce = true;
    const failing = createIndexedDbAssetRepository({
      database: db,
      failNextTransaction: () => {
        if (!failOnce) return false;
        failOnce = false;
        return true;
      },
    });

    await expect(
      failing.writeAsset(
        input(makeRecord('asset-1'), [makeReference('asset-1', 'task-1')]),
      ),
    ).rejects.toThrow();

    await expect(countStore('assets')).resolves.toBe(0);
    await expect(countStore('blobs')).resolves.toBe(0);
    await expect(countStore('references')).resolves.toBe(0);

    // 注入只消费一次，后续写入应恢复正常。
    await failing.writeAsset(input(makeRecord('asset-1')));
    await expect(countStore('assets')).resolves.toBe(1);
    await expect(countStore('blobs')).resolves.toBe(1);
  });

  it('删除资产同时清理内容与全部相关引用', async () => {
    await repo.writeAsset(
      input(makeRecord('asset-1'), [
        makeReference('asset-1', 'task-1'),
        makeReference('asset-1', 'task-2'),
      ]),
    );
    await repo.writeAsset(
      input(makeRecord('asset-2'), [makeReference('asset-2', 'task-2')]),
    );

    // 重复 ID 与不存在的 ID 都视为成功。
    await repo.deleteAssets(['asset-1', 'asset-1', 'missing']);

    expect(await repo.readAsset('asset-1')).toBeUndefined();
    await expect(countStore('blobs')).resolves.toBe(1);
    expect(await repo.listAssets()).toEqual([makeRecord('asset-2')]);
    expect(await repo.listReferences()).toEqual([
      makeReference('asset-2', 'task-2'),
    ]);
  });

  it('按 taskId 与 assetId 过滤引用', async () => {
    await repo.writeAsset(
      input(makeRecord('asset-1'), [
        makeReference('asset-1', 'task-1'),
        makeReference('asset-1', 'task-2'),
      ]),
    );
    await repo.writeAsset(
      input(makeRecord('asset-2'), [makeReference('asset-2', 'task-1')]),
    );

    expect(await repo.listReferences({ taskId: 'task-1' })).toHaveLength(2);
    expect(await repo.listReferences({ assetId: 'asset-1' })).toHaveLength(2);
    expect(
      await repo.listReferences({ taskId: 'task-1', assetId: 'asset-2' }),
    ).toEqual([makeReference('asset-2', 'task-1')]);
    expect(await repo.listReferences({ taskId: 'missing' })).toHaveLength(0);
  });

  it('元数据存在但内容缺失时返回 undefined 且不删除元数据', async () => {
    await repo.writeAsset(input(makeRecord('asset-1')));
    await deleteRaw('blobs', 'asset-1');

    expect(await repo.readAsset('asset-1')).toBeUndefined();
    await expect(countStore('assets')).resolves.toBe(1);
    expect(await repo.listAssets()).toEqual([makeRecord('asset-1')]);
  });

  it('任务记录按 taskId 覆盖写入', async () => {
    await repo.writeTaskRecord(makeTask('task-1', 'queued'));
    await repo.writeTaskRecord(makeTask('task-1', 'running'));
    await repo.writeTaskRecord(makeTask('task-2', 'completed'));

    const tasks = await repo.listTaskRecords();
    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.taskId === 'task-1')?.status).toBe(
      'running',
    );
  });

  it('clearAll 清空全部仓库', async () => {
    await repo.writeAsset(
      input(makeRecord('asset-1'), [makeReference('asset-1', 'task-1')]),
    );
    await repo.writeTaskRecord(makeTask('task-1', 'queued'));

    await repo.clearAll();

    for (const storeName of [
      'assets',
      'blobs',
      'references',
      'tasks',
      'meta',
    ]) {
      await expect(countStore(storeName)).resolves.toBe(0);
    }
  });

  it('关闭后幂等且拒绝后续操作', async () => {
    repo.close();
    repo.close();

    await expect(repo.readAsset('asset-1')).rejects.toThrow(/关闭/);
    await expect(repo.listAssets()).rejects.toThrow(/关闭/);
  });

  it('重开数据库后仍能读到之前写入的资产', async () => {
    await repo.writeAsset(
      input(makeRecord('asset-1'), [makeReference('asset-1', 'task-1')]),
    );
    repo.close();

    const reopened = await openAssetDatabase({ factory });
    const nextRepo = createIndexedDbAssetRepository({ database: reopened });

    const stored = await nextRepo.readAsset('asset-1');
    expect(stored?.blob.size).toBe(BLOB_BYTES.byteLength);
    expect(await nextRepo.listReferences({ taskId: 'task-1' })).toHaveLength(1);

    nextRepo.close();
  });
});
