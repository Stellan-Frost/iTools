import { readFile } from 'node:fs/promises';

export async function readPerformanceBudget(baselinePath, localeIds) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const budget = baseline.performanceBudget;
  const isValid =
    baseline.enforcementEnabled === true &&
    localeIds.every((id) => {
      const limit = budget?.byLocale?.[id]?.pageEncodedBodyBytes;
      return Number.isSafeInteger(limit) && limit > 0;
    });
  if (!isValid) {
    throw new Error(
      'Performance baseline must contain approved per-locale pageEncodedBodyBytes limits.',
    );
  }
  return budget;
}

export function checkPerformanceBudget(locales, budget, localeIds) {
  const byLocale = Object.fromEntries(
    localeIds.map((id) => {
      const samples = locales[id].samples.map(
        (sample) => sample.pageEncodedBodyBytes,
      );
      const actualBytes = Math.max(...samples);
      const limitBytes = budget.byLocale[id].pageEncodedBodyBytes;
      return [
        id,
        { actualBytes, limitBytes, passed: actualBytes <= limitBytes },
      ];
    }),
  );
  return {
    metric: 'pageEncodedBodyBytes',
    comparison: 'maximum across measured runs <= approved limit',
    passed: Object.values(byLocale).every(({ passed }) => passed),
    byLocale,
  };
}
