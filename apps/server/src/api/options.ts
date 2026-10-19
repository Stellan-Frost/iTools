import type { DatabaseHealth, ToolCatalogService } from '@itools/contracts';

/** 只读 API 的可选依赖；不提供时相关端点按不可用处理。 */
export interface ApiOptions {
  readonly catalog?: ToolCatalogService;
  /** 缺省视为 'skipped'（不探测）。 */
  readonly probeDatabase?: () => Promise<DatabaseHealth>;
}
