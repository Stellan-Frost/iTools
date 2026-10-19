import { CATEGORIES } from './data/categories.js';
import { TOOLS } from './data/tools.js';
import { CATEGORY_IDS } from './types.js';
import type { CatalogCategory, CatalogTool, CategoryId } from './types.js';

const categoriesById = new Map<string, CatalogCategory>(
  CATEGORIES.map((category): [string, CatalogCategory] => [
    category.id,
    category,
  ]),
);

const toolsById = new Map<string, CatalogTool>(
  TOOLS.map((tool): [string, CatalogTool] => [tool.id, tool]),
);

const toolsByOrder: readonly CatalogTool[] = Object.freeze(
  [...TOOLS].sort((left, right) => left.order - right.order),
);

const enabledTools: readonly CatalogTool[] = Object.freeze(
  toolsByOrder.filter((tool) => tool.enabled),
);

const emptyTools: readonly CatalogTool[] = Object.freeze([]);

const enabledToolsByCategory = new Map<CategoryId, readonly CatalogTool[]>();
for (const categoryId of CATEGORY_IDS) {
  enabledToolsByCategory.set(
    categoryId,
    Object.freeze(
      enabledTools.filter((tool) => tool.categoryId === categoryId),
    ),
  );
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export function getCategory(categoryId: string): CatalogCategory | undefined {
  return categoriesById.get(categoryId);
}

/** 返回全部工具（含停用项），按 order 升序。 */
export function listTools(): readonly CatalogTool[] {
  return toolsByOrder;
}

/** 返回已启用工具，按 order 升序。 */
export function listEnabledTools(): readonly CatalogTool[] {
  return enabledTools;
}

export function findTool(toolId: string): CatalogTool | undefined {
  return toolsById.get(toolId);
}

export function findEnabledTool(toolId: string): CatalogTool | undefined {
  const tool = toolsById.get(toolId);
  return tool?.enabled === true ? tool : undefined;
}

export function listEnabledToolsByCategory(
  categoryId: CategoryId,
): readonly CatalogTool[] {
  return enabledToolsByCategory.get(categoryId) ?? emptyTools;
}
