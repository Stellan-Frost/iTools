import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPerformanceBudget } from './performance-budget.mjs';

const budget = {
  byLocale: {
    'zh-CN': { pageEncodedBodyBytes: 2_539_520 },
    en: { pageEncodedBodyBytes: 1_699_840 },
  },
};
const localeIds = ['zh-CN', 'en'];

test('passes when every measured page is within its approved byte limit', () => {
  const locales = {
    'zh-CN': {
      samples: [2_300_000, 2_350_000].map((pageEncodedBodyBytes) => ({
        pageEncodedBodyBytes,
      })),
    },
    en: {
      samples: [1_500_000, 1_600_000].map((pageEncodedBodyBytes) => ({
        pageEncodedBodyBytes,
      })),
    },
  };
  const result = checkPerformanceBudget(locales, budget, localeIds);
  assert.equal(result.passed, true);
  assert.equal(result.byLocale['zh-CN'].actualBytes, 2_350_000);
});

test('negative probe fails if one sample exceeds the budget', () => {
  const locales = {
    'zh-CN': {
      samples: [2_300_000, 2_539_521].map((pageEncodedBodyBytes) => ({
        pageEncodedBodyBytes,
      })),
    },
    en: { samples: [{ pageEncodedBodyBytes: 1_500_000 }] },
  };
  const result = checkPerformanceBudget(locales, budget, localeIds);
  assert.equal(result.passed, false);
  assert.equal(result.byLocale['zh-CN'].passed, false);
  assert.equal(result.byLocale.en.passed, true);
});
