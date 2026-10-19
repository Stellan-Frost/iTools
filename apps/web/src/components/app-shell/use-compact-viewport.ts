import { useSyncExternalStore } from 'react';

const COMPACT_VIEWPORT_QUERY = '(max-width: 839px)';
const COMPACT_VIEWPORT_MAX_WIDTH = 840;

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
  }

  return window.innerWidth < COMPACT_VIEWPORT_MAX_WIDTH;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    media.addEventListener?.('change', onStoreChange);
    return () => media.removeEventListener?.('change', onStoreChange);
  }

  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
}

/** SSR 期间固定为桌面视图，避免首屏访问 window。 */
export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
