import { describe, expect, it } from 'vitest';

import type { ReferenceIntegrityInput } from './asset-types.js';
import { findReferenceIssues } from './reference-integrity.js';

function input(
  overrides: Partial<ReferenceIntegrityInput> = {},
): ReferenceIntegrityInput {
  return {
    assets: [
      { assetId: 'a1', role: 'source' },
      { assetId: 'a2', role: 'intermediate' },
      { assetId: 'a3', role: 'result' },
    ],
    references: [
      { assetId: 'a1', role: 'source', taskId: 't1' },
      { assetId: 'a2', role: 'intermediate', taskId: 't1' },
    ],
    ...overrides,
  };
}

describe('findReferenceIssues', () => {
  it('完全一致的引用不产生问题', () => {
    expect(findReferenceIssues(input())).toEqual([]);
  });

  it('空输入返回空数组', () => {
    expect(findReferenceIssues({ assets: [], references: [] })).toEqual([]);
  });

  it('空字符串或纯空白的 taskId 报 empty-task-id', () => {
    expect(
      findReferenceIssues(
        input({
          references: [
            { assetId: 'a1', role: 'source', taskId: '' },
            { assetId: 'a1', role: 'source', taskId: '   ' },
          ],
        }),
      ),
    ).toEqual([
      { assetId: 'a1', code: 'empty-task-id' },
      { assetId: 'a1', code: 'empty-task-id' },
    ]);
  });

  it('资产表里不存在该 assetId 时报 dangling-reference', () => {
    expect(
      findReferenceIssues(
        input({
          references: [{ assetId: 'missing', role: 'source', taskId: 't1' }],
        }),
      ),
    ).toEqual([{ assetId: 'missing', code: 'dangling-reference' }]);
  });

  it('悬空引用不会再与角色比较，只报 dangling-reference', () => {
    expect(
      findReferenceIssues(
        input({
          references: [{ assetId: 'missing', role: 'result', taskId: 't1' }],
        }),
      ),
    ).toEqual([{ assetId: 'missing', code: 'dangling-reference' }]);
  });

  it('taskId 为空且资产缺失时两条同时命中，empty-task-id 在前', () => {
    expect(
      findReferenceIssues(
        input({
          references: [{ assetId: 'missing', role: 'source', taskId: '' }],
        }),
      ),
    ).toEqual([
      { assetId: 'missing', code: 'empty-task-id' },
      { assetId: 'missing', code: 'dangling-reference' },
    ]);
  });

  it('角色不一致报 role-mismatch', () => {
    expect(
      findReferenceIssues(
        input({
          references: [{ assetId: 'a3', role: 'source', taskId: 't1' }],
        }),
      ),
    ).toEqual([{ assetId: 'a3', code: 'role-mismatch' }]);
  });

  it('输出保持输入顺序，同一资产的多次引用各自独立判定', () => {
    expect(
      findReferenceIssues(
        input({
          references: [
            { assetId: 'a2', role: 'source', taskId: 't1' },
            { assetId: 'ghost', role: 'source', taskId: 't2' },
            { assetId: 'a1', role: 'source', taskId: '' },
            { assetId: 'a2', role: 'intermediate', taskId: 't3' },
          ],
        }),
      ),
    ).toEqual([
      { assetId: 'a2', code: 'role-mismatch' },
      { assetId: 'ghost', code: 'dangling-reference' },
      { assetId: 'a1', code: 'empty-task-id' },
    ]);
  });
});
