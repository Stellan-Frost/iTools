/**
 * Worker 执行器：把一次任务映射为一个 Worker 租约。
 * 取消协议：先发 cancel 等待协作确认；超时则终止 Worker 并重建（discard）。
 */
import { TASK_ERROR_CODES, createTaskError } from '../../domain/task-error.js';
import type {
  TaskExecution,
  TaskExecutionResult,
  TaskProgressReporter,
  TaskRunner,
  TaskStartRequest,
} from '../../application/task-runner.js';
import type { TimerApi } from '../timer.js';
import {
  WorkerProtocolError,
  decodeOutboundMessage,
} from './worker-messages.js';
import type {
  WorkerLease,
  WorkerListenerEvent,
  WorkerPool,
} from './worker-pool.js';

export interface WorkerRunnerOptions {
  readonly pool: WorkerPool;
  readonly timer: TimerApi;
  readonly cancelTimeoutMs: number;
}

interface SettleOptions {
  readonly discardWorker: boolean;
}

export function createWorkerRunner(options: WorkerRunnerOptions): TaskRunner {
  return {
    start: (request, reporter) => startWorkerTask(options, request, reporter),
  };
}

function startWorkerTask(
  options: WorkerRunnerOptions,
  request: TaskStartRequest,
  reporter: TaskProgressReporter,
): TaskExecution {
  let isSettled = false;
  let isCancelRequested = false;
  let lease: WorkerLease | undefined;
  let cancelTimer: unknown;
  let hasCancelTimer = false;
  let resolveDone: (result: TaskExecutionResult) => void = () => undefined;

  const done = new Promise<TaskExecutionResult>((resolve) => {
    resolveDone = resolve;
  });

  function settle(
    result: TaskExecutionResult,
    settleOptions: SettleOptions,
  ): void {
    if (isSettled) return;
    isSettled = true;
    if (hasCancelTimer) {
      options.timer.clear(cancelTimer);
      hasCancelTimer = false;
    }
    if (lease !== undefined) {
      lease.worker.removeEventListener('message', onMessage);
      lease.worker.removeEventListener('error', onError);
      lease.release({ discard: settleOptions.discardWorker });
      lease = undefined;
    }
    resolveDone(result);
  }

  function onMessage(event: WorkerListenerEvent): void {
    let message;
    try {
      message = decodeOutboundMessage(event.data);
    } catch (error) {
      if (error instanceof WorkerProtocolError) {
        settle(
          {
            status: 'failed',
            error: createTaskError(TASK_ERROR_CODES.protocolViolation),
          },
          { discardWorker: true },
        );
        return;
      }
      throw error;
    }

    if (message.type === 'progress') {
      if (message.progress.taskId === request.taskId) {
        reporter.reportProgress(message.progress);
      }
      return;
    }
    if (message.taskId !== request.taskId) return;

    switch (message.type) {
      case 'complete':
        settle(
          { status: 'completed', output: message.output },
          { discardWorker: false },
        );
        return;
      case 'error':
        settle(
          { status: 'failed', error: message.error },
          { discardWorker: true },
        );
        return;
      case 'cancelled':
        settle({ status: 'cancelled' }, { discardWorker: false });
        return;
    }
  }

  function onError(): void {
    settle(
      {
        status: 'failed',
        error: createTaskError(TASK_ERROR_CODES.workerCrashed),
      },
      { discardWorker: true },
    );
  }

  async function run(): Promise<void> {
    let acquired: WorkerLease;
    try {
      acquired = await options.pool.acquire(request.engine);
    } catch {
      settle(
        {
          status: 'failed',
          error: createTaskError(TASK_ERROR_CODES.workerStartFailed),
        },
        { discardWorker: false },
      );
      return;
    }
    if (isSettled) {
      acquired.release({ discard: true });
      return;
    }
    lease = acquired;
    acquired.worker.addEventListener('message', onMessage);
    acquired.worker.addEventListener('error', onError);

    // 取消先于启动：不发送 start，直接终止并确认取消。
    if (isCancelRequested) {
      settle({ status: 'cancelled' }, { discardWorker: true });
      return;
    }
    acquired.worker.postMessage({
      type: 'start',
      taskId: request.taskId,
      input: request.input,
    });
  }

  void run();

  return {
    done,
    requestCancel: () => {
      if (isSettled || isCancelRequested) return;
      isCancelRequested = true;
      if (lease === undefined) return;
      lease.worker.postMessage({ type: 'cancel', taskId: request.taskId });
      hasCancelTimer = true;
      cancelTimer = options.timer.set(options.cancelTimeoutMs, () => {
        settle({ status: 'cancelled' }, { discardWorker: true });
      });
    },
    dispose: () => {
      settle({ status: 'cancelled' }, { discardWorker: true });
    },
  };
}
