/**
 * 任务运行时外观：全局唯一实例，持有队列与任务记录。
 * 页面组件只订阅事件，卸载页面不会影响任务（路由切换不取消任务）。
 */
import type { TaskSchedulerBudget } from '@itools/contracts';

import {
  DEFAULT_MAX_QUEUE_LENGTH,
  DEFAULT_SCHEDULER_BUDGET,
} from './scheduler-policy.js';
import { TaskScheduler } from './task-scheduler.js';
import type { TaskRunner } from './task-runner.js';
import type {
  TaskEventListener,
  TaskSnapshot,
  TaskSubmitInput,
} from './task-types.js';

export interface TaskRuntimeOptions {
  readonly runner: TaskRunner;
  /** 结果必须提交成功才允许标记 completed；失败即任务失败。 */
  readonly commitResult: (
    taskId: string,
    output: unknown,
  ) => Promise<readonly string[]>;
  readonly budget?: TaskSchedulerBudget;
  readonly maxQueueLength?: number;
  readonly now?: () => string;
  readonly createTaskId?: () => string;
  /** 订阅者抛出的异常被隔离在此；未提供时仅隔离，不影响任务。 */
  readonly onListenerError?: (error: unknown) => void;
}

export interface TaskRuntime {
  submit(input: TaskSubmitInput): TaskSnapshot;
  cancel(taskId: string): void;
  getTask(taskId: string): TaskSnapshot | undefined;
  listTasks(): readonly TaskSnapshot[];
  subscribe(listener: TaskEventListener): () => void;
  dispose(): void;
}

let taskSequence = 0;

/**
 * 默认任务 ID：进程内单调递增。
 * 阶段 6 引入 IndexedDB 持久化时改为可注入的 UUID 生成器，避免跨会话撞号。
 */
function createDefaultTaskId(): string {
  taskSequence += 1;
  return `task-${taskSequence}`;
}

export function createTaskRuntime(options: TaskRuntimeOptions): TaskRuntime {
  const listeners = new Set<TaskEventListener>();

  const scheduler = new TaskScheduler({
    runner: options.runner,
    budget: options.budget ?? DEFAULT_SCHEDULER_BUDGET,
    commitResult: options.commitResult,
    now: options.now ?? (() => new Date().toISOString()),
    createTaskId: options.createTaskId ?? createDefaultTaskId,
    maxQueueLength: options.maxQueueLength ?? DEFAULT_MAX_QUEUE_LENGTH,
    onEvent: (event) => {
      // 监听器异常不得中断调度流程，也不得影响其它监听器。
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (error) {
          options.onListenerError?.(error);
        }
      }
    },
  });

  return {
    submit: (input) => scheduler.submit(input),
    cancel: (taskId) => scheduler.cancel(taskId),
    getTask: (taskId) => scheduler.getTask(taskId),
    listTasks: () => scheduler.listTasks(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      listeners.clear();
      scheduler.dispose();
    },
  };
}
