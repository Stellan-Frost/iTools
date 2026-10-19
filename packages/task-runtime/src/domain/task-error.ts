/**
 * 任务错误的统一构造：稳定错误码 + i18n 文案键 + 是否可重试。
 * 不得把堆栈、内部路径或用户数据放进 detail。
 */
import type { TaskError } from '@itools/contracts';

export const TASK_ERROR_CODES = {
  queueFull: 'queue-full',
  workerStartFailed: 'worker-start-failed',
  workerCrashed: 'worker-crashed',
  protocolViolation: 'protocol-violation',
  resultCommitFailed: 'result-commit-failed',
  executionFailed: 'execution-failed',
  runtimeDisposed: 'runtime-disposed',
  taskNotFound: 'task-not-found',
} as const;

export type TaskErrorCode =
  (typeof TASK_ERROR_CODES)[keyof typeof TASK_ERROR_CODES];

const RETRYABLE_CODES: readonly TaskErrorCode[] = [
  TASK_ERROR_CODES.queueFull,
  TASK_ERROR_CODES.workerStartFailed,
  TASK_ERROR_CODES.workerCrashed,
  TASK_ERROR_CODES.executionFailed,
];

export function createTaskError(
  code: TaskErrorCode,
  options: { detail?: string } = {},
): TaskError {
  const error: TaskError = {
    code,
    messageKey: `tasks:error.${code}`,
    retryable: RETRYABLE_CODES.includes(code),
  };
  return options.detail === undefined
    ? error
    : { ...error, detail: options.detail };
}

/** 把未知异常收敛成稳定错误，避免把原始信息透给用户。 */
export function toTaskError(reason: unknown): TaskError {
  if (isTaskError(reason)) return reason;
  return createTaskError(TASK_ERROR_CODES.executionFailed);
}

function isTaskError(value: unknown): value is TaskError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TaskError>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.messageKey === 'string' &&
    typeof candidate.retryable === 'boolean'
  );
}

/** 已取消的任务再次取消或取消未知任务时的稳定失败。 */
export class TaskNotFoundError extends Error {
  readonly code = TASK_ERROR_CODES.taskNotFound;

  constructor(taskId: string) {
    super(`任务不存在：${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

/** 运行时销毁后再提交任务是编程错误，直接拒绝而不是伪造失败任务。 */
export class RuntimeDisposedError extends Error {
  readonly code = TASK_ERROR_CODES.runtimeDisposed;

  constructor() {
    super('任务运行时已销毁，无法提交新任务');
    this.name = 'RuntimeDisposedError';
  }
}
