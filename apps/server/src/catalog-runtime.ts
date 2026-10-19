/**
 * 目录运行时：有 DATABASE_URL 时读数据库覆盖，没有时完全回落到代码注册表。
 * 数据库不可用不应让整个站点无法启动（M1：注册表权威，DB 只是覆盖层）。
 */
import {
  createDatabaseProbe,
  createPgCatalogRepository,
  createPool,
  createRegistryOnlyCatalog,
  createToolCatalogService,
} from '@itools/db';
import type { DatabaseHealth, ToolCatalogService } from '@itools/contracts';

export interface CatalogRuntime {
  readonly catalog: ToolCatalogService;
  readonly probeDatabase?: () => Promise<DatabaseHealth>;
  close(): Promise<void>;
}

export interface CatalogRuntimeOptions {
  readonly databaseUrl?: string;
}

export function createCatalogRuntime(
  options: CatalogRuntimeOptions,
): CatalogRuntime {
  if (options.databaseUrl === undefined) {
    return {
      catalog: createRegistryOnlyCatalog(),
      close: async () => undefined,
    };
  }

  const pool = createPool({ connectionString: options.databaseUrl });
  const catalog = createToolCatalogService({
    repository: createPgCatalogRepository({ pool }),
  });

  return {
    catalog,
    probeDatabase: createDatabaseProbe({ pool }),
    close: async () => {
      await pool.end();
    },
  };
}
