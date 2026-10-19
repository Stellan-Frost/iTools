/**
 * 管理后台前端契约（冻结文件）：由根 Agent 维护，实施 Agent 不得修改。
 * UI 与网络层只通过这些类型交互，测试可注入 fetch 与 Cookie 读取器。
 */
import type { AdminVersion, Locale } from '@itools/contracts';

export interface AdminSetupStatus {
  readonly available: boolean;
}

export interface AdminSessionInfo {
  readonly expiresAt: string;
  readonly lastSeenAt: string;
}

export interface AdminLocalizedPatch {
  readonly name?: string;
  readonly summary?: string;
  readonly description?: string;
}

export interface AdminMetadataPatch {
  readonly localizations: Readonly<
    Partial<Record<Locale, AdminLocalizedPatch>>
  >;
  readonly order?: number;
}

export type AdminAvailabilityOverride = 'disabled' | 'registry';

export interface AdminMetadataResult {
  readonly toolId: string;
  readonly updatedLocales: readonly string[];
  readonly order: number;
}

export interface AdminAvailabilityResult {
  readonly toolId: string;
  readonly availability: string;
}

export interface AdminRollbackInput {
  readonly versionId: number;
  readonly expectedVersionId: number;
}

export interface AdminRollbackResult {
  readonly versionId: number;
  readonly toolId: string;
  readonly locale: Locale;
}

/** 统一的客户端错误：`code` 与服务端错误码一致，网络失败用 `NETWORK_ERROR`。 */
export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(code: string, status: number, requestId?: string) {
    super(`Admin API error: ${code}`);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

export interface AdminApiClient {
  getSetupStatus(): Promise<AdminSetupStatus>;
  setup(input: {
    readonly token: string;
    readonly password: string;
  }): Promise<AdminSessionInfo>;
  login(password: string): Promise<AdminSessionInfo>;
  logout(): Promise<void>;
  getSession(): Promise<AdminSessionInfo>;
  updateMetadata(
    toolId: string,
    patch: AdminMetadataPatch,
  ): Promise<AdminMetadataResult>;
  setAvailability(
    toolId: string,
    override: AdminAvailabilityOverride,
  ): Promise<AdminAvailabilityResult>;
  listVersions(toolId: string): Promise<readonly AdminVersion[]>;
  rollback(
    toolId: string,
    input: AdminRollbackInput,
  ): Promise<AdminRollbackResult>;
}

export interface AdminApiClientOptions {
  /** 缺省空串（同源）。 */
  readonly baseUrl?: string;
  /** 缺省 globalThis.fetch；测试注入替身。 */
  readonly fetchImpl?: typeof fetch;
  /** 读取可读 Cookie（CSRF token）；缺省读 document.cookie。 */
  readonly readCookie?: (name: string) => string | undefined;
}

export const ADMIN_CSRF_COOKIE_NAME = 'itools_admin_csrf';
export const ADMIN_CSRF_HEADER_NAME = 'x-csrf-token';
