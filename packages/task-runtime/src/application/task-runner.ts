/**
 * 执行器契约：调度器只认识 TaskRunner，不关心是 Worker、WASM 还是同线程 fixture。
 * 这是阶段 5 允许“无真实工具也能验收”的关键接缝。
 */
import type { TaskError, TaskProgress } from '@itools/contracts';

export interface TaskStartRequest {
  readonly taskId: string;
  readonly toolId: string;
  readonly engine: string;
  readonly input: unknown;
}

export interface TaskProgressReporter {
  reportProgress(progress: TaskProgress): void;
}

export type TaskExecutionResult =
  | { readonly status: 'completed'; readonly output: unknown }
  | { readonly status: 'failed'; readonly error: TaskError }
  | { readonly status: 'cancelled' };

export interface TaskExecution {
  /** 只会 resolve 一次；执行器的任何内部异常都必须收敛为 failed。 */
  readonly done: Promise<TaskExecutionResult>;
  /** 请求协作取消；不保证立刻停止。 */
  requestCancel(): void;
  /** 释放底层资源；必须幂等。 */
  dispose(): void;
}

export interface TaskRunner {
  start(
    request: TaskStartRequest,
    reporter: TaskProgressReporter,
  ): TaskExecution;
}
