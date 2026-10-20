import type {
  BuildIdReply,
  ClientToServiceWorkerMessage,
  ServiceWorkerToClientMessage,
} from './sw-protocol.js';

export function isWorkerMessage(
  value: unknown,
): value is ServiceWorkerToClientMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; buildId?: unknown };
  return (
    typeof candidate.buildId === 'string' &&
    (candidate.type === 'update-ready' ||
      candidate.type === 'update-failed' ||
      candidate.type === 'repair-complete' ||
      candidate.type === 'repair-failed')
  );
}

export function getTargetWorker(
  registration: ServiceWorkerRegistration | undefined,
): ServiceWorker | undefined {
  return (
    registration?.active ??
    (typeof navigator === 'undefined'
      ? undefined
      : (navigator.serviceWorker?.controller ?? undefined))
  );
}

export function sendToWorker(
  worker: ServiceWorker | undefined,
  message: ClientToServiceWorkerMessage,
): boolean {
  if (!worker) return false;
  try {
    worker.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export function queryWorkerBuildId(
  worker: ServiceWorker | undefined,
): Promise<string> {
  if (!worker || typeof MessageChannel === 'undefined') {
    return Promise.resolve('');
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      resolve('');
    }, 1_500);

    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      const reply = event.data as BuildIdReply | null;
      resolve(reply && typeof reply.buildId === 'string' ? reply.buildId : '');
    };

    try {
      worker.postMessage({ type: 'get-build-id' }, [channel.port2]);
    } catch {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve('');
    }
  });
}
