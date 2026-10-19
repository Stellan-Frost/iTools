/** 全站命名空间；新增命名空间须同时更新 resources/index.ts 与 docs/20。 */
export const NAMESPACES = [
  'common',
  'navigation',
  'catalog',
  'tasks',
  'admin',
] as const;

export type Namespace = (typeof NAMESPACES)[number];
