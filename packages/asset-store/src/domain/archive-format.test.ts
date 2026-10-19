import {
  ASSET_ARCHIVE_FORMAT_VERSION,
  type AssetArchive,
  type AssetArchiveEntry,
  type AssetRecord,
  type AssetRole,
  type AssetReference,
  type TaskRecord,
} from '@itools/contracts';
import { describe, expect, it } from 'vitest';

import {
  ArchiveValidationError,
  buildArchive,
  decodeBase64ToBytes,
  encodeBytesToBase64,
  parseArchive,
  validateArchiveContent,
} from './archive-format.js';

const CREATED_AT = '2026-01-01T00:00:00.000Z';

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

function makeEntry(
  record: AssetRecord,
  references: AssetReference[] = [],
  dataBase64?: string,
): AssetArchiveEntry {
  return dataBase64 === undefined
    ? { record, references }
    : { record, references, dataBase64 };
}

function makeArchive(
  assets: AssetArchiveEntry[],
  tasks: TaskRecord[] = [],
  formatVersion: number = ASSET_ARCHIVE_FORMAT_VERSION,
): AssetArchive {
  return { formatVersion, createdAt: CREATED_AT, assets, tasks };
}

function makeBlob(bytes: Uint8Array, mimeType?: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return mimeType === undefined
    ? new Blob([copy.buffer])
    : new Blob([copy.buffer], { type: mimeType });
}

function captureIssues(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ArchiveValidationError);
    return (error as ArchiveValidationError).issues.map((issue) => issue.code);
  }
  throw new Error('预期抛出 ArchiveValidationError');
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('归档格式 base64 编解码', () => {
  it('可在全部 0x00-0xff 字节上完成往返', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const encoded = encodeBytesToBase64(bytes);

    expect(decodeBase64ToBytes(encoded)).toEqual(bytes);
  });

  it('按 UTF-8 编码中文文件名内容并正确还原', () => {
    const source = new TextEncoder().encode('报告-数据.bin');
    const decoded = decodeBase64ToBytes(encodeBytesToBase64(source));

    expect(new TextDecoder().decode(decoded)).toBe('报告-数据.bin');
  });

  it('空字节数组编码为空串并可还原', () => {
    expect(encodeBytesToBase64(new Uint8Array(0))).toBe('');
    expect(decodeBase64ToBytes('')).toEqual(new Uint8Array(0));
  });

  it.each(['A', 'AB', 'ABC', '!!!!', 'AA=A', 'A===', '====', 'AB CD'])(
    '拒绝非法 base64：%s',
    (value) => {
      expect(captureIssues(() => decodeBase64ToBytes(value))).toEqual([
        'invalid-base64',
      ]);
    },
  );
});

describe('归档构建', () => {
  it('包含内容时写入可还原的 dataBase64', async () => {
    const record = makeRecord('asset-1');
    const reference: AssetReference = {
      assetId: 'asset-1',
      role: 'source',
      taskId: 'task-1',
    };
    const bytes = Uint8Array.from([0, 1, 254, 255]);
    const archive = await buildArchive({
      assets: [
        {
          record,
          blob: makeBlob(bytes, record.mimeType),
          references: [reference],
        },
      ],
      tasks: [makeTask('task-1')],
      createdAt: CREATED_AT,
      includeSourceData: true,
    });

    expect(archive.formatVersion).toBe(ASSET_ARCHIVE_FORMAT_VERSION);
    expect(archive.createdAt).toBe(CREATED_AT);
    expect(archive.assets).toHaveLength(1);
    const entry = archive.assets[0];
    expect(entry?.references).toEqual([reference]);
    expect(entry?.dataBase64).toBeTypeOf('string');
    expect(decodeBase64ToBytes(entry?.dataBase64 ?? '')).toEqual(bytes);
  });

  it('不包含内容时不写 dataBase64 键', async () => {
    const archive = await buildArchive({
      assets: [
        {
          record: makeRecord('asset-1'),
          blob: makeBlob(new Uint8Array([1, 2, 3])),
          references: [],
        },
      ],
      tasks: [],
      createdAt: CREATED_AT,
      includeSourceData: false,
    });

    const entry = archive.assets[0];
    expect(entry).toBeDefined();
    expect(entry !== undefined && 'dataBase64' in entry).toBe(false);
    expect(JSON.stringify(archive)).not.toContain('dataBase64');
  });
});

describe('归档解析', () => {
  it('拒绝非法 JSON', () => {
    expect(captureIssues(() => parseArchive('{oops'))).toEqual([
      'invalid-json',
    ]);
  });

  it('拒绝不符合 Schema 的结构', () => {
    expect(captureIssues(() => parseArchive('null'))).toEqual([
      'invalid-shape',
    ]);
    expect(
      captureIssues(() => parseArchive(JSON.stringify({ hello: 'world' }))),
    ).toEqual(['invalid-shape']);
    expect(
      captureIssues(() =>
        parseArchive(JSON.stringify(makeArchive([], [], 1).assets)),
      ),
    ).toEqual(['invalid-shape']);
  });

  it('拒绝不支持的格式版本', () => {
    const issues = captureIssues(() =>
      parseArchive(JSON.stringify(makeArchive([], [], 2))),
    );

    expect(issues).toEqual(['unsupported-version']);
  });

  it('拒绝重复的资产 ID 并给出目标', () => {
    const json = JSON.stringify(
      makeArchive([
        makeEntry(makeRecord('asset-1')),
        makeEntry(makeRecord('asset-1')),
      ]),
    );

    let error: unknown;
    try {
      parseArchive(json);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ArchiveValidationError);
    expect((error as ArchiveValidationError).issues).toEqual([
      { code: 'duplicate-asset-id', targetId: 'asset-1' },
    ]);
  });

  it('拒绝重复的任务 ID 并给出目标', () => {
    const json = JSON.stringify(
      makeArchive([], [makeTask('task-1'), makeTask('task-1')]),
    );

    let error: unknown;
    try {
      parseArchive(json);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ArchiveValidationError);
    expect((error as ArchiveValidationError).issues).toEqual([
      { code: 'duplicate-task-id', targetId: 'task-1' },
    ]);
  });

  it('接受完整合法的归档', async () => {
    const bytes = Uint8Array.from([9, 8, 7]);
    const built = await buildArchive({
      assets: [
        {
          record: makeRecord('asset-1'),
          blob: makeBlob(bytes),
          references: [],
        },
      ],
      tasks: [makeTask('task-1')],
      createdAt: CREATED_AT,
      includeSourceData: true,
    });

    const parsed = parseArchive(JSON.stringify(built));
    expect(parsed).toEqual(built);
  });
});

describe('归档内容校验', () => {
  it('报告悬空引用', () => {
    const archive = makeArchive([
      makeEntry(makeRecord('asset-1'), [
        { assetId: 'missing', role: 'source', taskId: 'task-1' },
      ]),
    ]);

    expect(validateArchiveContent(archive)).toEqual([
      { code: 'dangling-reference', targetId: 'missing' },
    ]);
  });

  it('报告角色不一致', () => {
    const archive = makeArchive([
      makeEntry(makeRecord('asset-1', 'source'), [
        { assetId: 'asset-1', role: 'result', taskId: 'task-1' },
      ]),
    ]);

    expect(validateArchiveContent(archive)).toEqual([
      { code: 'role-mismatch', targetId: 'asset-1' },
    ]);
  });

  it('合法引用返回空问题列表', () => {
    const archive = makeArchive([
      makeEntry(makeRecord('asset-1'), [
        { assetId: 'asset-1', role: 'source', taskId: 'task-1' },
      ]),
    ]);

    expect(validateArchiveContent(archive)).toEqual([]);
  });
});

describe('构建结果与 Blob 一致性', () => {
  it('内容与导出 Blob 字节一致', async () => {
    const bytes = Uint8Array.from([0, 0, 255, 128]);
    const archive = await buildArchive({
      assets: [
        {
          record: makeRecord('asset-1'),
          blob: makeBlob(bytes),
          references: [],
        },
      ],
      tasks: [],
      createdAt: CREATED_AT,
      includeSourceData: true,
    });

    expect(decodeBase64ToBytes(archive.assets[0]?.dataBase64 ?? '')).toEqual(
      bytes,
    );
    expect(await blobBytes(makeBlob(bytes))).toEqual(bytes);
  });
});
