/**
 * 目录运行时：有 DATABASE_URL 时读数据库覆盖，没有时完全回落到代码注册表。
 * 数据库不可用不应让整个站点无法启动（M1：注册表权威，DB 只是覆盖层）。
 */
import {
  createDatabaseProbe,
  createPgAdminCredentialRepository,
  createPgAdminSessionRepository,
  createPgAdminVersionRepository,
  createPgCatalogRepository,
  createPool,
  createRegistryOnlyCatalog,
  createToolCatalogService,
  findRegistryItem,
} from '@itools/db';
import type { DatabaseHealth, ToolCatalogService } from '@itools/contracts';

import type { AdminRegistrationDeps } from './admin/register.js';

export interface CatalogRuntime {
  readonly catalog: ToolCatalogService;
  readonly probeDatabase?: () => Promise<DatabaseHealth>;
  readonly admin?: AdminRegistrationDeps;
  close(): Promise<void>;
}

export interface CatalogRuntimeOptions {
  readonly databaseUrl?: string;
  readonly adminSetupToken?: string;
  /** 生产环境为 true，会话 Cookie 加 Secure。 */
  readonly secureCookies: boolean;
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
  const repository = createPgCatalogRepository({ pool });
  const catalog = createToolCatalogService({ repository });

  return {
    catalog,
    probeDatabase: createDatabaseProbe({ pool }),
    admin: {
      credentials: createPgAdminCredentialRepository({ pool }),
      sessions: createPgAdminSessionRepository({ pool }),
      versions: createPgAdminVersionRepository({ pool }),
      catalog: repository,
      readRegistryItem: findRegistryItem,
      setupToken: options.adminSetupToken,
      secureCookies: options.secureCookies,
    },
    close: async () => {
      await pool.end();
    },
  };
}
