import type { Locale } from '@itools/contracts';

import { CATEGORIES } from './data/categories.js';
import { listEnabledToolsByCategory } from './query.js';

/**
 * 只返回首页、分类页和已启用工具页；不含 tasks/admin，也不含停用工具。
 * 顺序：首页 → 每个分类（按 order）→ 该分类下的启用工具（按 order）。
 */
export function listSitemapPaths(locale: Locale): readonly string[] {
  const paths: string[] = [`/${locale}`];

  const orderedCategories = [...CATEGORIES].sort(
    (left, right) => left.order - right.order,
  );

  for (const category of orderedCategories) {
    paths.push(`/${locale}/${category.id}`);
    for (const tool of listEnabledToolsByCategory(category.id)) {
      paths.push(`/${locale}/${category.id}/${tool.id}`);
    }
  }

  return Object.freeze(paths);
}
