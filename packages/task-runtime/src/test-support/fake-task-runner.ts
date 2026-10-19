/**
 * 执行器测试替身：让测试完全控制任务何时成功、失败或确认取消。
 */
import type { TaskError, TaskProgress } from '@itools/contracts';

import type {
  TaskExecution,
  TaskExecutionResult,
  TaskProgressReporter,
  TaskRunner,
  TaskStartRequest,
} from '../application/task-runner.js';

export class FakeExecution implements TaskExecution {
  readonly request: TaskStartRequest;
  readonly reporter: TaskProgressReporter;
  readonly done: Promise<TaskExecutionResult>;
  cancelRequestCount = 0;
  disposeCount = 0;

  private resolveDone: (result: TaskExecutionResult) => void = () => undefined;
  private isSettled = false;

  constructor(request: TaskStartRequest, reporter: TaskProgressReporter) {
    this.request = request;
    this.reporter = reporter;
    this.done = new Promise((resolve) => {
      this.resolveDone = resolve;
    });
  }

  requestCancel(): void {
    this.cancelRequestCount += 1;
  }

  dispose(): void {
    this.disposeCount += 1;
  }

  reportProgress(progress: TaskProgress): void {
    this.reporter.reportProgress(progress);
  }

  complete(output: unknown): void {
    this.settle({ status: 'completed', output });
  }

  fail(error: TaskError): void {
    this.settle({ status: 'failed', error });
  }

  confirmCancel(): void {
    this.settle({ status: 'cancelled' });
  }

  private settle(result: TaskExecutionResult): void {
    if (this.isSettled) return;
    this.isSettled = true;
    this.resolveDone(result);
  }
}

export class FakeTaskRunner implements TaskRunner {
  readonly executions: FakeExecution[] = [];
  startError: Error | undefined;

  start(
    request: TaskStartRequest,
    reporter: TaskProgressReporter,
  ): TaskExecution {
    if (this.startError !== undefined) throw this.startError;
    const execution = new FakeExecution(request, reporter);
    this.executions.push(execution);
    return execution;
  }

  find(taskId: string): FakeExecution | undefined {
    return this.executions.find((item) => item.request.taskId === taskId);
  }
}
