/**
 * 源文件保留策略：决定哪些资产可以安全删除。
 * 纯函数——时间由调用方注入，不读时钟，保证同一输入永远得到同一清理计划。
 */
import type {
  CleanupPlan,
  CleanupSkip,
  RetentionInput,
} from './asset-types.js';

interface ExpiredAsset {
  readonly assetId: string;
  readonly createdAtMs: number;
}

/**
 * 删除顺序按创建时间升序，同时刻按 ID 升序：计划稳定，便于日志比对与回放。
 */
function compareExpired(left: ExpiredAsset, right: ExpiredAsset): number {
  if (left.createdAtMs !== right.createdAtMs) {
    return left.createdAtMs - right.createdAtMs;
  }
  if (left.assetId === right.assetId) {
    return 0;
  }

  return left.assetId < right.assetId ? -1 : 1;
}

export function planRetention(input: RetentionInput): CleanupPlan {
  const referencedIds = new Set(
    input.references.map((reference) => reference.assetId),
  );
  const activeTaskIds = new Set(input.activeTaskIds);
  const nowMs = input.now.getTime();

  const keep: string[] = [];
  const skipped: CleanupSkip[] = [];
  const expired: ExpiredAsset[] = [];

  for (const asset of input.assets) {
    // 中间产物与结果属于任务产物，不能按源文件策略回收。
    if (asset.role !== 'source') {
      keep.push(asset.assetId);
      skipped.push({ assetId: asset.assetId, reason: 'not-source' });
      continue;
    }
    if (referencedIds.has(asset.assetId)) {
      keep.push(asset.assetId);
      skipped.push({ assetId: asset.assetId, reason: 'referenced' });
      continue;
    }
    if (asset.taskId !== undefined && activeTaskIds.has(asset.taskId)) {
      keep.push(asset.assetId);
      skipped.push({ assetId: asset.assetId, reason: 'active-task' });
      continue;
    }

    const createdAtMs = Date.parse(asset.createdAt);
    if (Number.isNaN(createdAtMs)) {
      // 时间不可解析时宁可多占空间，也不拿无法判定的数据去冒误删的风险。
      keep.push(asset.assetId);
      continue;
    }

    // 边界取等号：恰好到期的文件即可回收。
    if (createdAtMs + input.retentionMs <= nowMs) {
      expired.push({ assetId: asset.assetId, createdAtMs });
      continue;
    }

    keep.push(asset.assetId);
  }

  expired.sort(compareExpired);

  return {
    keep,
    remove: expired.map((entry) => entry.assetId),
    skipped,
  };
}
