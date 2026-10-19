import {
  ASSET_ARCHIVE_FORMAT_VERSION,
  type AssetArchive,
  type AssetRecord,
  type AssetReference,
  type AssetRole,
  type TaskRecord,
} from '@itools/contracts';
import { describe, expect, it } from 'vitest';

import {
  ArchiveValidationError,
  buildArchive,
  decodeBase64ToBytes,
  encodeBytesToBase64,
  parseArchive,
} from '../domain/archive-format.js';
import { InMemoryAssetRepository } from '../test-support/in-memory-repository.js';
import { createArchiveService } from './archive-service.js';
import type { StoredAsset, StoredAssetInput } from './ports.js';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const NOW = '2026-02-01T00:00:00.000Z';

interface EntryFixture {
  readonly record: AssetRecord;
  readonly bytes: Uint8Array;
  readonly references: readonly AssetReference[];
}

function makeRecord(
  assetId: string,
  role: AssetRole = 'source',
  taskId?: string,
): AssetRecord {
  const base = {
    assetId,
    role,
    name: `${assetId}.bin`,
    mimeType: 'application/octet-stream',
    sizeBytes: 3,
    createdAt: CREATED_AT,
  };
  return taskId === undefined ? base : { ...base, taskId };
}

function makeTask(taskId: string): TaskRecord {
  return {
    taskId,
    toolId: 'image.convert',
    status: 'completed',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    resultAssetIds: [],
  };
}

function makeReference(
  assetId: string,
  role: AssetRole = 'source',
  taskId = 'task-1',
): AssetReference {
  return { assetId, role, taskId };
}

function makeService(repository: InMemoryAssetRepository) {
  return createArchiveService({
    repository,
    now: () => new Date(NOW),
  });
}

function makeBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType });
}

async function seed(
  repository: InMemoryAssetRepository,
  entry: EntryFixture,
  task?: TaskRecord,
): Promise<void> {
  await repository.writeAsset({
    record: entry.record,
    blob: makeBlob(entry.bytes, entry.record.mimeType),
    references: entry.references,
  });
  if (task !== undefined) await repository.writeTaskRecord(task);
}

async function toJson(
  entries: readonly EntryFixture[],
  tasks: readonly TaskRecord[] = [],
  includeSourceData = true,
): Promise<string> {
  const archive = await buildArchive({
    assets: entries.map((entry) => ({
      record: entry.record,
      blob: makeBlob(entry.bytes, entry.record.mimeType),
      references: entry.references,
    })),
    tasks,
    createdAt: CREATED_AT,
    includeSourceData,
  });
  return JSON.stringify(archive);
}

async function readBytes(
  repository: InMemoryAssetRepository,
  assetId: string,
): Promise<Uint8Array | undefined> {
  const stored: StoredAsset | undefined = await repository.readAsset(assetId);
  if (stored === undefined) return undefined;
  return new Uint8Array(await stored.blob.arrayBuffer());
}

async function assetIds(
  repository: InMemoryAssetRepository,
): Promise<readonly string[]> {
  return (await repository.listAssets()).map((record) => record.assetId);
}

async function taskIds(
  repository: InMemoryAssetRepository,
): Promise<readonly string[]> {
  return (await repository.listTaskRecords()).map((record) => record.taskId);
}

class MissingBlobRepository extends InMemoryAssetRepository {
  override async readAsset(_assetId: string): Promise<StoredAsset | undefined> {
    return undefined;
  }
}

class FailOnSecondImportWriteRepository extends InMemoryAssetRepository {
  private armed = false;
  private importWrites = 0;

  armFailure(): void {
    this.armed = true;
    this.importWrites = 0;
  }

  override async writeAsset(input: StoredAssetInput): Promise<void> {
    if (this.armed) {
      this.importWrites += 1;
      if (this.importWrites === 2) throw new Error('第二次写入失败');
    }
    await super.writeAsset(input);
  }
}

describe('归档导出', () => {
  it('包含内容时导出元数据、引用与可还原的 base64', async () => {
    const repository = new InMemoryAssetRepository();
    const bytes = Uint8Array.from([0, 1, 254, 255]);
    const reference = makeReference('asset-1', 'source', 'task-1');
    await seed(
      repository,
      {
        record: makeRecord('asset-1', 'source', 'task-1'),
        bytes,
        references: [reference],
      },
      makeTask('task-1'),
    );

    const json = await makeService(repository).exportToJson({
      includeSourceData: true,
    });
    const archive = parseArchive(json);

    expect(archive.createdAt).toBe(NOW);
    expect(archive.assets).toHaveLength(1);
    expect(archive.assets[0]?.references).toEqual([reference]);
    expect(decodeBase64ToBytes(archive.assets[0]?.dataBase64 ?? '')).toEqual(
      bytes,
    );
    expect(archive.tasks).toEqual([makeTask('task-1')]);
  });

  it('不包含内容时不写 dataBase64 键', async () => {
    const repository = new InMemoryAssetRepository();
    await seed(repository, {
      record: makeRecord('asset-1'),
      bytes: Uint8Array.from([1, 2, 3]),
      references: [],
    });

    const json = await makeService(repository).exportToJson({
      includeSourceData: false,
    });
    const archive = parseArchive(json);
    const entry = archive.assets[0];

    expect(json).not.toContain('dataBase64');
    expect(entry).toBeDefined();
    expect(entry !== undefined && 'dataBase64' in entry).toBe(false);
  });

  it('跳过元数据存在但内容缺失的资产而不崩溃', async () => {
    const repository = new MissingBlobRepository();
    await repository.writeAsset({
      record: makeRecord('orphan'),
      blob: makeBlob(Uint8Array.from([7]), 'application/octet-stream'),
      references: [makeReference('orphan')],
    });

    const json = await makeService(repository).exportToJson({
      includeSourceData: true,
    });
    const archive = parseArchive(json);

    expect(archive.assets).toEqual([]);
  });
});

describe('归档导入', () => {
  it('replaceExisting 为 true 时清空旧数据并恢复归档', async () => {
    const repository = new InMemoryAssetRepository();
    await seed(
      repository,
      {
        record: makeRecord('asset-old', 'source', 'task-old'),
        bytes: Uint8Array.from([1]),
        references: [makeReference('asset-old', 'source', 'task-old')],
      },
      makeTask('task-old'),
    );

    const bytes = Uint8Array.from([10, 20, 30]);
    const reference = makeReference('asset-new', 'result', 'task-new');
    const json = await toJson(
      [
        {
          record: makeRecord('asset-new', 'result', 'task-new'),
          bytes,
          references: [reference],
        },
      ],
      [makeTask('task-new')],
    );

    const result = await makeService(repository).importFromJson(json, {
      replaceExisting: true,
    });

    expect(result).toEqual({
      importedAssetIds: ['asset-new'],
      importedTaskIds: ['task-new'],
      metadataOnlyAssetIds: [],
    });
    expect(await assetIds(repository)).toEqual(['asset-new']);
    expect(await readBytes(repository, 'asset-new')).toEqual(bytes);
    expect(await repository.listReferences()).toEqual([reference]);
    expect(await taskIds(repository)).toEqual(['task-new']);
  });

  it('replaceExisting 为 false 时合并并保留既有数据', async () => {
    const repository = new InMemoryAssetRepository();
    const oldReference = makeReference('asset-old', 'source', 'task-old');
    await seed(
      repository,
      {
        record: makeRecord('asset-old', 'source', 'task-old'),
        bytes: Uint8Array.from([1]),
        references: [oldReference],
      },
      makeTask('task-old'),
    );

    const json = await toJson(
      [
        {
          record: makeRecord('asset-new', 'source', 'task-new'),
          bytes: Uint8Array.from([2]),
          references: [makeReference('asset-new', 'source', 'task-new')],
        },
      ],
      [makeTask('task-new')],
    );

    const result = await makeService(repository).importFromJson(json, {
      replaceExisting: false,
    });

    expect(result.importedAssetIds).toEqual(['asset-new']);
    expect(await assetIds(repository)).toEqual(['asset-old', 'asset-new']);
    expect(await taskIds(repository)).toEqual(['task-old', 'task-new']);
    expect(await repository.listReferences()).toHaveLength(2);
  });

  it('跳过没有内容的数据并报告 metadataOnlyAssetIds', async () => {
    const repository = new InMemoryAssetRepository();
    const recordA = makeRecord('asset-a');
    const recordB = makeRecord('asset-b');
    const archive: AssetArchive = {
      formatVersion: ASSET_ARCHIVE_FORMAT_VERSION,
      createdAt: CREATED_AT,
      assets: [
        {
          record: recordA,
          references: [makeReference('asset-a'), makeReference('asset-b')],
          dataBase64: encodeBytesToBase64(Uint8Array.from([1, 2, 3])),
        },
        { record: recordB, references: [] },
      ],
      tasks: [],
    };

    const result = await makeService(repository).importFromJson(
      JSON.stringify(archive),
      { replaceExisting: false },
    );

    expect(result.importedAssetIds).toEqual(['asset-a']);
    expect(result.metadataOnlyAssetIds).toEqual(['asset-b']);
    expect(await assetIds(repository)).toEqual(['asset-a']);
    expect(await repository.readAsset('asset-b')).toBeUndefined();
    expect(await repository.listReferences()).toEqual([
      makeReference('asset-a'),
    ]);
  });

  it('内容数据非法时不写入任何数据', async () => {
    const repository = new InMemoryAssetRepository();
    const archive: AssetArchive = {
      formatVersion: ASSET_ARCHIVE_FORMAT_VERSION,
      createdAt: CREATED_AT,
      assets: [
        {
          record: makeRecord('asset-bad'),
          references: [],
          dataBase64: '!!!!',
        },
      ],
      tasks: [],
    };

    let error: unknown;
    try {
      await makeService(repository).importFromJson(JSON.stringify(archive), {
        replaceExisting: false,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ArchiveValidationError);
    expect((error as ArchiveValidationError).issues).toEqual([
      { code: 'invalid-base64' },
    ]);
    expect(await repository.listAssets()).toEqual([]);
  });

  it('校验失败时不写入任何数据', async () => {
    const repository = new InMemoryAssetRepository();
    await seed(repository, {
      record: makeRecord('asset-old'),
      bytes: Uint8Array.from([1]),
      references: [],
    });

    const json = await toJson([
      {
        record: makeRecord('asset-1'),
        bytes: Uint8Array.from([2]),
        references: [makeReference('missing')],
      },
    ]);

    let error: unknown;
    try {
      await makeService(repository).importFromJson(json, {
        replaceExisting: false,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ArchiveValidationError);
    expect((error as ArchiveValidationError).issues).toEqual([
      { code: 'dangling-reference', targetId: 'missing' },
    ]);
    expect(await assetIds(repository)).toEqual(['asset-old']);
  });

  it('replaceExisting 写入失败时按快照恢复旧数据', async () => {
    const repository = new InMemoryAssetRepository();
    const oldBytes = Uint8Array.from([5, 6, 7]);
    const oldReference = makeReference('asset-old', 'source', 'task-old');
    await seed(
      repository,
      {
        record: makeRecord('asset-old', 'source', 'task-old'),
        bytes: oldBytes,
        references: [oldReference],
      },
      makeTask('task-old'),
    );

    const json = await toJson(
      [
        {
          record: makeRecord('asset-x'),
          bytes: Uint8Array.from([8]),
          references: [],
        },
        {
          record: makeRecord('asset-y'),
          bytes: Uint8Array.from([9]),
          references: [],
        },
      ],
      [makeTask('task-x')],
    );

    repository.failNextWrite = true;
    await expect(
      makeService(repository).importFromJson(json, { replaceExisting: true }),
    ).rejects.toThrow('写入失败');

    expect(await assetIds(repository)).toEqual(['asset-old']);
    expect(await readBytes(repository, 'asset-old')).toEqual(oldBytes);
    expect(await repository.listReferences()).toEqual([oldReference]);
    expect(await taskIds(repository)).toEqual(['task-old']);
  });

  it('合并模式写入中途失败时只回滚本次新增', async () => {
    const repository = new FailOnSecondImportWriteRepository();
    const oldReference = makeReference('asset-old', 'source', 'task-old');
    await seed(
      repository,
      {
        record: makeRecord('asset-old', 'source', 'task-old'),
        bytes: Uint8Array.from([1]),
        references: [oldReference],
      },
      makeTask('task-old'),
    );

    const json = await toJson(
      [
        {
          record: makeRecord('asset-x'),
          bytes: Uint8Array.from([2]),
          references: [],
        },
        {
          record: makeRecord('asset-y'),
          bytes: Uint8Array.from([3]),
          references: [],
        },
      ],
      [makeTask('task-x')],
    );

    repository.armFailure();
    await expect(
      makeService(repository).importFromJson(json, { replaceExisting: false }),
    ).rejects.toThrow('第二次写入失败');

    expect(await assetIds(repository)).toEqual(['asset-old']);
    expect(await repository.listReferences()).toEqual([oldReference]);
    expect(await taskIds(repository)).toEqual(['task-old']);
  });
});
