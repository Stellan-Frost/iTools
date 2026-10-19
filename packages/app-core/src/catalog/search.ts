import type { Locale } from '@itools/contracts';

import { getCategory, listEnabledTools } from './query.js';
import type { CatalogTool } from './types.js';

/**
 * 在当前语言的工具名称、摘要与所属分类名中做不区分大小写的子串匹配。
 * 空查询返回全部启用工具，结果始终按 order 升序。
 */
export function searchEnabledTools(
  query: string,
  locale: Locale,
): readonly CatalogTool[] {
  const needle = query.trim().toLowerCase();
  const tools = listEnabledTools();

  if (needle.length === 0) {
    return tools;
  }

  return tools.filter((tool) => {
    const category = getCategory(tool.categoryId);
    const candidates = [
      tool.name[locale],
      tool.summary[locale],
      category?.name[locale] ?? '',
    ];
    return candidates.some((text) => text.toLowerCase().includes(needle));
  });
}
