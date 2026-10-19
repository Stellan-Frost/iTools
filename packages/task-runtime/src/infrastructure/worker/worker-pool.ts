/**
 * Worker 池：按引擎分组复用空闲 Worker，并限制每引擎的线程上限。
 * Worker 只负责计算；池不关心任务语义，也不接触任务记录。
 */

export interface WorkerListenerEvent {
  readonly data?: unknown;
  readonly message?: string;
}

export type WorkerListener = (event: WorkerListenerEvent) => void;

/** 真实 Worker 与测试替身的最小公共形状。 */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(type: 'message' | 'error', listener: WorkerListener): void;
  removeEventListener(
    type: 'message' | 'error',
    listener: WorkerListener,
  ): void;
}

export interface WorkerLease {
  readonly worker: WorkerLike;
  /** discard 表示该 Worker 已不可信（崩溃、强杀），必须终止而非回收。 */
  release(options?: { readonly discard?: boolean }): void;
}

export interface WorkerPoolOptions {
  readonly createWorker: () => WorkerLike;
  readonly maxWorkersPerEngine: number;
}

export interface WorkerPool {
  acquire(engine: string): Promise<WorkerLease>;
  dispose(): void;
}

interface EngineState {
  readonly idle: WorkerLike[];
  total: number;
  readonly waiters: Array<(lease: WorkerLease | undefined) => void>;
}

export class EngineWorkerPool implements WorkerPool {
  private readonly options: WorkerPoolOptions;
  private readonly engines = new Map<string, EngineState>();
  private isDisposed = false;

  constructor(options: WorkerPoolOptions) {
    this.options = options;
  }

  acquire(engine: string): Promise<WorkerLease> {
    if (this.isDisposed) {
      return Promise.reject(new Error('Worker 池已销毁'));
    }
    const state = this.requireEngine(engine);
    const idleWorker = state.idle.pop();
    if (idleWorker !== undefined) {
      return Promise.resolve(this.createLease(engine, state, idleWorker));
    }
    if (state.total < this.options.maxWorkersPerEngine) {
      state.total += 1;
      return Promise.resolve(
        this.createLease(engine, state, this.options.createWorker()),
      );
    }
    return new Promise<WorkerLease>((resolve, reject) => {
      state.waiters.push((lease) => {
        if (lease === undefined) {
          reject(new Error('Worker 池已销毁'));
          return;
        }
        resolve(lease);
      });
    });
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    for (const state of this.engines.values()) {
      for (const worker of state.idle) worker.terminate();
      state.idle.length = 0;
      state.total = 0;
      const waiters = state.waiters.splice(0, state.waiters.length);
      for (const notify of waiters) notify(undefined);
    }
  }

  private createLease(
    engine: string,
    state: EngineState,
    worker: WorkerLike,
  ): WorkerLease {
    let isReleased = false;
    return {
      worker,
      release: (options) => {
        if (isReleased) return;
        isReleased = true;
        this.recycle(engine, state, worker, options?.discard === true);
      },
    };
  }

  private recycle(
    engine: string,
    state: EngineState,
    worker: WorkerLike,
    discard: boolean,
  ): void {
    if (discard || this.isDisposed) {
      worker.terminate();
      state.total = Math.max(0, state.total - 1);
    } else {
      state.idle.push(worker);
    }
    this.serveWaiters(engine, state);
  }

  private serveWaiters(engine: string, state: EngineState): void {
    while (state.waiters.length > 0) {
      const idleWorker = state.idle.pop();
      if (idleWorker !== undefined) {
        const notify = state.waiters.shift();
        notify?.(this.createLease(engine, state, idleWorker));
        continue;
      }
      if (this.isDisposed) return;
      if (state.total < this.options.maxWorkersPerEngine) {
        state.total += 1;
        const notify = state.waiters.shift();
        notify?.(this.createLease(engine, state, this.options.createWorker()));
        continue;
      }
      return;
    }
  }

  private requireEngine(engine: string): EngineState {
    const existing = this.engines.get(engine);
    if (existing !== undefined) return existing;
    const created: EngineState = { idle: [], total: 0, waiters: [] };
    this.engines.set(engine, created);
    return created;
  }
}
