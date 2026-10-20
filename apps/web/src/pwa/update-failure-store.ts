const STORAGE_KEY = 'itools-pwa-failures-v1';
export const MAX_AUTOMATIC_FAILURES = 2;

type FailureCounts = Record<string, number>;

function getStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function readCounts(storage = getStorage()): FailureCounts {
  if (!storage) return {};
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, count]) =>
          key.length > 0 &&
          typeof count === 'number' &&
          Number.isInteger(count) &&
          count >= 0,
      ),
    ) as FailureCounts;
  } catch {
    return {};
  }
}

function writeCounts(counts: FailureCounts, storage = getStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Storage may be disabled; update handling remains available for this session.
  }
}

export function getFailureCount(buildId: string): number {
  if (!buildId) return 0;
  return readCounts()[buildId] ?? 0;
}

export function recordFailure(buildId: string): number {
  if (!buildId) return 0;
  const counts = readCounts();
  const nextCount = (counts[buildId] ?? 0) + 1;
  counts[buildId] = nextCount;
  writeCounts(counts);
  return nextCount;
}

export function clearFailures(buildId: string): void {
  if (!buildId) return;
  const counts = readCounts();
  delete counts[buildId];
  writeCounts(counts);
}

export function shouldAutomaticallyPrompt(buildId: string): boolean {
  return getFailureCount(buildId) < MAX_AUTOMATIC_FAILURES;
}
