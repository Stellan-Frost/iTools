/**
 * 回滚冲突判定（纯函数，无 IO）：
 * 管理员提交的 `expectedVersionId` 必须与该 (tool, locale) 当前最新版本一致，
 * 否则说明期间有人写过更新的版本，回滚会静默覆盖较新修改，必须拒绝。
 */

export type RollbackGuardDecision = 'apply' | 'conflict';

export function evaluateRollbackGuard(
  latestVersionId: number | undefined,
  expectedVersionId: number,
): RollbackGuardDecision {
  if (latestVersionId === undefined) return 'apply';
  return latestVersionId === expectedVersionId ? 'apply' : 'conflict';
}
