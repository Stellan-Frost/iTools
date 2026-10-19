/**
 * 任务调度器：全局 FIFO + 资源感知并发。
 * 职责边界：只做准入、状态流转、事件广播；不执行计算、不持久化结果。
 */
import type { TaskProgress, TaskSchedulerBudget } from '@itools/contracts';

import {
  EMPTY_RESOURCE_USAGE,
  findBudgetConflict,
  release,
  reserve,
} from '../domain/resource-budget.js';
import type { ResourceUsage } from '../domain/resource-budget.js';
import {
  RuntimeDisposedError,
  TASK_ERROR_CODES,
  TaskNotFoundError,
  createTaskError,
  toTaskError,
} from '../domain/task-error.js';
import { isTerminalStatus, transitionStatus } from '../domain/task-state.js';
import type { TaskTransitionEvent } from '../domain/task-state.js';
import type {
  TaskExecution,
  TaskExecutionResult,
  TaskRunner,
} from './task-runner.js';
import type {
  TaskRuntimeEvent,
  TaskSnapshot,
  TaskSubmitInput,
} from './task-types.js';

export interface TaskSchedulerOptions {
  readonly runner: TaskRunner;
  readonly budget: TaskSchedulerBudget;
  readonly commitResult: (
    taskId: string,
    output: unknown,
  ) => Promise<readonly string[]>;
  readonly now: () => string;
  readonly createTaskId: () => string;
  readonly maxQueueLength: number;
  readonly onEvent: (event: TaskRuntimeEvent) => void;
}

/** 状态更新时允许同时写入的附加字段。 */
interface TransitionChanges {
  readonly error?: NonNullable<TaskSnapshot['error']>;
  readonly resultAssetIds?: readonly string[];
}

export class TaskScheduler {
  private readonly options: TaskSchedulerOptions;
  private readonly records = new Map<string, TaskSnapshot>();
  private readonly submissions = new Map<string, TaskSubmitInput>();
  private readonly executions = new Map<string, TaskExecution>();
  private readonly counted = new Set<string>();
  private readonly queue: string[] = [];
  private usage: ResourceUsage = EMPTY_RESOURCE_USAGE;
  private isDisposed = false;

  constructor(options: TaskSchedulerOptions) {
    this.options = options;
  }

  submit(input: TaskSubmitInput): TaskSnapshot {
    if (this.isDisposed) throw new RuntimeDisposedError();

    const taskId = this.options.createTaskId();
    const timestamp = this.options.now();
    const queued: TaskSnapshot = {
      taskId,
      toolId: input.toolId,
      status: 'queued',
      createdAt: timestamp,
      updatedAt: timestamp,
      resultAssetIds: [],
    };
    this.records.set(taskId, queued);
    this.submissions.set(taskId, input);
    this.publish(taskId);

    if (this.queue.length >= this.options.maxQueueLength) {
      this.failTask(taskId, createTaskError(TASK_ERROR_CODES.queueFull));
      return this.requireRecord(taskId);
    }

    this.queue.push(taskId);
    this.pump();
    return this.requireRecord(taskId);
  }

  cancel(taskId: string): void {
    const record = this.requireRecord(taskId);
    if (isTerminalStatus(record.status)) return;

    if (record.status === 'queued') {
      this.removeFromQueue(taskId);
      this.applyTransition(taskId, 'request-cancel');
      return;
    }

    if (record.status === 'preparing' || record.status === 'running') {
      this.applyTransition(taskId, 'request-cancel');
      this.executions.get(taskId)?.requestCancel();
    }
    // 已在 cancelling：重复取消是幂等的。
  }

  getTask(taskId: string): TaskSnapshot | undefined {
    return this.records.get(taskId);
  }

  listTasks(): readonly TaskSnapshot[] {
    return [...this.records.values()];
  }

  /** 销毁运行时：排队任务直接取消，运行中任务先请求取消再确认。 */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.queue.length = 0;

    for (const record of [...this.records.values()]) {
      if (isTerminalStatus(record.status)) continue;
      if (record.status === 'queued') {
        this.applyTransition(record.taskId, 'request-cancel');
        continue;
      }
      // preparing / running：两步取消，保留状态机权威性。
      this.applyTransition(record.taskId, 'request-cancel');
      this.applyTransition(record.taskId, 'confirm-cancel');
      this.executions.get(record.taskId)?.dispose();
      this.releaseUsage(record.taskId);
    }
    this.executions.clear();
  }

  private pump(): void {
    while (!this.isDisposed) {
      const taskId = this.takeAdmissibleTask();
      if (taskId === undefined) return;
      this.startTask(taskId);
    }
  }

  /** FIFO 基础上的轻量任务先行：只跳过当前放不下的任务，不改变其余顺序。 */
  private takeAdmissibleTask(): string | undefined {
    for (let index = 0; index < this.queue.length; index += 1) {
      const taskId = this.queue[index];
      if (taskId === undefined) continue;
      const record = this.records.get(taskId);
      const submission = this.submissions.get(taskId);
      if (record === undefined || submission === undefined) {
        this.queue.splice(index, 1);
        return undefined;
      }
      const conflict = findBudgetConflict(
        this.options.budget,
        this.usage,
        record.toolId,
        submission.resources,
      );
      if (conflict === undefined) {
        this.queue.splice(index, 1);
        return taskId;
      }
    }
    return undefined;
  }

  private startTask(taskId: string): void {
    const record = this.requireRecord(taskId);
    const submission = this.submissions.get(taskId);
    if (submission === undefined) return;

    this.applyTransition(taskId, 'prepare');
    this.usage = reserve(
      this.usage,
      record.toolId,
      submission.resources.estimatedMemoryBytes,
    );
    this.counted.add(taskId);

    let execution: TaskExecution;
    try {
      execution = this.options.runner.start(
        {
          taskId,
          toolId: record.toolId,
          engine: submission.engine,
          input: submission.input,
        },
        { reportProgress: (progress) => this.handleProgress(taskId, progress) },
      );
    } catch {
      this.failTask(
        taskId,
        createTaskError(TASK_ERROR_CODES.workerStartFailed),
      );
      return;
    }

    this.executions.set(taskId, execution);
    if (this.requireRecord(taskId).status === 'preparing') {
      this.applyTransition(taskId, 'start');
    }

    void execution.done.then(
      (result) => {
        void this.finish(taskId, result);
      },
      (reason: unknown) => {
        void this.finish(taskId, {
          status: 'failed',
          error: toTaskError(reason),
        });
      },
    );
  }

  private async finish(
    taskId: string,
    result: TaskExecutionResult,
  ): Promise<void> {
    const execution = this.executions.get(taskId);
    this.executions.delete(taskId);
    execution?.dispose();

    const record = this.records.get(taskId);
    if (record === undefined) return;

    // 取消优先：取消确认后到达的结果一律丢弃，不得写入资产。
    if (record.status === 'cancelling') {
      this.confirmCancellation(taskId);
      this.releaseUsage(taskId);
      return;
    }
    if (isTerminalStatus(record.status)) {
      this.releaseUsage(taskId);
      return;
    }

    if (result.status === 'failed') {
      this.failTask(taskId, result.error);
      return;
    }

    if (result.status === 'cancelled') {
      this.applyTransition(taskId, 'request-cancel');
      this.confirmCancellation(taskId);
      this.releaseUsage(taskId);
      return;
    }

    let assetIds: readonly string[];
    try {
      assetIds = await this.options.commitResult(taskId, result.output);
    } catch {
      this.failTask(
        taskId,
        createTaskError(TASK_ERROR_CODES.resultCommitFailed),
      );
      return;
    }

    // 提交流程期间用户可能已取消，此时不得标记完成。
    if (this.requireRecord(taskId).status === 'cancelling') {
      this.confirmCancellation(taskId);
      this.releaseUsage(taskId);
      return;
    }

    this.applyTransition(taskId, 'complete', { resultAssetIds: assetIds });
    this.releaseUsage(taskId);
  }

  private handleProgress(taskId: string, progress: TaskProgress): void {
    const record = this.records.get(taskId);
    if (record === undefined || record.status !== 'running') return;
    // 进度必须属于本任务，防止错配的 Worker 消息污染其它任务。
    if (progress.taskId !== taskId) return;
    this.records.set(taskId, {
      ...record,
      progress,
      updatedAt: this.options.now(),
    });
    this.publish(taskId);
  }

  private failTask(
    taskId: string,
    error: NonNullable<TaskSnapshot['error']>,
  ): void {
    this.removeFromQueue(taskId);
    const record = this.records.get(taskId);
    if (record === undefined || isTerminalStatus(record.status)) return;
    this.applyTransition(taskId, 'fail', { error });
    this.releaseUsage(taskId);
  }

  private confirmCancellation(taskId: string): void {
    if (this.records.get(taskId)?.status !== 'cancelling') return;
    this.applyTransition(taskId, 'confirm-cancel');
  }

  private applyTransition(
    taskId: string,
    event: TaskTransitionEvent,
    changes: TransitionChanges = {},
  ): void {
    const record = this.requireRecord(taskId);
    const status = transitionStatus(record.status, event);
    const updated: TaskSnapshot = {
      ...record,
      status,
      updatedAt: this.options.now(),
      ...(changes.resultAssetIds === undefined
        ? {}
        : { resultAssetIds: changes.resultAssetIds }),
      ...(changes.error === undefined ? {} : { error: changes.error }),
    };
    this.records.set(taskId, updated);
    this.publish(taskId);
  }

  private releaseUsage(taskId: string): void {
    if (!this.counted.delete(taskId)) return;
    const record = this.records.get(taskId);
    const submission = this.submissions.get(taskId);
    if (record === undefined || submission === undefined) return;
    this.usage = release(
      this.usage,
      record.toolId,
      submission.resources.estimatedMemoryBytes,
    );
    this.pump();
  }

  private removeFromQueue(taskId: string): void {
    const index = this.queue.indexOf(taskId);
    if (index >= 0) this.queue.splice(index, 1);
  }

  private publish(taskId: string): void {
    const task = this.records.get(taskId);
    if (task === undefined) return;
    this.options.onEvent({ type: 'task-updated', task });
  }

  private requireRecord(taskId: string): TaskSnapshot {
    const record = this.records.get(taskId);
    if (record === undefined) throw new TaskNotFoundError(taskId);
    return record;
  }
}
