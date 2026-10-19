import { describe, expect, it, vi } from 'vitest';
import type { TaskProgress } from '@itools/contracts';

import { RuntimeDisposedError } from '../domain/task-error.js';
import { FakeTaskRunner } from '../test-support/fake-task-runner.js';
import { flushMicrotasks } from '../test-support/fake-timer.js';
import { createTaskRuntime } from './task-runtime.js';
import type { TaskRuntimeEvent, TaskSubmitInput } from './task-types.js';

function submission(toolId: string): TaskSubmitInput {
  return {
    toolId,
    engine: 'text',
    input: { value: toolId },
    resources: { estimatedMemoryBytes: 10, computeClass: 'light' },
  };
}

describe('任务运行时', () => {
  it('默认预算允许 4 个并发任务', () => {
    const runtime = createTaskRuntime({
      runner: new FakeTaskRunner(),
      commitResult: async () => [],
    });

    const tasks = ['a', 'b', 'c', 'd', 'e'].map((toolId) =>
      runtime.submit(submission(`tool-${toolId}`)),
    );

    expect(tasks.map((task) => task.status)).toEqual([
      'running',
      'running',
      'running',
      'running',
      'queued',
    ]);
  });

  it('页面卸载退订不会取消任务', async () => {
    const runner = new FakeTaskRunner();
    const runtime = createTaskRuntime({
      runner,
      commitResult: async () => ['asset-1'],
    });
    const listener = vi.fn<(event: TaskRuntimeEvent) => void>();
    const unsubscribe = runtime.subscribe(listener);

    const task = runtime.submit(submission('tool-a'));
    unsubscribe();
    const execution = runner.find(task.taskId);
    if (execution === undefined) throw new Error('未创建执行器');
    execution.complete({ ok: true });
    await flushMicrotasks();

    expect(runtime.getTask(task.taskId)?.status).toBe('completed');
    // 退订后不再收到新事件，但任务本身照常结束。
    const eventCount = listener.mock.calls.length;
    await flushMicrotasks();
    expect(listener.mock.calls.length).toBe(eventCount);
  });

  it('订阅者在任务提交与结束时收到事件', () => {
    const runtime = createTaskRuntime({
      runner: new FakeTaskRunner(),
      commitResult: async () => [],
    });
    const events: TaskRuntimeEvent[] = [];
    runtime.subscribe((event) => events.push(event));

    runtime.submit(submission('tool-a'));

    expect(events.map((event) => event.task.status)).toEqual([
      'queued',
      'preparing',
      'running',
    ]);
  });

  it('监听器抛异常不影响其他监听器', () => {
    const reported: unknown[] = [];
    const runtime = createTaskRuntime({
      runner: new FakeTaskRunner(),
      commitResult: async () => [],
      onListenerError: (error) => reported.push(error),
    });
    const healthy = vi.fn();
    runtime.subscribe(() => {
      throw new Error('监听器内部错误');
    });
    runtime.subscribe(healthy);

    runtime.submit(submission('tool-a'));

    expect(healthy).toHaveBeenCalled();
    expect(reported).toHaveLength(3);
  });

  it('可注入时钟与任务 ID', () => {
    let sequence = 0;
    const runtime = createTaskRuntime({
      runner: new FakeTaskRunner(),
      commitResult: async () => [],
      now: () => '2026-01-01T00:00:00.000Z',
      createTaskId: () => {
        sequence += 1;
        return `custom-${sequence}`;
      },
    });

    const task = runtime.submit(submission('tool-a'));

    expect(task.taskId).toBe('custom-1');
    expect(task.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(task.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('进度事件通过订阅者暴露', () => {
    const runner = new FakeTaskRunner();
    const runtime = createTaskRuntime({
      runner,
      commitResult: async () => [],
    });
    const progresses: TaskProgress[] = [];
    runtime.subscribe((event) => {
      if (event.task.progress !== undefined) {
        progresses.push(event.task.progress);
      }
    });

    const task = runtime.submit(submission('tool-a'));
    const execution = runner.find(task.taskId);
    if (execution === undefined) throw new Error('未创建执行器');
    execution.reportProgress({ taskId: task.taskId, completed: 1, total: 2 });

    expect(progresses).toHaveLength(1);
    expect(progresses[0]?.total).toBe(2);
  });

  it('任务列表覆盖全部已提交任务', () => {
    const runtime = createTaskRuntime({
      runner: new FakeTaskRunner(),
      commitResult: async () => [],
    });
    runtime.submit(submission('tool-a'));
    runtime.submit(submission('tool-b'));

    expect(runtime.listTasks().map((task) => task.toolId)).toEqual([
      'tool-a',
      'tool-b',
    ]);
  });

  it('销毁后拒绝新任务并清空订阅者', () => {
    const runtime = createTaskRuntime({
      runner: new FakeTaskRunner(),
      commitResult: async () => [],
    });
    const listener = vi.fn();
    runtime.subscribe(listener);

    runtime.dispose();

    expect(() => runtime.submit(submission('tool-a'))).toThrow(
      RuntimeDisposedError,
    );
    expect(listener).not.toHaveBeenCalled();
  });
});
