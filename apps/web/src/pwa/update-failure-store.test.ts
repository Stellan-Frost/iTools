import { afterEach, describe, expect, it } from 'vitest';
import {
  clearFailures,
  getFailureCount,
  recordFailure,
  shouldAutomaticallyPrompt,
} from './update-failure-store.js';

describe('PWA update failure tracking', () => {
  afterEach(() => window.localStorage.clear());

  it('suppresses automatic prompts after two failures of the same build', () => {
    expect(shouldAutomaticallyPrompt('build-2')).toBe(true);
    expect(recordFailure('build-2')).toBe(1);
    expect(shouldAutomaticallyPrompt('build-2')).toBe(true);
    expect(recordFailure('build-2')).toBe(2);
    expect(shouldAutomaticallyPrompt('build-2')).toBe(false);
    expect(shouldAutomaticallyPrompt('build-3')).toBe(true);
  });

  it('clears a build failure count after successful repair', () => {
    recordFailure('build-2');
    recordFailure('build-2');
    clearFailures('build-2');

    expect(getFailureCount('build-2')).toBe(0);
    expect(shouldAutomaticallyPrompt('build-2')).toBe(true);
  });
});
