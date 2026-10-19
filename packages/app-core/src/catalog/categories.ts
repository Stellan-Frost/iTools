import { CATEGORIES } from './data/categories.js';
import { CATEGORY_IDS } from './types.js';
import type { CatalogCategory, CategoryId } from './types.js';

const categoriesById = new Map<string, CatalogCategory>(
  CATEGORIES.map((category): [string, CatalogCategory] => [
    category.id,
    category,
  ]),
);

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export function getCategory(categoryId: string): CatalogCategory | undefined {
  return categoriesById.get(categoryId);
}
