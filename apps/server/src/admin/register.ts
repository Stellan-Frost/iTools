/**
 * 管理后台组装：把认证与写接口挂到同一个 Fastify 实例。
 * 两条路由组只通过依赖交互，避免彼此直接 import。
 */
import { randomUUID } from 'node:crypto';

import type {
  AdminCredentialRepository,
  AdminSessionRepository,
  AdminVersionRepository,
  CatalogRepository,
  ToolCatalogItem,
} from '@itools/contracts';
import type { FastifyInstance } from 'fastify';

import { createAdminGuard } from './auth/guard.js';
import { registerAdminAuthRoutes } from './auth/routes.js';
import { createSessionToken } from './auth/tokens.js';
import type { AdminAuthDeps, AdminWriteDeps } from './types.js';
import { registerAdminWriteRoutes } from './writes/routes.js';

export interface AdminRegistrationDeps {
  readonly credentials: AdminCredentialRepository;
  readonly sessions: AdminSessionRepository;
  readonly versions: AdminVersionRepository;
  readonly catalog: CatalogRepository;
  readonly readRegistryItem: (toolId: string) => ToolCatalogItem | undefined;
  /** `ADMIN_SETUP_TOKEN`；undefined 表示初始化入口不存在。 */
  readonly setupToken: string | undefined;
  /** 生产环境为 true，Cookie 加 Secure。 */
  readonly secureCookies: boolean;
  /** 提供时对写请求做 Origin 校验，应传站点来源。 */
  readonly allowedOrigin?: string;
  readonly now?: () => Date;
}

export function registerAdmin(
  app: FastifyInstance,
  deps: AdminRegistrationDeps,
): void {
  const now = deps.now ?? (() => new Date());

  const authDeps: AdminAuthDeps = {
    credentials: deps.credentials,
    sessions: deps.sessions,
    setupToken: deps.setupToken,
    now,
    secureCookies: deps.secureCookies,
    createSessionId: () => randomUUID(),
    createToken: createSessionToken,
  };

  const writeDeps: AdminWriteDeps = {
    catalog: deps.catalog,
    versions: deps.versions,
    now,
    readRegistryItem: deps.readRegistryItem,
    guard: createAdminGuard({
      sessions: deps.sessions,
      now,
      ...(deps.allowedOrigin === undefined
        ? {}
        : { allowedOrigin: deps.allowedOrigin }),
    }),
  };

  registerAdminAuthRoutes(app, authDeps);
  registerAdminWriteRoutes(app, writeDeps);
}
