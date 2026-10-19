import { useEffect, useState } from 'react';

const COMPACT_VIEWPORT_QUERY = '(max-width: 839px)';

function matchesCompactViewport() {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
  }

  return window.innerWidth < 840;
}

export function useCompactViewport() {
  const [isCompact, setIsCompact] = useState(matchesCompactViewport);

  useEffect(() => {
    const media = window.matchMedia?.(COMPACT_VIEWPORT_QUERY);
    const update = () => setIsCompact(matchesCompactViewport());

    if (media) {
      media.addEventListener?.('change', update);
      return () => media.removeEventListener?.('change', update);
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isCompact;
}
