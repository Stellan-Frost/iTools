/**
 * Worker 测试替身：记录收到的消息并允许测试主动投递协议消息。
 * 只用于测试，不进入构建产物（tsconfig.build.json 已排除 src/test-support）。
 */
import type {
  WorkerLike,
  WorkerListener,
  WorkerListenerEvent,
} from '../infrastructure/worker/worker-pool.js';

type WorkerEventType = 'message' | 'error';

export class FakeWorker implements WorkerLike {
  readonly sentMessages: unknown[] = [];
  isTerminated = false;
  private readonly listeners = new Map<WorkerEventType, Set<WorkerListener>>();

  postMessage(message: unknown): void {
    if (this.isTerminated) throw new Error('Worker 已终止，不能继续发送消息');
    this.sentMessages.push(message);
  }

  terminate(): void {
    this.isTerminated = true;
    for (const listeners of this.listeners.values()) listeners.clear();
  }

  addEventListener(type: WorkerEventType, listener: WorkerListener): void {
    const listeners = this.listeners.get(type) ?? new Set<WorkerListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: WorkerEventType, listener: WorkerListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emitMessage(data: unknown): void {
    this.emit('message', { data });
  }

  emitError(message = 'worker crashed'): void {
    this.emit('error', { message });
  }

  private emit(type: WorkerEventType, event: WorkerListenerEvent): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }
}

export interface FakeWorkerFactory {
  readonly workers: FakeWorker[];
  readonly createWorker: () => WorkerLike;
}

export function createFakeWorkerFactory(): FakeWorkerFactory {
  const workers: FakeWorker[] = [];
  return {
    workers,
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  };
}
