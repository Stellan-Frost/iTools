/**
 * 组装层集成测试：真实 fake-indexeddb + 真实服务 + 归档往返。
 * 这是阶段 6 的端到端证据：元数据、内容、引用、清理、导出导入必须一致。
 */
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { createAssetStore } from './create-asset-store.js';
import { openAssetDatabase } from './infrastructure/indexeddb/database.js';
import {
  FakeObjectUrlFactory,
  FakeStorageQuota,
} from './test-support/fake-object-url.js';

const NOW = new Date('2026-10-19T00:00:00.000Z');

interface Harness {
  readonly store: ReturnType<typeof createAssetStore>;
  readonly objectUrls: FakeObjectUrlFactory;
}

async function createHarness(name: string): Promise<Harness> {
  const database = await openAssetDatabase({
    factory: new IDBFactory(),
    name,
  });
  const objectUrls = new FakeObjectUrlFactory();
  let sequence = 0;
  const store = createAssetStore({
    database,
    objectUrls,
    quota: new FakeStorageQuota(),
    now: () => NOW,
    createAssetId: () => {
      sequence += 1;
      return `${name}-asset-${sequence}`;
    },
  });
  return { store, objectUrls };
}

describe('资产存储组装', () => {
  it('源文件写入后可按 ID 读回内容', async () => {
    const { store } = await createHarness('db-read');
    const blob = new Blob(['hello'], { type: 'text/plain' });

    const record = await store.service.createSource({
      name: 'note.txt',
      mimeType: 'text/plain',
      blob,
    });

    expect(record.role).toBe('source');
    expect(record.sizeBytes).toBe(5);
    const storedBlob = await store.service.getBlob(record.assetId);
    expect(await storedBlob?.text()).toBe('hello');
    store.dispose();
  });

  it('结果资产与任务绑定并写入引用', async () => {
    const { store } = await createHarness('db-result');
    const record = await store.service.createResult({
      name: 'out.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      taskId: 'task-1',
    });

    expect(record.taskId).toBe('task-1');
    const references = await store.repository.listReferences({
      taskId: 'task-1',
    });
    expect(references).toEqual([
      { assetId: record.assetId, role: 'result', taskId: 'task-1' },
    ]);
    store.dispose();
  });

  it('对象 URL 成对释放，重复释放不重复撤销', async () => {
    const { store, objectUrls } = await createHarness('db-url');
    const record = await store.service.createSource({
      name: 'a.txt',
      mimeType: 'text/plain',
      blob: new Blob(['a'], { type: 'text/plain' }),
    });

    const acquired = await store.service.acquireObjectUrl(record.assetId);
    expect(objectUrls.created).toEqual([acquired.url]);

    acquired.release();
    acquired.release();
    expect(objectUrls.revoked).toEqual([acquired.url]);
    store.dispose();
    expect(objectUrls.active.size).toBe(0);
  });

  it('清理只删除过期源文件，保留结果与被引用文件', async () => {
    const { store } = await createHarness('db-cleanup');
    const expired = await store.service.createSource({
      name: 'old.txt',
      mimeType: 'text/plain',
      blob: new Blob(['old'], { type: 'text/plain' }),
    });
    const referenced = await store.service.createSource({
      name: 'used.txt',
      mimeType: 'text/plain',
      blob: new Blob(['used'], { type: 'text/plain' }),
      taskId: 'task-active',
    });
    const result = await store.service.createResult({
      name: 'out.txt',
      mimeType: 'text/plain',
      blob: new Blob(['out'], { type: 'text/plain' }),
      taskId: 'task-2',
    });

    const cleanup = await store.service.cleanup({
      now: new Date('2026-11-01T00:00:00.000Z'),
      retentionMs: 7 * 24 * 60 * 60 * 1_000,
      activeTaskIds: ['task-active'],
    });

    expect(cleanup.removedAssetIds).toEqual([expired.assetId]);
    expect(
      cleanup.skipped.map((entry) => [entry.assetId, entry.reason]),
    ).toEqual(
      expect.arrayContaining([
        // 引用优先于活动任务：两者同时命中时按引用解释。
        [referenced.assetId, 'referenced'],
        [result.assetId, 'not-source'],
      ]),
    );
    const remaining = (await store.service.listAssets()).map(
      (asset) => asset.assetId,
    );
    expect(remaining).toEqual(
      expect.arrayContaining([referenced.assetId, result.assetId]),
    );
    expect(remaining).not.toContain(expired.assetId);
    store.dispose();
  });

  it('归档导出后可在另一个库完整恢复', async () => {
    const source = await createHarness('db-export');
    const record = await source.store.service.createSource({
      name: '报告.txt',
      mimeType: 'text/plain',
      blob: new Blob(['内容'], { type: 'text/plain' }),
      taskId: 'task-9',
    });
    await source.store.service.writeTaskRecord({
      taskId: 'task-9',
      toolId: 'text-count',
      status: 'completed',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      resultAssetIds: [],
    });

    const json = await source.store.archive.exportToJson({
      includeSourceData: true,
    });
    source.store.dispose();

    const target = await createHarness('db-import');
    const result = await target.store.archive.importFromJson(json, {
      replaceExisting: true,
    });

    expect(result.importedAssetIds).toEqual([record.assetId]);
    expect(result.importedTaskIds).toEqual(['task-9']);
    const restored = await target.store.service.getBlob(record.assetId);
    expect(await restored?.text()).toBe('内容');
    expect(await target.store.service.listTaskRecords()).toHaveLength(1);
    target.store.dispose();
  });

  it('dispose 后关闭数据库连接', async () => {
    const { store } = await createHarness('db-dispose');
    store.dispose();
    await expect(store.service.listAssets()).rejects.toThrow();
  });
});
