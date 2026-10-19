import { describe, expect, it } from 'vitest';

import { createFakeWorkerFactory } from '../../test-support/fake-worker.js';
import { EngineWorkerPool } from './worker-pool.js';

describe('Worker 池', () => {
  it('复用空闲 Worker 而不新建', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });

    const first = await pool.acquire('text');
    first.release();
    const second = await pool.acquire('text');

    expect(factory.workers).toHaveLength(1);
    expect(second.worker).toBe(first.worker);
  });

  it('达到上限后排队，释放后交给等待者', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });

    const lease = await pool.acquire('text');
    const waiting = pool.acquire('text');
    let isResolved = false;
    void waiting.then(() => {
      isResolved = true;
    });
    await Promise.resolve();
    expect(isResolved).toBe(false);

    lease.release();
    const next = await waiting;
    expect(next.worker).toBe(lease.worker);
  });

  it('discard 会终止 Worker 并释放名额', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });

    const lease = await pool.acquire('text');
    lease.release({ discard: true });
    expect(lease.worker.terminate).toBeDefined();
    expect(factory.workers[0]?.isTerminated).toBe(true);

    const next = await pool.acquire('text');
    expect(factory.workers).toHaveLength(2);
    expect(next.worker).not.toBe(lease.worker);
  });

  it('不同引擎互不占用名额', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });

    const textLease = await pool.acquire('text');
    const imageLease = await pool.acquire('image');
    expect(factory.workers).toHaveLength(2);
    textLease.release();
    imageLease.release();
  });

  it('重复释放是幂等的', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });

    const lease = await pool.acquire('text');
    lease.release();
    lease.release();
    const next = await pool.acquire('text');
    expect(next.worker).toBe(lease.worker);
    expect(factory.workers).toHaveLength(1);
  });

  it('池销毁后等待者被拒绝', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });

    const lease = await pool.acquire('text');
    const waiting = pool.acquire('text');
    pool.dispose();

    await expect(waiting).rejects.toThrow('Worker 池已销毁');
    lease.release();
    expect(factory.workers[0]?.isTerminated).toBe(true);
  });

  it('销毁后的新请求直接失败', async () => {
    const factory = createFakeWorkerFactory();
    const pool = new EngineWorkerPool({
      createWorker: factory.createWorker,
      maxWorkersPerEngine: 1,
    });
    pool.dispose();
    await expect(pool.acquire('text')).rejects.toThrow('Worker 池已销毁');
    expect(factory.workers).toHaveLength(0);
  });
});
