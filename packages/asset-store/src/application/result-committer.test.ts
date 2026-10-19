import { describe, expect, it } from 'vitest';

import {
  FakeObjectUrlFactory,
  FakeStorageQuota,
} from '../test-support/fake-object-url.js';
import { InMemoryAssetRepository } from '../test-support/in-memory-repository.js';

import { createAssetService } from './asset-service.js';
import type { AssetService } from './ports.js';
import { createAssetResultCommitter } from './result-committer.js';
import type { ResultArtifact } from './result-committer.js';

function createBlob(text = 'x'): Blob {
  return new Blob([text], { type: 'text/plain' });
}

function artifact(name: string, text = 'data'): ResultArtifact {
  return { name, mimeType: 'text/plain', blob: createBlob(text) };
}

function createHarness() {
  const repository = new InMemoryAssetRepository();
  const service = createAssetService({
    repository,
    objectUrls: new FakeObjectUrlFactory(),
    quota: new FakeStorageQuota(),
    now: () => new Date('2026-10-19T00:00:00.000Z'),
    createAssetId: () => `asset-${repository.assets.size + 1}`,
    defaultSourceRetentionMs: 1_000,
  });
  return { repository, service };
}

describe('结果提交通道', () => {
  it('按顺序提交全部结果并返回对应 ID', async () => {
    const { repository, service } = createHarness();
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: () => [artifact('a.txt', 'a'), artifact('b.txt', 'b')],
    });

    const assetIds = await committer('task-1', undefined);

    expect(assetIds).toEqual(['asset-1', 'asset-2']);
    expect(repository.assets.size).toBe(2);
  });

  it('把 taskId、名称、MIME 与 Blob 原样传给 createResult', async () => {
    const { repository, service } = createHarness();
    const source = artifact('report.txt', 'report');
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: () => [source],
    });

    await committer('task-42', undefined);

    const stored = repository.assets.get('asset-1');
    expect(stored?.record.taskId).toBe('task-42');
    expect(stored?.record.role).toBe('result');
    expect(stored?.record.name).toBe('report.txt');
    expect(stored?.record.mimeType).toBe('text/plain');
    expect(stored?.blob).toBe(source.blob);
    expect(stored?.record.sizeBytes).toBe(source.blob.size);
    expect(repository.references).toEqual([
      { assetId: 'asset-1', role: 'result', taskId: 'task-42' },
    ]);
  });

  it('没有产物时返回空数组', async () => {
    const { service } = createHarness();
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: () => [],
    });

    await expect(committer('task-1', {})).resolves.toEqual([]);
  });

  it('resolveArtifacts 收到任务输出', async () => {
    const { service } = createHarness();
    const seen: unknown[] = [];
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: (output) => {
        seen.push(output);
        return [];
      },
    });
    const output = { files: [{ name: 'a.txt' }] };

    await committer('task-1', output);

    expect(seen).toEqual([output]);
  });

  it('resolveArtifacts 抛错时向上抛出', async () => {
    const { repository, service } = createHarness();
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: () => {
        throw new Error('输出无法解析');
      },
    });

    await expect(committer('task-1', undefined)).rejects.toThrow(
      '输出无法解析',
    );
    expect(repository.assets.size).toBe(0);
  });

  it('写入失败时向上抛出且不返回部分 ID', async () => {
    const { repository, service } = createHarness();
    repository.failNextWrite = true;
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: () => [artifact('a.txt'), artifact('b.txt')],
    });

    await expect(committer('task-1', undefined)).rejects.toThrow('写入失败');
    expect(repository.assets.size).toBe(0);
  });

  it('中途失败时异常冒泡，之前写入的资产不会以 ID 列表返回', async () => {
    const { service } = createHarness();
    const calls: string[] = [];
    let count = 0;
    const flaky: AssetService = {
      ...service,
      async createResult(input) {
        count += 1;
        calls.push(input.name);
        if (count === 2) throw new Error('第二次写入失败');
        return service.createResult(input);
      },
    };
    const committer = createAssetResultCommitter({
      service: flaky,
      resolveArtifacts: () => [artifact('a.txt'), artifact('b.txt')],
    });

    await expect(committer('task-1', undefined)).rejects.toThrow(
      '第二次写入失败',
    );
    expect(calls).toEqual(['a.txt', 'b.txt']);
  });

  it('返回函数与任务运行时的 commitResult 签名结构兼容', async () => {
    const { service } = createHarness();
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: () => [artifact('a.txt')],
    });
    const commitResult: (
      taskId: string,
      output: unknown,
    ) => Promise<readonly string[]> = committer;

    await expect(commitResult('task-9', null)).resolves.toEqual(['asset-1']);
  });

  it('每次调用只解析当前任务的输出', async () => {
    const { repository, service } = createHarness();
    const outputs: unknown[] = [];
    const committer = createAssetResultCommitter({
      service,
      resolveArtifacts: (output) => {
        outputs.push(output);
        return [artifact(`out-${outputs.length}.txt`)];
      },
    });

    await committer('task-1', { index: 1 });
    await committer('task-2', { index: 2 });

    expect(outputs).toEqual([{ index: 1 }, { index: 2 }]);
    const records = [...repository.assets.values()].map(
      (stored) => stored.record,
    );
    expect(records.map((record) => record.taskId)).toEqual([
      'task-1',
      'task-2',
    ]);
  });
});
