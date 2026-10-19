/**
 * 公开入口：阶段 5 的任务运行时。
 * 分层：domain（纯规则）→ application（调度与生命周期）→ infrastructure（Worker 与协议）。
 */
export {
  DEFAULT_CANCEL_TIMEOUT_MS,
  DEFAULT_MAX_QUEUE_LENGTH,
  DEFAULT_SCHEDULER_BUDGET,
} from './application/scheduler-policy.js';
export { createTaskRuntime } from './application/task-runtime.js';
export type {
  TaskRuntime,
  TaskRuntimeOptions,
} from './application/task-runtime.js';
export type {
  TaskExecution,
  TaskExecutionResult,
  TaskProgressReporter,
  TaskRunner,
  TaskStartRequest,
} from './application/task-runner.js';
export type {
  TaskEventListener,
  TaskRuntimeEvent,
  TaskSnapshot,
  TaskSubmitInput,
} from './application/task-types.js';
export { TaskScheduler } from './application/task-scheduler.js';
export type { TaskSchedulerOptions } from './application/task-scheduler.js';
export {
  EMPTY_RESOURCE_USAGE,
  findBudgetConflict,
  isAdmissible,
  release,
  reserve,
} from './domain/resource-budget.js';
export type {
  BudgetConflict,
  ResourceUsage,
} from './domain/resource-budget.js';
export {
  TASK_ERROR_CODES,
  RuntimeDisposedError,
  TaskNotFoundError,
  createTaskError,
  toTaskError,
} from './domain/task-error.js';
export type { TaskErrorCode } from './domain/task-error.js';
export {
  TASK_TRANSITION_EVENTS,
  TERMINAL_TASK_STATUSES,
  TaskStateError,
  isTerminalStatus,
  nextStatus,
  transitionStatus,
} from './domain/task-state.js';
export type { TaskTransitionEvent } from './domain/task-state.js';
export type { TimerApi } from './infrastructure/timer.js';
export { EngineWorkerPool } from './infrastructure/worker/worker-pool.js';
export type {
  WorkerLease,
  WorkerLike,
  WorkerListener,
  WorkerListenerEvent,
  WorkerPool,
  WorkerPoolOptions,
} from './infrastructure/worker/worker-pool.js';
export {
  WorkerProtocolError,
  decodeOutboundMessage,
} from './infrastructure/worker/worker-messages.js';
export { createWorkerRunner } from './infrastructure/worker/worker-runner.js';
export type { WorkerRunnerOptions } from './infrastructure/worker/worker-runner.js';
