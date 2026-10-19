import type { ToolCatalogItem } from '@itools/contracts';

import type { ToolApiClient } from './client.js';

/** 目录查询的唯一缓存键；写操作（阶段 8）应基于它做失效。 */
export const toolCatalogQueryKey: readonly ['tools'] = ['tools'];

/** 与服务端 `Cache-Control: max-age=60` 对齐。 */
const TOOL_CATALOG_STALE_TIME_MS = 60_000;

export interface ToolCatalogQueryOptions {
  queryKey: readonly ['tools'];
  queryFn: () => Promise<readonly ToolCatalogItem[]>;
  staleTime: number;
}

/**
 * 只导出可复用的查询选项，不调用 `useQuery`；缓存生命周期由 Provider 决定。
 */
export function toolCatalogQueryOptions(
  client: ToolApiClient,
): ToolCatalogQueryOptions {
  return {
    queryKey: toolCatalogQueryKey,
    queryFn: () => client.listTools(),
    staleTime: TOOL_CATALOG_STALE_TIME_MS,
  };
}
