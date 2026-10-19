/**
 * 集中配置的调度策略；工具与页面不得自行覆盖。
 * 数值是阶段 5 的初始预算，性能基线测量（阶段 11）后再交用户确认调整。
 */
import type { TaskSchedulerBudget } from '@itools/contracts';

const MEBIBYTE = 1024 * 1024;

export const DEFAULT_SCHEDULER_BUDGET: TaskSchedulerBudget = {
  maxConcurrentTasks: 4,
  maxTotalMemoryBytes: 1_536 * MEBIBYTE,
  perToolConcurrency: 1,
};

export const DEFAULT_MAX_QUEUE_LENGTH = 50;

/** 协作取消的等待上限；超过即终止并重建 Worker。 */
export const DEFAULT_CANCEL_TIMEOUT_MS = 2_000;
