import type { TaskRecord } from '@itools/contracts';
import { describe, expect, it } from 'vitest';

import { AssetValidationError } from '../domain/asset-validation.js';
import {
  FakeObjectUrlFactory,
  FakeStorageQuota,
} from '../test-support/fake-object-url.js';
import { InMemoryAssetRepository } from '../test-support/in-memory-repository.js';

import {
  AssetNotFoundError,
  AssetUsageError,
  createAssetService,
} from './asset-service.js';

const NOW = new Date('2026-10-19T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1_000;
const OLD = '2026-10-01T00:00:00.000Z';

function createBlob(text = 'x'): Blob {
  return new Blob([text], { type: 'text/plain' });
}

class FailingDeleteRepository extends InMemoryAssetRepository {
  override async deleteAssets(): Promise<void> {
    throw new Error('删除失败（测试注入）');
  }
}

function createHarness(
  repository: InMemoryAssetRepository = new InMemoryAssetRepository(),
) {
  const objectUrls = new FakeObjectUrlFactory();
  const quota = new FakeStorageQuota();
  let sequence = 0;
  const service = createAssetService({
    repository,
    objectUrls,
    quota,
    now: () => NOW,
    createAssetId: () => {
      sequence += 1;
      return `asset-${sequence}`;
    },
    defaultSourceRetentionMs: 7 * DAY_MS,
  });
  return { repository, objectUrls, quota, service };
}

function backdate(
  repository: InMemoryAssetRepository,
  assetId: string,
  createdAt: string,
): void {
  const stored = repository.assets.get(assetId);
  if (stored === undefined) throw new Error(`测试资产不存在：${assetId}`);
  repository.assets.set(assetId, {
    record: { ...stored.record, createdAt },
    blob: stored.blob,
  });
}

function createTaskRecord(taskId: string): TaskRecord {
  return {
    taskId,
    toolId: 'tool-a',
    status: 'completed',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    resultAssetIds: [],
  };
}

describe('资产应用服务', () => {
  it('createSource 使用 blob.size 并原样保存名称与 MIME', async () => {
    const { repository, service } = createHarness();
    const blob = createBlob('hello');

    const record = await service.createSource({
      name: '报告.txt',
      mimeType: 'text/plain',
      blob,
    });

    expect(record.assetId).toBe('asset-1');
    expect(record.role).toBe('source');
    expect(record.sizeBytes).toBe(blob.size);
    expect(record.name).toBe('报告.txt');
    expect(record.mimeType).toBe('text/plain');
    expect(record.createdAt).toBe(NOW.toISOString());
    expect(record.taskId).toBeUndefined();
    expect(repository.references).toHaveLength(0);
    expect(repository.assets.get(record.assetId)?.blob).toBe(blob);
  });

  it('createResult 写入任务引用且 taskId 去空白', async () => {
    const { repository, service } = createHarness();

    const record = await service.createResult({
      name: 'out.png',
      mimeType: 'image/png',
      blob: createBlob('png'),
      taskId: '  task-1  ',
    });

    expect(record.role).toBe('result');
    expect(record.taskId).toBe('task-1');
    expect(repository.references).toEqual([
      { assetId: record.assetId, role: 'result', taskId: 'task-1' },
    ]);
  });

  it('createIntermediate 无 taskId 时不写引用', async () => {
    const { repository, service } = createHarness();

    const record = await service.createIntermediate({
      name: 'tmp.bin',
      mimeType: 'application/octet-stream',
      blob: createBlob('tmp'),
    });

    expect(record.role).toBe('intermediate');
    expect(repository.references).toHaveLength(0);
  });

  it('校验失败时抛出且不落库、不消耗 ID', async () => {
    const { repository, service } = createHarness();

    await expect(
      service.createSource({
        name: '',
        mimeType: 'text/plain',
        blob: createBlob(),
      }),
    ).rejects.toBeInstanceOf(AssetValidationError);

    expect(repository.assets.size).toBe(0);
    expect(repository.references).toHaveLength(0);

    const record = await service.createSource({
      name: 'ok.txt',
      mimeType: 'text/plain',
      blob: createBlob(),
    });
    expect(record.assetId).toBe('asset-1');
  });

  it('写入失败时向上抛出且不返回记录', async () => {
    const { repository, service } = createHarness();
    repository.failNextWrite = true;

    await expect(
      service.createSource({
        name: 'a.txt',
        mimeType: 'text/plain',
        blob: createBlob(),
      }),
    ).rejects.toThrow('写入失败');

    await expect(service.listAssets()).resolves.toEqual([]);
    expect(repository.assets.size).toBe(0);
  });

  it('createResult 的 taskId 去空白后为空时抛出 result-requires-task', async () => {
    const { repository, service } = createHarness();

    await expect(
      service.createResult({
        name: 'out.png',
        mimeType: 'image/png',
        blob: createBlob(),
        taskId: '   ',
      }),
    ).rejects.toMatchObject({ code: 'result-requires-task' });

    expect(repository.assets.size).toBe(0);
  });

  it('运行时缺少 taskId 时抛出 missing-task-id', async () => {
    const { repository, service } = createHarness();
    const input = {
      name: 'out.png',
      mimeType: 'image/png',
      blob: createBlob(),
    };

    await expect(
      service.createResult(
        input as unknown as { taskId: string } & typeof input,
      ),
    ).rejects.toBeInstanceOf(AssetUsageError);

    expect(repository.assets.size).toBe(0);
  });

  it('查询接口委托仓储', async () => {
    const { service } = createHarness();
    const blob = createBlob('data');
    const record = await service.createSource({
      name: 'a.txt',
      mimeType: 'text/plain',
      blob,
    });

    await expect(service.getAsset(record.assetId)).resolves.toEqual(record);
    await expect(service.getAsset('missing')).resolves.toBeUndefined();
    await expect(service.getBlob(record.assetId)).resolves.toBe(blob);
    await expect(service.getBlob('missing')).resolves.toBeUndefined();
    await expect(service.listAssets()).resolves.toEqual([record]);
  });

  it('acquireObjectUrl 对不存在的资产抛出 AssetNotFoundError', async () => {
    const { service } = createHarness();

    const error = await service
      .acquireObjectUrl('missing')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AssetNotFoundError);
    expect((error as AssetNotFoundError).code).toBe('asset-not-found');
  });

  it('同一资产重复获取 URL 复用，二次释放只撤销一次', async () => {
    const { objectUrls, service } = createHarness();
    const record = await service.createSource({
      name: 'a.txt',
      mimeType: 'text/plain',
      blob: createBlob(),
    });

    const first = await service.acquireObjectUrl(record.assetId);
    const second = await service.acquireObjectUrl(record.assetId);
    expect(second.url).toBe(first.url);

    first.release();
    first.release();
    expect(objectUrls.revoked).toHaveLength(0);

    second.release();
    expect(objectUrls.revoked).toEqual([first.url]);
  });

  it('cleanup 只删除过期、无引用且不属于活动任务的源文件', async () => {
    const { repository, service } = createHarness();

    const referenced = await service.createSource({
      name: 'used.txt',
      mimeType: 'text/plain',
      blob: createBlob('used'),
      taskId: 'task-a',
    });
    backdate(repository, referenced.assetId, OLD);

    const active = await service.createSource({
      name: 'active.txt',
      mimeType: 'text/plain',
      blob: createBlob('active'),
    });
    backdate(repository, active.assetId, OLD);
    const activeStored = repository.assets.get(active.assetId);
    if (activeStored === undefined) throw new Error('测试资产缺失');
    repository.assets.set(active.assetId, {
      record: { ...activeStored.record, taskId: 'task-live' },
      blob: activeStored.blob,
    });

    const stale = await service.createSource({
      name: 'stale.txt',
      mimeType: 'text/plain',
      blob: createBlob('stale'),
    });
    backdate(repository, stale.assetId, OLD);

    const fresh = await service.createSource({
      name: 'fresh.txt',
      mimeType: 'text/plain',
      blob: createBlob('fresh'),
    });

    const oldResult = await service.createResult({
      name: 'old.png',
      mimeType: 'image/png',
      blob: createBlob('old'),
      taskId: 'task-b',
    });
    backdate(repository, oldResult.assetId, OLD);

    const result = await service.cleanup({
      now: NOW,
      retentionMs: 7 * DAY_MS,
      activeTaskIds: ['task-live'],
    });

    expect(result.removedAssetIds).toEqual([stale.assetId]);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { assetId: referenced.assetId, reason: 'referenced' },
        { assetId: active.assetId, reason: 'active-task' },
        { assetId: oldResult.assetId, reason: 'not-source' },
      ]),
    );
    expect(result.plan.keep).toEqual(expect.arrayContaining([fresh.assetId]));

    const remaining = (await service.listAssets()).map(
      (asset) => asset.assetId,
    );
    expect(remaining).not.toContain(stale.assetId);
    expect(remaining).toContain(referenced.assetId);
    expect(remaining).toContain(active.assetId);
    expect(
      repository.references.some((ref) => ref.assetId === stale.assetId),
    ).toBe(false);
  });

  it('cleanup 删除失败时向上抛出', async () => {
    const repository = new FailingDeleteRepository();
    const { service } = createHarness(repository);
    const stale = await service.createSource({
      name: 'stale.txt',
      mimeType: 'text/plain',
      blob: createBlob('stale'),
    });
    backdate(repository, stale.assetId, OLD);

    await expect(
      service.cleanup({ now: NOW, retentionMs: 7 * DAY_MS, activeTaskIds: [] }),
    ).rejects.toThrow('删除失败');
  });

  it('estimateStorage 委托配额端口', async () => {
    const { quota, service } = createHarness();
    quota.estimateValue = { usageBytes: 42, quotaBytes: 100 };

    await expect(service.estimateStorage()).resolves.toEqual({
      usageBytes: 42,
      quotaBytes: 100,
    });
  });

  it('reset 清空仓储', async () => {
    const { service } = createHarness();
    await service.createSource({
      name: 'a.txt',
      mimeType: 'text/plain',
      blob: createBlob(),
    });
    await service.writeTaskRecord(createTaskRecord('task-a'));

    await service.reset();

    await expect(service.listAssets()).resolves.toEqual([]);
    await expect(service.listTaskRecords()).resolves.toEqual([]);
  });

  it('任务记录写入与读取委托仓储', async () => {
    const { service } = createHarness();
    const record = createTaskRecord('task-a');

    await service.writeTaskRecord(record);

    await expect(service.listTaskRecords()).resolves.toEqual([record]);
  });

  it('dispose 释放全部 Object URL', async () => {
    const { objectUrls, service } = createHarness();
    const first = await service.createSource({
      name: 'a.txt',
      mimeType: 'text/plain',
      blob: createBlob('a'),
    });
    const second = await service.createSource({
      name: 'b.txt',
      mimeType: 'text/plain',
      blob: createBlob('b'),
    });
    await service.acquireObjectUrl(first.assetId);
    await service.acquireObjectUrl(second.assetId);

    service.dispose();

    expect(objectUrls.revoked).toHaveLength(2);
    expect(objectUrls.active.size).toBe(0);
  });
});
