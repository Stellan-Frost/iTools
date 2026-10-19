import { describe, expect, it } from 'vitest';

import type { AssetRole } from '@itools/contracts';

import { DEFAULT_SOURCE_RETENTION_MS } from './asset-types.js';
import type { RetentionInput } from './asset-types.js';
import { planRetention } from './retention.js';

const NOW = new Date('2026-01-08T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1_000;

function asset(
  assetId: string,
  createdAt: string,
  role: AssetRole = 'source',
  taskId?: string,
) {
  return taskId === undefined
    ? { assetId, role, createdAt }
    : { assetId, role, createdAt, taskId };
}

function input(overrides: Partial<RetentionInput> = {}): RetentionInput {
  return {
    assets: [],
    references: [],
    now: NOW,
    retentionMs: DEFAULT_SOURCE_RETENTION_MS,
    activeTaskIds: [],
    ...overrides,
  };
}

describe('planRetention', () => {
  it('超过保留期的源文件进入 remove', () => {
    const plan = planRetention(
      input({ assets: [asset('old', '2025-12-01T00:00:00.000Z')] }),
    );

    expect(plan).toEqual({ keep: [], remove: ['old'], skipped: [] });
  });

  it('未到期的源文件保留，且不算 skipped', () => {
    const plan = planRetention(
      input({ assets: [asset('fresh', '2026-01-07T00:00:00.000Z')] }),
    );

    expect(plan).toEqual({ keep: ['fresh'], remove: [], skipped: [] });
  });

  it('恰好到期（createdAt + retentionMs === now）即可删除', () => {
    const createdAt = new Date(
      NOW.getTime() - DEFAULT_SOURCE_RETENTION_MS,
    ).toISOString();
    const justInside = new Date(
      NOW.getTime() - DEFAULT_SOURCE_RETENTION_MS + 1,
    ).toISOString();

    const plan = planRetention(
      input({
        assets: [asset('edge', createdAt), asset('inside', justInside)],
      }),
    );

    expect(plan.remove).toEqual(['edge']);
    expect(plan.keep).toEqual(['inside']);
  });

  it('中间产物与结果一律保留，原因为 not-source', () => {
    const plan = planRetention(
      input({
        assets: [
          asset('mid', '2020-01-01T00:00:00.000Z', 'intermediate'),
          asset('out', '2020-01-01T00:00:00.000Z', 'result'),
        ],
      }),
    );

    expect(plan).toEqual({
      keep: ['mid', 'out'],
      remove: [],
      skipped: [
        { assetId: 'mid', reason: 'not-source' },
        { assetId: 'out', reason: 'not-source' },
      ],
    });
  });

  it('被引用过的过期源文件保留，原因为 referenced', () => {
    const plan = planRetention(
      input({
        assets: [asset('used', '2020-01-01T00:00:00.000Z')],
        references: [{ assetId: 'used' }],
      }),
    );

    expect(plan).toEqual({
      keep: ['used'],
      remove: [],
      skipped: [{ assetId: 'used', reason: 'referenced' }],
    });
  });

  it('活跃任务的过期源文件保留，原因为 active-task', () => {
    const plan = planRetention(
      input({
        assets: [asset('running', '2020-01-01T00:00:00.000Z', 'source', 't1')],
        activeTaskIds: ['t1'],
      }),
    );

    expect(plan).toEqual({
      keep: ['running'],
      remove: [],
      skipped: [{ assetId: 'running', reason: 'active-task' }],
    });
  });

  it('优先级为 not-source > referenced > active-task', () => {
    const plan = planRetention(
      input({
        assets: [
          asset('result', '2020-01-01T00:00:00.000Z', 'result', 't1'),
          asset('ref', '2020-01-01T00:00:00.000Z', 'source', 't1'),
        ],
        references: [{ assetId: 'result' }, { assetId: 'ref' }],
        activeTaskIds: ['t1'],
      }),
    );

    expect(plan.skipped).toEqual([
      { assetId: 'result', reason: 'not-source' },
      { assetId: 'ref', reason: 'referenced' },
    ]);
  });

  it('createdAt 无法解析时保守保留，且不产生 skipped 条目', () => {
    const plan = planRetention(
      input({
        assets: [
          asset('broken', 'not-a-date'),
          asset('also-broken', ''),
          asset('ok', '2020-01-01T00:00:00.000Z'),
        ],
      }),
    );

    expect(plan).toEqual({
      keep: ['broken', 'also-broken'],
      remove: ['ok'],
      skipped: [],
    });
  });

  it('remove 按 createdAt 升序，同一时间按 assetId 升序', () => {
    const plan = planRetention(
      input({
        assets: [
          asset('b', '2020-01-02T00:00:00.000Z'),
          asset('z', '2020-01-01T00:00:00.000Z'),
          asset('a', '2020-01-02T00:00:00.000Z'),
          asset('c', '2019-12-31T00:00:00.000Z'),
        ],
      }),
    );

    expect(plan.remove).toEqual(['c', 'z', 'a', 'b']);
  });

  it('keep 与 skipped 保持资产输入顺序，与 remove 的排序互不影响', () => {
    const plan = planRetention(
      input({
        assets: [
          asset('keep-2', '2026-01-07T00:00:00.000Z'),
          asset('drop-late', '2020-01-02T00:00:00.000Z'),
          asset('keep-1', '2026-01-07T00:00:00.000Z', 'source', 't1'),
          asset('drop-early', '2020-01-01T00:00:00.000Z'),
        ],
        activeTaskIds: ['t1'],
      }),
    );

    expect(plan.keep).toEqual(['keep-2', 'keep-1']);
    expect(plan.skipped).toEqual([
      { assetId: 'keep-1', reason: 'active-task' },
    ]);
    expect(plan.remove).toEqual(['drop-early', 'drop-late']);
  });

  it('保留期为 0 时，创建时间不晚于 now 的源文件全部可删', () => {
    const plan = planRetention(
      input({
        assets: [
          asset('exact', NOW.toISOString()),
          asset('future', new Date(NOW.getTime() + DAY).toISOString()),
        ],
        retentionMs: 0,
      }),
    );

    expect(plan.remove).toEqual(['exact']);
    expect(plan.keep).toEqual(['future']);
  });

  it('相同输入的两次调用结果一致（不依赖当前时钟）', () => {
    const once = planRetention(
      input({ assets: [asset('x', '2020-01-01T00:00:00.000Z')] }),
    );
    const twice = planRetention(
      input({ assets: [asset('x', '2020-01-01T00:00:00.000Z')] }),
    );

    expect(once).toEqual(twice);
  });
});
