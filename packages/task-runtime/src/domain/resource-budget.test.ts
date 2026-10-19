import { describe, expect, it } from 'vitest';
import type { TaskSchedulerBudget } from '@itools/contracts';

import {
  EMPTY_RESOURCE_USAGE,
  findBudgetConflict,
  isAdmissible,
  release,
  reserve,
} from './resource-budget.js';

const BUDGET: TaskSchedulerBudget = {
  maxConcurrentTasks: 2,
  maxTotalMemoryBytes: 1_000,
  perToolConcurrency: 1,
};

const SMALL = { estimatedMemoryBytes: 200, computeClass: 'light' as const };
const LARGE = { estimatedMemoryBytes: 900, computeClass: 'heavy' as const };

describe('资源预算', () => {
  it('预留与释放保持对称', () => {
    const reserved = reserve(EMPTY_RESOURCE_USAGE, 'image-compress', 200);
    expect(reserved.runningTaskCount).toBe(1);
    expect(reserved.reservedMemoryBytes).toBe(200);
    expect(reserved.runningPerTool['image-compress']).toBe(1);

    const released = release(reserved, 'image-compress', 200);
    expect(released).toEqual(EMPTY_RESOURCE_USAGE);
  });

  it('未知工具释放不会出现负占用', () => {
    const released = release(EMPTY_RESOURCE_USAGE, 'missing-tool', 500);
    expect(released.runningTaskCount).toBe(0);
    expect(released.reservedMemoryBytes).toBe(0);
    expect(released.runningPerTool).toEqual({});
  });

  it('达到总并发上限时拒绝放行', () => {
    const usage = reserve(reserve(EMPTY_RESOURCE_USAGE, 'a', 100), 'b', 100);
    expect(findBudgetConflict(BUDGET, usage, 'c', SMALL)).toBe('concurrency');
    expect(isAdmissible(BUDGET, usage, 'c', SMALL)).toBe(false);
  });

  it('累计内存超过预算时拒绝放行', () => {
    const usage = reserve(EMPTY_RESOURCE_USAGE, 'a', 900);
    expect(findBudgetConflict(BUDGET, usage, 'b', LARGE)).toBe('memory');
  });

  it('同一工具达到单工具并发上限时拒绝放行', () => {
    const usage = reserve(EMPTY_RESOURCE_USAGE, 'a', 100);
    expect(findBudgetConflict(BUDGET, usage, 'a', SMALL)).toBe(
      'tool-concurrency',
    );
    expect(findBudgetConflict(BUDGET, usage, 'b', SMALL)).toBeUndefined();
  });

  it('预算充足时放行并保持工具计数独立', () => {
    const usage = reserve(EMPTY_RESOURCE_USAGE, 'a', 100);
    expect(isAdmissible(BUDGET, usage, 'b', SMALL)).toBe(true);
    const both = reserve(usage, 'b', 100);
    expect(both.runningPerTool).toEqual({ a: 1, b: 1 });
  });
});
