/**
 * 引用完整性检查：找出指向不存在资产、角色不符或缺少任务归属的引用。
 * 只做判定，修复由调用方决定；保留输入顺序，便于逐条定位。
 */
import type { AssetRole } from '@itools/contracts';

import type { ReferenceIntegrityInput, ReferenceIssue } from './asset-types.js';

export function findReferenceIssues(
  input: ReferenceIntegrityInput,
): readonly ReferenceIssue[] {
  const rolesByAssetId = new Map<string, AssetRole>();
  for (const asset of input.assets) {
    // 重复定义时以首条为准：宁可让冲突暴露，也不让后写覆盖先写。
    if (!rolesByAssetId.has(asset.assetId)) {
      rolesByAssetId.set(asset.assetId, asset.role);
    }
  }

  const issues: ReferenceIssue[] = [];
  for (const reference of input.references) {
    if (reference.taskId.trim().length === 0) {
      issues.push({ assetId: reference.assetId, code: 'empty-task-id' });
    }

    const storedRole = rolesByAssetId.get(reference.assetId);
    if (storedRole === undefined) {
      issues.push({ assetId: reference.assetId, code: 'dangling-reference' });
      continue;
    }
    if (storedRole !== reference.role) {
      issues.push({ assetId: reference.assetId, code: 'role-mismatch' });
    }
  }

  return issues;
}
