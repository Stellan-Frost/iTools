/**
 * 管理后台契约（阶段 8）：请求体、错误码、仓储端口。
 * 冻结文件：由根 Agent 维护，实施 Agent 不得修改。
 */
import Type, { type Static } from 'typebox';

import { LOCALES } from './locale.js';
import type { Locale } from './locale.js';

/** 口令最小长度；初始化与后续修改共用同一约束。 */
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 200;

export const AdminErrorCode = {
  alreadyInitialized: 'ADMIN_ALREADY_INITIALIZED',
  notInitialized: 'ADMIN_NOT_INITIALIZED',
  notAuthenticated: 'ADMIN_NOT_AUTHENTICATED',
  invalidCredentials: 'ADMIN_INVALID_CREDENTIALS',
  invalidRequest: 'ADMIN_INVALID_REQUEST',
  toolNotFound: 'ADMIN_TOOL_NOT_FOUND',
  versionNotFound: 'ADMIN_VERSION_NOT_FOUND',
  csrfFailed: 'ADMIN_CSRF_FAILED',
  rateLimited: 'ADMIN_RATE_LIMITED',
  versionConflict: 'ADMIN_VERSION_CONFLICT',
  unavailable: 'ADMIN_UNAVAILABLE',
} as const;

export type AdminErrorCodeValue =
  (typeof AdminErrorCode)[keyof typeof AdminErrorCode];

export const AdminSetupRequestSchema = Type.Object(
  {
    token: Type.String({ minLength: 1, maxLength: 512 }),
    password: Type.String({
      minLength: ADMIN_PASSWORD_MIN_LENGTH,
      maxLength: ADMIN_PASSWORD_MAX_LENGTH,
    }),
  },
  { additionalProperties: false },
);

export const AdminLoginRequestSchema = Type.Object(
  {
    password: Type.String({
      minLength: 1,
      maxLength: ADMIN_PASSWORD_MAX_LENGTH,
    }),
  },
  { additionalProperties: false },
);

export const AdminSessionInfoSchema = Type.Object(
  {
    expiresAt: Type.String({ minLength: 1 }),
    lastSeenAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

/** 单语言补丁：只为出现的字段写覆盖。 */
export const AdminLocalizedPatchSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    summary: Type.Optional(Type.String({ minLength: 1, maxLength: 400 })),
    description: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
  },
  { additionalProperties: false },
);

export const AdminMetadataPatchSchema = Type.Object(
  {
    localizations: Type.Object(
      {
        'zh-CN': Type.Optional(AdminLocalizedPatchSchema),
        en: Type.Optional(AdminLocalizedPatchSchema),
      },
      { additionalProperties: false },
    ),
    order: Type.Optional(Type.Integer({ minimum: -9999, maximum: 9999 })),
  },
  { additionalProperties: false },
);

/** `registry` 表示清除覆盖、回落到注册表默认。 */
export const AdminAvailabilityPatchSchema = Type.Object(
  {
    override: Type.Union([Type.Literal('disabled'), Type.Literal('registry')]),
  },
  { additionalProperties: false },
);

export const AdminVersionSchema = Type.Object(
  {
    versionId: Type.Integer(),
    toolId: Type.String({ minLength: 1 }),
    locale: Type.Unsafe<Locale>({
      type: 'string',
      enum: [...LOCALES],
    }),
    name: Type.String({ minLength: 1 }),
    summary: Type.String({ minLength: 1 }),
    description: Type.String({ minLength: 1 }),
    createdAt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

/** 回滚必须带上管理员看到的当前版本，用于防止覆盖较新修改。 */
export const AdminRollbackRequestSchema = Type.Object(
  {
    versionId: Type.Integer(),
    expectedVersionId: Type.Integer(),
  },
  { additionalProperties: false },
);

export type AdminSetupRequest = Static<typeof AdminSetupRequestSchema>;
export type AdminLoginRequest = Static<typeof AdminLoginRequestSchema>;
export type AdminSessionInfo = Static<typeof AdminSessionInfoSchema>;
export type AdminLocalizedPatch = Static<typeof AdminLocalizedPatchSchema>;
export type AdminMetadataPatch = Static<typeof AdminMetadataPatchSchema>;
export type AdminAvailabilityPatch = Static<
  typeof AdminAvailabilityPatchSchema
>;
export type AdminVersion = Static<typeof AdminVersionSchema>;
export type AdminRollbackRequest = Static<typeof AdminRollbackRequestSchema>;

/* ------------------------------------------------------------------ *
 * 仓储端口：上层只依赖这些接口，实现可以是 pg 或测试替身。
 * ------------------------------------------------------------------ */

export interface AdminCredentialRecord {
  readonly passwordHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminCredentialRepository {
  /** 唯一管理员；未初始化时返回 undefined。 */
  get(): Promise<AdminCredentialRecord | undefined>;
  /** 并发保护：已存在时必须失败，不得覆盖。 */
  create(passwordHash: string): Promise<boolean>;
  updatePasswordHash(passwordHash: string): Promise<void>;
}

export interface AdminSessionRecord {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly revokedAt?: string;
}

export interface CreateAdminSessionInput {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface AdminSessionRepository {
  create(input: CreateAdminSessionInput): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AdminSessionRecord | undefined>;
  /** 滑动续期：同时刷新 last_seen_at 与绝对过期时间。 */
  touch(
    sessionId: string,
    lastSeenAt: string,
    expiresAt: string,
  ): Promise<void>;
  revoke(sessionId: string, revokedAt: string): Promise<void>;
  /** 口令重置后撤销全部会话。 */
  revokeAll(revokedAt: string): Promise<number>;
  deleteExpired(now: string): Promise<number>;
}

export interface AdminVersionRecord {
  readonly versionId: number;
  readonly toolId: string;
  readonly locale: Locale;
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly createdAt: string;
}

export interface AppendAdminVersionInput {
  readonly toolId: string;
  readonly locale: Locale;
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly createdAt: string;
}

export interface AdminVersionRepository {
  append(input: AppendAdminVersionInput): Promise<AdminVersionRecord>;
  /** 按时间倒序；同一工具两个语言混排，调用方可自行过滤。 */
  listByTool(toolId: string): Promise<readonly AdminVersionRecord[]>;
  findById(versionId: number): Promise<AdminVersionRecord | undefined>;
  findLatest(
    toolId: string,
    locale: Locale,
  ): Promise<AdminVersionRecord | undefined>;
  /** 只保留每个 (tool, locale) 最近 `keep` 条，返回删除数量。 */
  trim(toolId: string, locale: Locale, keep: number): Promise<number>;
}

/** D30：每个「工具 + 语言」保留的版本数。 */
export const ADMIN_VERSION_RETENTION = 50;
