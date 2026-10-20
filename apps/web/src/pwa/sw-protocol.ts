export type ServiceWorkerToClientMessage =
  | { type: 'update-ready'; buildId: string }
  | { type: 'update-failed'; buildId: string }
  | { type: 'repair-complete'; buildId: string }
  | { type: 'repair-failed'; buildId: string };

export type ClientToServiceWorkerMessage =
  | { type: 'apply-update' }
  | { type: 'repair-install' }
  | { type: 'get-build-id' };

export type BuildIdReply = { buildId: string };
