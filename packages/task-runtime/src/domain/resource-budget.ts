/**
 * 资源预算：纯函数计算占用与准入，不持有任何状态。
 * 调度器只在“总并发、总内存、单工具并发”三重限制内放行任务。
 */
import type {
  TaskResourceRequest,
  TaskSchedulerBudget,
} from '@itools/contracts';

export interface ResourceUsage {
  readonly runningTaskCount: number;
  readonly reservedMemoryBytes: number;
  readonly runningPerTool: Readonly<Record<string, number>>;
}

export type BudgetConflict = 'concurrency' | 'memory' | 'tool-concurrency';

export const EMPTY_RESOURCE_USAGE: ResourceUsage = {
  runningTaskCount: 0,
  reservedMemoryBytes: 0,
  runningPerTool: {},
};

export function reserve(
  usage: ResourceUsage,
  toolId: string,
  memoryBytes: number,
): ResourceUsage {
  return {
    runningTaskCount: usage.runningTaskCount + 1,
    reservedMemoryBytes: usage.reservedMemoryBytes + memoryBytes,
    runningPerTool: {
      ...usage.runningPerTool,
      [toolId]: (usage.runningPerTool[toolId] ?? 0) + 1,
    },
  };
}

export function release(
  usage: ResourceUsage,
  toolId: string,
  memoryBytes: number,
): ResourceUsage {
  const toolCount = (usage.runningPerTool[toolId] ?? 0) - 1;
  const runningPerTool: Record<string, number> = { ...usage.runningPerTool };
  if (toolCount > 0) {
    runningPerTool[toolId] = toolCount;
  } else {
    delete runningPerTool[toolId];
  }
  return {
    runningTaskCount: Math.max(0, usage.runningTaskCount - 1),
    reservedMemoryBytes: Math.max(0, usage.reservedMemoryBytes - memoryBytes),
    runningPerTool,
  };
}

/** 返回首个不满足的约束；undefined 表示可以放行。 */
export function findBudgetConflict(
  budget: TaskSchedulerBudget,
  usage: ResourceUsage,
  toolId: string,
  request: TaskResourceRequest,
): BudgetConflict | undefined {
  if (usage.runningTaskCount >= budget.maxConcurrentTasks) {
    return 'concurrency';
  }
  if (
    usage.reservedMemoryBytes + request.estimatedMemoryBytes >
    budget.maxTotalMemoryBytes
  ) {
    return 'memory';
  }
  if ((usage.runningPerTool[toolId] ?? 0) >= budget.perToolConcurrency) {
    return 'tool-concurrency';
  }
  return undefined;
}

export function isAdmissible(
  budget: TaskSchedulerBudget,
  usage: ResourceUsage,
  toolId: string,
  request: TaskResourceRequest,
): boolean {
  return findBudgetConflict(budget, usage, toolId, request) === undefined;
}
