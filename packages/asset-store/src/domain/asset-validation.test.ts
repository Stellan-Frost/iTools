import { describe, expect, it } from 'vitest';

import type { AssetDraft } from './asset-types.js';
import {
  AssetValidationError,
  assertValidAssetDraft,
  validateAssetDraft,
} from './asset-validation.js';

function draft(overrides: Partial<AssetDraft> = {}): AssetDraft {
  return {
    name: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_024,
    role: 'source',
    ...overrides,
  };
}

describe('validateAssetDraft', () => {
  it('接受合法的草稿，包括 0 字节与首尾带空格但非空的名字', () => {
    expect(validateAssetDraft(draft())).toEqual([]);
    expect(validateAssetDraft(draft({ sizeBytes: 0 }))).toEqual([]);
    expect(validateAssetDraft(draft({ name: '  report.pdf  ' }))).toEqual([]);
  });

  it('把空字符串与纯空白名字判为 empty', () => {
    expect(validateAssetDraft(draft({ name: '' }))).toEqual([
      { field: 'name', code: 'empty' },
    ]);
    expect(validateAssetDraft(draft({ name: '   ' }))).toEqual([
      { field: 'name', code: 'empty' },
    ]);
  });

  it('名字长度以 255 为上限，256 报 too-long', () => {
    expect(validateAssetDraft(draft({ name: 'a'.repeat(255) }))).toEqual([]);
    expect(validateAssetDraft(draft({ name: 'a'.repeat(256) }))).toEqual([
      { field: 'name', code: 'too-long' },
    ]);
  });

  it('拒绝含正反斜杠的路径分隔符，即使只有一处也只报一次', () => {
    expect(validateAssetDraft(draft({ name: 'docs/report.pdf' }))).toEqual([
      { field: 'name', code: 'path-separator' },
    ]);
    expect(validateAssetDraft(draft({ name: 'docs\\report.pdf' }))).toEqual([
      { field: 'name', code: 'path-separator' },
    ]);
    expect(validateAssetDraft(draft({ name: 'a/b\\c' }))).toEqual([
      { field: 'name', code: 'path-separator' },
    ]);
  });

  it('识别控制字符（含 \\u0000 与 \\u007f）', () => {
    expect(validateAssetDraft(draft({ name: 're\u0000port.pdf' }))).toEqual([
      { field: 'name', code: 'control-character' },
    ]);
    expect(validateAssetDraft(draft({ name: 'report\u007f.pdf' }))).toEqual([
      { field: 'name', code: 'control-character' },
    ]);
  });

  it('MIME 为空、超长与形状非法分别报告；128 字符内合法形状通过', () => {
    expect(validateAssetDraft(draft({ mimeType: '  ' }))).toEqual([
      { field: 'mimeType', code: 'empty' },
    ]);
    expect(
      validateAssetDraft(draft({ mimeType: `${'a'.repeat(130)}/plain` })),
    ).toEqual([{ field: 'mimeType', code: 'too-long' }]);
    expect(validateAssetDraft(draft({ mimeType: 'plain' }))).toEqual([
      { field: 'mimeType', code: 'invalid-mime' },
    ]);
    expect(validateAssetDraft(draft({ mimeType: 'image/png' }))).toEqual([]);
  });

  it('MIME 恰好 128 字符通过，129 字符报 too-long', () => {
    const exact = `${'a'.repeat(124)}/png`;
    expect(exact).toHaveLength(128);
    expect(validateAssetDraft(draft({ mimeType: exact }))).toEqual([]);
    expect(
      validateAssetDraft(draft({ mimeType: `${'a'.repeat(125)}/png` })),
    ).toEqual([{ field: 'mimeType', code: 'too-long' }]);
  });

  it('非整数尺寸（小数、NaN、Infinity）报 not-integer，负数报 negative-size', () => {
    expect(validateAssetDraft(draft({ sizeBytes: 1.5 }))).toEqual([
      { field: 'sizeBytes', code: 'not-integer' },
    ]);
    expect(validateAssetDraft(draft({ sizeBytes: Number.NaN }))).toEqual([
      { field: 'sizeBytes', code: 'not-integer' },
    ]);
    expect(
      validateAssetDraft(draft({ sizeBytes: Number.POSITIVE_INFINITY })),
    ).toEqual([{ field: 'sizeBytes', code: 'not-integer' }]);
    expect(validateAssetDraft(draft({ sizeBytes: -1 }))).toEqual([
      { field: 'sizeBytes', code: 'negative-size' },
    ]);
  });

  it('未知角色报 unknown-role（运行时数据可能来自反序列化）', () => {
    const unknownRole = {
      ...draft(),
      role: 'archive',
    } as unknown as AssetDraft;
    expect(validateAssetDraft(unknownRole)).toEqual([
      { field: 'role', code: 'unknown-role' },
    ]);
  });

  it('多字段同时出错时按 name → mimeType → sizeBytes → role 的固定顺序返回', () => {
    const broken = {
      name: 'a/b\u0001',
      mimeType: 'nope',
      sizeBytes: -3.5,
      role: 'other',
    } as unknown as AssetDraft;

    expect(validateAssetDraft(broken)).toEqual([
      { field: 'name', code: 'path-separator' },
      { field: 'name', code: 'control-character' },
      { field: 'mimeType', code: 'invalid-mime' },
      { field: 'sizeBytes', code: 'not-integer' },
      { field: 'role', code: 'unknown-role' },
    ]);
  });

  it('同一字段的多条规则可同时命中（超长 + 分隔符）', () => {
    const issues = validateAssetDraft(draft({ name: `${'a'.repeat(255)}/b` }));

    expect(issues).toEqual([
      { field: 'name', code: 'too-long' },
      { field: 'name', code: 'path-separator' },
    ]);
  });
});

describe('assertValidAssetDraft', () => {
  it('合法草稿不抛错', () => {
    expect(() => assertValidAssetDraft(draft())).not.toThrow();
  });

  it('非法草稿抛出 AssetValidationError，并带上 code 与全部 issues', () => {
    let caught: unknown;
    try {
      assertValidAssetDraft(draft({ name: '', mimeType: 'x', sizeBytes: -1 }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AssetValidationError);
    const validationError = caught as AssetValidationError;
    expect(validationError.code).toBe('invalid-asset-draft');
    expect(validationError.issues).toEqual([
      { field: 'name', code: 'empty' },
      { field: 'mimeType', code: 'invalid-mime' },
      { field: 'sizeBytes', code: 'negative-size' },
    ]);
  });
});
