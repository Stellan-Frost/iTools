#!/usr/bin/env node
/**
 * 校验代码注册表：重复 ID、routeKey 冲突、非法分类、缺翻译、
 * 预览条目携带实现、已实现条目缺少契约、样本任务引用非法工具。
 * 前置：先执行 `pnpm --filter @itools/app-core build`（或 `pnpm build`）。
 */
import { existsSync } from 'node:fs';

const distEntry = new URL(
  '../packages/app-core/dist/index.js',
  import.meta.url,
);

if (!existsSync(distEntry)) {
  console.error(
    '未找到 @itools/app-core 构建产物。请先执行 `pnpm --filter @itools/app-core build` 或 `pnpm build`。',
  );
  process.exit(1);
}

const appCore = await import(distEntry.href);
const { toolRegistry, SAMPLE_TASKS, validateToolRegistry } = appCore;

if (!toolRegistry || typeof validateToolRegistry !== 'function') {
  console.error(
    '@itools/app-core 未导出 toolRegistry 或 validateToolRegistry，构建产物可能过期。',
  );
  process.exit(1);
}

const entries = toolRegistry.entries;
const issues = validateToolRegistry(entries, SAMPLE_TASKS);

const counts = {
  total: entries.length,
  preview: entries.filter((entry) => entry.availability === 'preview').length,
  implemented: entries.filter((entry) => entry.availability === 'implemented')
    .length,
  disabled: entries.filter((entry) => entry.availability === 'disabled').length,
};

console.log(
  `注册表：共 ${counts.total} 条（preview ${counts.preview}、implemented ${counts.implemented}、disabled ${counts.disabled}），样本任务 ${SAMPLE_TASKS.length} 条。`,
);

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(
      `[${issue.code}]${issue.toolId ? ` ${issue.toolId}` : ''}: ${issue.detail}`,
    );
  }
  console.error(`\n注册表校验失败：${issues.length} 项问题。`);
  process.exit(1);
}

console.log('注册表校验通过。');
