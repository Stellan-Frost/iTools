/**
 * 管理后台接线契约（冻结文件）：由根 Agent 维护，实施 Agent 不得修改。
 * 认证路由与写路由各自只接收依赖，不直接读环境变量或创建连接。
 */
import type {
  AdminCredentialRepository,
  AdminSessionRepository,
  AdminVersionRepository,
  CatalogRepository,
  ToolCatalogItem,
} from '@itools/contracts';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

export const ADMIN_SESSION_COOKIE = 'itools_admin';
export const ADMIN_CSRF_COOKIE = 'itools_admin_csrf';
export const ADMIN_CSRF_HEADER = 'x-csrf-token';

/** 空闲 7 天失效；每次通过校验的请求都滑动续期。 */
export const ADMIN_SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1_000;
/** 绝对有效期 30 天，不因活跃而延长。 */
export const ADMIN_SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1_000;

/** 登录固定限流：窗口内最多 5 次失败尝试。 */
export const ADMIN_LOGIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1_000,
} as const;

export interface AdminAuthDeps {
  readonly credentials: AdminCredentialRepository;
  readonly sessions: AdminSessionRepository;
  /** 来自 `ADMIN_SETUP_TOKEN`；undefined 表示初始化入口不存在。 */
  readonly setupToken: string | undefined;
  readonly now: () => Date;
  /** 生产环境为 true，Cookie 加 Secure。 */
  readonly secureCookies: boolean;
  readonly createSessionId: () => string;
  readonly createToken: () => string;
}

export interface AdminWriteDeps {
  readonly catalog: CatalogRepository;
  readonly versions: AdminVersionRepository;
  readonly now: () => Date;
  /** 注册表原值：用于校验工具存在并补齐快照里的默认文案。 */
  readonly readRegistryItem: (toolId: string) => ToolCatalogItem | undefined;
  /** 由认证模块提供：校验会话与 CSRF，失败直接 401/403。 */
  readonly guard: preHandlerHookHandler;
}

export type RegisterAdminAuthRoutes = (
  app: FastifyInstance,
  deps: AdminAuthDeps,
) => void;

export type RegisterAdminWriteRoutes = (
  app: FastifyInstance,
  deps: AdminWriteDeps,
) => void;
