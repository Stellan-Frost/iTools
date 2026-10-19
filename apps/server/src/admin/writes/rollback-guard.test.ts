import { describe, expect, it } from 'vitest';
import { evaluateRollbackGuard } from './rollback-guard.js';

describe('evaluateRollbackGuard', () => {
  it('没有历史版本时允许回滚', () => {
    expect(evaluateRollbackGuard(undefined, 3)).toBe('apply');
  });

  it('期望版本与最新版本一致时允许回滚', () => {
    expect(evaluateRollbackGuard(7, 7)).toBe('apply');
  });

  it('期间出现更新版本时判定为冲突', () => {
    expect(evaluateRollbackGuard(8, 7)).toBe('conflict');
  });
});
