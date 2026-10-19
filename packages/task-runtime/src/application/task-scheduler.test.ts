import { describe, expect, it } from 'vitest';
import type { TaskSchedulerBudget } from '@itools/contracts';

import {
  FakeTaskRunner,
  type FakeExecution,
} from '../test-support/fake-task-runner.js';
import { flushMicrotasks } from '../test-support/fake-timer.js';
import {
  RuntimeDisposedError,
  TaskNotFoundError,
} from '../domain/task-error.js';
import { TaskScheduler } from './task-scheduler.js';
import type { TaskRuntimeEvent, TaskSubmitInput } from './task-types.js';

interface Harness {
  readonly scheduler: TaskScheduler;
  readonly runner: FakeTaskRunner;
  readonly events: TaskRuntimeEvent[];
  readonly commitCalls: Array<{ taskId: string; output: unknown }>;
}

interface HarnessOptions {
  readonly budget?: TaskSchedulerBudget;
  readonly maxQueueLength?: number;
  readonly commitResult?: (
    taskId: string,
    output: unknown,
  ) => Promise<readonly string[]>;
}

function createHarness(options: HarnessOptions = {}): Harness {
  const runner = new FakeTaskRunner();
  const events: TaskRuntimeEvent[] = [];
  const commitCalls: Array<{ taskId: string; output: unknown }> = [];
  let sequence = 0;

  const scheduler = new TaskScheduler({
    runner,
    budget: options.budget ?? {
      maxConcurrentTasks: 2,
      maxTotalMemoryBytes: 1_000,
      perToolConcurrency: 1,
    },
    commitResult:
      options.commitResult ??
      (async (taskId, output) => {
        commitCalls.push({ taskId, output });
        return [`asset-${taskId}`];
      }),
    now: () => '2026-10-19T00:00:00.000Z',
    createTaskId: () => {
      sequence += 1;
      return `task-${sequence}`;
    },
    maxQueueLength: options.maxQueueLength ?? 10,
    onEvent: (event) => events.push(event),
  });

  return { scheduler, runner, events, commitCalls };
}

function submission(toolId = 'tool-a', memoryBytes = 100): TaskSubmitInput {
  return {
    toolId,
    engine: 'text',
    input: { value: toolId },
    resources: { estimatedMemoryBytes: memoryBytes, computeClass: 'light' },
  };
}

function executionOf(runner: FakeTaskRunner, taskId: string): FakeExecution {
  const execution = runner.find(taskId);
  if (execution === undefined) throw new Error(`未找到执行器：${taskId}`);
  return execution;
}

describe('任务调度器', () => {
  it('预算充足时提交即进入运行', () => {
    const { scheduler, runner } = createHarness();
    const task = scheduler.submit(submission());

    expect(task.status).toBe('running');
    expect(runner.executions).toHaveLength(1);
  });

  it('受总并发上限约束，多余任务排队', () => {
    const { scheduler } = createHarness();
    const first = scheduler.submit(submission('tool-a'));
    const second = scheduler.submit(submission('tool-b'));
    const third = scheduler.submit(submission('tool-c'));

    expect([first.status, second.status, third.status]).toEqual([
      'running',
      'running',
      'queued',
    ]);
  });

  it('受总内存上限约束', () => {
    const { scheduler } = createHarness({
      budget: {
        maxConcurrentTasks: 4,
        maxTotalMemoryBytes: 100,
        perToolConcurrency: 2,
      },
    });
    const first = scheduler.submit(submission('tool-a', 60));
    const second = scheduler.submit(submission('tool-b', 60));

    expect(first.status).toBe('running');
    expect(second.status).toBe('queued');
  });

  it('受单工具并发约束', () => {
    const { scheduler } = createHarness();
    const first = scheduler.submit(submission('tool-a'));
    const second = scheduler.submit(submission('tool-a'));

    expect(first.status).toBe('running');
    expect(second.status).toBe('queued');
  });

  it('结果提交成功后才标记完成并带上资产 ID', async () => {
    const { scheduler, runner, commitCalls } = createHarness();
    const task = scheduler.submit(submission());

    executionOf(runner, task.taskId).complete({ text: 'done' });
    await flushMicrotasks();

    const settled = scheduler.getTask(task.taskId);
    expect(settled?.status).toBe('completed');
    expect(settled?.resultAssetIds).toEqual([`asset-${task.taskId}`]);
    expect(commitCalls).toHaveLength(1);
  });

  it('结果提交失败时任务失败并释放预算', async () => {
    const { scheduler, runner } = createHarness({
      budget: {
        maxConcurrentTasks: 1,
        maxTotalMemoryBytes: 1_000,
        perToolConcurrency: 1,
      },
      commitResult: async () => {
        throw new Error('存储写入失败');
      },
    });
    const first = scheduler.submit(submission());
    const second = scheduler.submit(submission('tool-b'));
    expect(second.status).toBe('queued');

    executionOf(runner, first.taskId).complete({});
    await flushMicrotasks();

    const settled = scheduler.getTask(first.taskId);
    expect(settled?.status).toBe('failed');
    expect(settled?.error?.code).toBe('result-commit-failed');
    expect(scheduler.getTask(second.taskId)?.status).toBe('running');
  });

  it('执行器启动抛错时任务失败且不占用预算', () => {
    const { scheduler, runner } = createHarness({
      budget: {
        maxConcurrentTasks: 1,
        maxTotalMemoryBytes: 1_000,
        perToolConcurrency: 1,
      },
    });
    runner.startError = new Error('无法创建工作线程');

    const failed = scheduler.submit(submission());
    expect(failed.status).toBe('failed');
    expect(failed.error?.code).toBe('worker-start-failed');

    runner.startError = undefined;
    expect(scheduler.submit(submission('tool-b')).status).toBe('running');
  });

  it('排队中的任务取消后不进入运行', () => {
    const { scheduler, runner } = createHarness({
      budget: {
        maxConcurrentTasks: 1,
        maxTotalMemoryBytes: 1_000,
        perToolConcurrency: 1,
      },
    });
    scheduler.submit(submission());
    const queued = scheduler.submit(submission('tool-b'));

    scheduler.cancel(queued.taskId);

    expect(scheduler.getTask(queued.taskId)?.status).toBe('cancelled');
    expect(runner.executions).toHaveLength(1);
  });

  it('运行中取消先进入 cancelling，确认后才是 cancelled', async () => {
    const { scheduler, runner } = createHarness();
    const task = scheduler.submit(submission());
    const execution = executionOf(runner, task.taskId);

    scheduler.cancel(task.taskId);
    expect(scheduler.getTask(task.taskId)?.status).toBe('cancelling');
    expect(execution.cancelRequestCount).toBe(1);

    execution.confirmCancel();
    await flushMicrotasks();
    expect(scheduler.getTask(task.taskId)?.status).toBe('cancelled');
  });

  it('取消确认后迟到的完成结果被丢弃且不写资产', async () => {
    const { scheduler, runner, commitCalls } = createHarness();
    const task = scheduler.submit(submission());
    const execution = executionOf(runner, task.taskId);

    scheduler.cancel(task.taskId);
    execution.complete({ text: '迟到的结果' });
    await flushMicrotasks();

    expect(scheduler.getTask(task.taskId)?.status).toBe('cancelled');
    expect(commitCalls).toHaveLength(0);
    expect(scheduler.getTask(task.taskId)?.resultAssetIds).toEqual([]);
  });

  it('重复取消是幂等的', async () => {
    const { scheduler, runner } = createHarness();
    const task = scheduler.submit(submission());
    const execution = executionOf(runner, task.taskId);

    scheduler.cancel(task.taskId);
    scheduler.cancel(task.taskId);
    expect(execution.cancelRequestCount).toBe(1);

    execution.confirmCancel();
    await flushMicrotasks();
    expect(scheduler.getTask(task.taskId)?.status).toBe('cancelled');
  });

  it('队列超过上限时直接失败', () => {
    const { scheduler } = createHarness({
      budget: {
        maxConcurrentTasks: 1,
        maxTotalMemoryBytes: 1_000,
        perToolConcurrency: 1,
      },
      maxQueueLength: 1,
    });
    scheduler.submit(submission());
    scheduler.submit(submission('tool-b'));
    const overflow = scheduler.submit(submission('tool-c'));

    expect(overflow.status).toBe('failed');
    expect(overflow.error?.code).toBe('queue-full');
    expect(overflow.error?.retryable).toBe(true);
  });

  it('进度只更新快照，不改变状态', () => {
    const { scheduler, runner } = createHarness();
    const task = scheduler.submit(submission());
    const execution = executionOf(runner, task.taskId);

    execution.reportProgress({ taskId: task.taskId, completed: 3, total: 10 });

    const snapshot = scheduler.getTask(task.taskId);
    expect(snapshot?.status).toBe('running');
    expect(snapshot?.progress?.completed).toBe(3);
  });

  it('错配 taskId 的进度被忽略', () => {
    const { scheduler, runner } = createHarness();
    const task = scheduler.submit(submission());
    const execution = executionOf(runner, task.taskId);

    execution.reportProgress({ taskId: 'task-other', completed: 1 });
    expect(scheduler.getTask(task.taskId)?.progress).toBeUndefined();
  });

  it('失败任务释放预算，排队任务补位', async () => {
    const { scheduler, runner } = createHarness({
      budget: {
        maxConcurrentTasks: 1,
        maxTotalMemoryBytes: 1_000,
        perToolConcurrency: 1,
      },
    });
    const first = scheduler.submit(submission());
    const second = scheduler.submit(submission('tool-b'));

    executionOf(runner, first.taskId).fail({
      code: 'execution-failed',
      messageKey: 'tasks:error.execution-failed',
      retryable: true,
    });
    await flushMicrotasks();

    expect(scheduler.getTask(first.taskId)?.status).toBe('failed');
    expect(scheduler.getTask(second.taskId)?.status).toBe('running');
  });

  it('销毁时取消全部未完成任务并拒绝新提交', async () => {
    const { scheduler, runner } = createHarness({
      budget: {
        maxConcurrentTasks: 1,
        maxTotalMemoryBytes: 1_000,
        perToolConcurrency: 1,
      },
    });
    const running = scheduler.submit(submission());
    const queued = scheduler.submit(submission('tool-b'));

    scheduler.dispose();

    expect(scheduler.getTask(running.taskId)?.status).toBe('cancelled');
    expect(scheduler.getTask(queued.taskId)?.status).toBe('cancelled');
    expect(executionOf(runner, running.taskId).disposeCount).toBeGreaterThan(0);
    expect(() => scheduler.submit(submission('tool-c'))).toThrow(
      RuntimeDisposedError,
    );
  });

  it('状态流转顺序符合状态机', () => {
    const { scheduler, events } = createHarness();
    const task = scheduler.submit(submission());
    const statuses = events
      .filter((event) => event.task.taskId === task.taskId)
      .map((event) => event.task.status);

    expect(statuses).toEqual(['queued', 'preparing', 'running']);
  });

  it('未知任务查询返回 undefined，取消抛稳定错误', () => {
    const { scheduler } = createHarness();
    expect(scheduler.getTask('task-missing')).toBeUndefined();
    expect(() => scheduler.cancel('task-missing')).toThrow(TaskNotFoundError);
  });
});
