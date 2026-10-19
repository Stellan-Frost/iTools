import { describe, expect, it } from 'vitest';
import type { TaskProgress } from '@itools/contracts';

import {
  createFakeWorkerFactory,
  type FakeWorker,
} from '../../test-support/fake-worker.js';
import { FakeTimer, flushMicrotasks } from '../../test-support/fake-timer.js';
import { EngineWorkerPool } from './worker-pool.js';
import { createWorkerRunner } from './worker-runner.js';

const CANCEL_TIMEOUT_MS = 2_000;

function createHarness(): {
  runner: ReturnType<typeof createWorkerRunner>;
  factory: ReturnType<typeof createFakeWorkerFactory>;
  timer: FakeTimer;
  pool: EngineWorkerPool;
} {
  const factory = createFakeWorkerFactory();
  const pool = new EngineWorkerPool({
    createWorker: factory.createWorker,
    maxWorkersPerEngine: 1,
  });
  const timer = new FakeTimer();
  const runner = createWorkerRunner({
    pool,
    timer,
    cancelTimeoutMs: CANCEL_TIMEOUT_MS,
  });
  return { runner, factory, timer, pool };
}

function startTask(
  runner: ReturnType<typeof createWorkerRunner>,
  progresses: TaskProgress[] = [],
  taskId = 'task-1',
) {
  return runner.start(
    { taskId, toolId: 'json-formatter', engine: 'text', input: { text: '{}' } },
    { reportProgress: (progress) => progresses.push(progress) },
  );
}

async function acquireWorker(): Promise<void> {
  await flushMicrotasks();
}

describe('Worker 执行器', () => {
  it('发送 start 并在 complete 后返回输出', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);

    await acquireWorker();
    const worker = factory.workers[0] as FakeWorker;
    expect(worker.sentMessages[0]).toEqual({
      type: 'start',
      taskId: 'task-1',
      input: { text: '{}' },
    });

    worker.emitMessage({
      type: 'complete',
      taskId: 'task-1',
      output: { ok: true },
    });

    await expect(execution.done).resolves.toEqual({
      status: 'completed',
      output: { ok: true },
    });
    expect(worker.isTerminated).toBe(false);
  });

  it('转发本任务的进度并忽略错配 taskId', async () => {
    const { runner, factory } = createHarness();
    const progresses: TaskProgress[] = [];
    startTask(runner, progresses);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    worker.emitMessage({
      type: 'progress',
      progress: { taskId: 'other-task', completed: 1 },
    });
    worker.emitMessage({
      type: 'progress',
      progress: { taskId: 'task-1', completed: 2, total: 5 },
    });

    expect(progresses).toHaveLength(1);
    expect(progresses[0]?.completed).toBe(2);
  });

  it('error 消息使任务失败并丢弃 Worker', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    worker.emitMessage({
      type: 'error',
      taskId: 'task-1',
      error: {
        code: 'execution-failed',
        messageKey: 'tasks:error.execution-failed',
        retryable: false,
      },
    });

    const result = await execution.done;
    expect(result.status).toBe('failed');
    expect(worker.isTerminated).toBe(true);
  });

  it('协作取消后 Worker 可复用', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    execution.requestCancel();
    expect(worker.sentMessages[1]).toEqual({
      type: 'cancel',
      taskId: 'task-1',
    });

    worker.emitMessage({ type: 'cancelled', taskId: 'task-1' });
    await expect(execution.done).resolves.toEqual({ status: 'cancelled' });
    expect(worker.isTerminated).toBe(false);

    const next = startTask(runner, [], 'task-2');
    await flushMicrotasks();
    expect(factory.workers).toHaveLength(1);
    expect(worker.sentMessages[2]).toEqual({
      type: 'start',
      taskId: 'task-2',
      input: { text: '{}' },
    });
    next.dispose();
  });

  it('取消确认超时后强杀 Worker 并返回已取消', async () => {
    const { runner, factory, timer } = createHarness();
    const execution = startTask(runner);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    execution.requestCancel();
    expect(timer.pendingCount).toBe(1);
    expect(timer.handles[0]?.delayMs).toBe(CANCEL_TIMEOUT_MS);

    timer.firePending();

    await expect(execution.done).resolves.toEqual({ status: 'cancelled' });
    expect(worker.isTerminated).toBe(true);
    expect(timer.pendingCount).toBe(0);
  });

  it('Worker 尚未就绪时取消不会发送 start', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);
    execution.requestCancel();

    await flushMicrotasks();
    await expect(execution.done).resolves.toEqual({ status: 'cancelled' });
    const worker = factory.workers[0] as FakeWorker;
    expect(worker.sentMessages).toHaveLength(0);
    expect(worker.isTerminated).toBe(true);
  });

  it('Worker 崩溃事件使任务失败并丢弃 Worker', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    worker.emitError();

    const result = await execution.done;
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error.code).toBe('worker-crashed');
    }
    expect(worker.isTerminated).toBe(true);
  });

  it('非法协议消息视为任务失败', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    worker.emitMessage({ type: 'garbage' });

    const result = await execution.done;
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error.code).toBe('protocol-violation');
    }
    expect(worker.isTerminated).toBe(true);
  });

  it('dispose 幂等且释放 Worker', async () => {
    const { runner, factory } = createHarness();
    const execution = startTask(runner);

    await flushMicrotasks();
    const worker = factory.workers[0] as FakeWorker;
    execution.dispose();
    execution.dispose();

    await expect(execution.done).resolves.toEqual({ status: 'cancelled' });
    expect(worker.isTerminated).toBe(true);
  });

  it('池获取失败时任务失败且不挂起', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });
    pool.dispose();
    const runner = createWorkerRunner({
      pool,
      timer: new FakeTimer(),
      cancelTimeoutMs: CANCEL_TIMEOUT_MS,
    });

    const execution = startTask(runner);
    const result = await execution.done;
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error.code).toBe('worker-start-failed');
    }
  });
});
