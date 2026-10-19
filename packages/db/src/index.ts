/**
 * 公开入口：阶段 7 的数据层与目录合并。
 * 分层：schema（表结构）→ infrastructure（pg 连接与仓储）→ catalog（注册表 + 覆盖合并）。
 */
export {
  adminSessions,
  toolLocalizations,
  toolMetadataVersions,
  tools,
} from './schema/tables.js';
export type {
  AdminSessionRow,
  ToolLocalizationRow,
  ToolMetadataVersionRow,
  ToolRow,
} from './schema/tables.js';

export { createPool } from './infrastructure/pool.js';
export type { PoolOptions } from './infrastructure/pool.js';
export { createPgCatalogRepository } from './infrastructure/pg-catalog-repository.js';
export type { PgCatalogRepositoryOptions } from './infrastructure/pg-catalog-repository.js';
export { createPgAdminCredentialRepository } from './infrastructure/pg-admin-credentials.js';
export { createPgAdminSessionRepository } from './infrastructure/pg-admin-sessions.js';
export { createPgAdminVersionRepository } from './infrastructure/pg-admin-versions.js';
export { createDatabaseProbe } from './infrastructure/probe.js';
export type { DatabaseProbeOptions } from './infrastructure/probe.js';

export { migrate, MIGRATIONS_DIR } from './migrate.js';
export type { MigrateOptions, MigrateReport } from './migrate.js';

export { createPgSeedWriter } from './infrastructure/pg-seed-writer.js';

export {
  createRegistryOnlyCatalog,
  createToolCatalogService,
} from './catalog/tool-catalog-service.js';
export type { CreateToolCatalogServiceOptions } from './catalog/tool-catalog-service.js';
export { seedCatalog } from './catalog/seed-catalog.js';
export type { SeedCatalogOptions } from './catalog/seed-catalog.js';
export {
  findRegistryItem,
  listRegistryToolIds,
} from './catalog/registry-info.js';
