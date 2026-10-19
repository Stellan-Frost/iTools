/**
 * 数据库表结构（冻结文件）：由根 Agent 维护，实施 Agent 不得修改。
 * 原则（M1）：注册表是工具身份与可用性的唯一来源，数据库只保存「覆盖」。
 * 因此这里没有 `enabled` 布尔值，也没有 category —— 它们只存在于代码注册表。
 */
import type { Locale } from '@itools/contracts';
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const tools = pgTable('tools', {
  toolId: text('tool_id').primaryKey(),
  /** null 表示沿用注册表顺序。 */
  displayOrder: integer('display_order'),
  /** 只允许降级为 'disabled'；无法通过数据库启用实现。 */
  availabilityOverride: text('availability_override'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const toolLocalizations = pgTable(
  'tool_localizations',
  {
    toolId: text('tool_id')
      .notNull()
      .references(() => tools.toolId, { onDelete: 'cascade' }),
    locale: text('locale').$type<Locale>().notNull(),
    /** 三列均可为 null：null 表示沿用注册表默认文案。 */
    name: text('name'),
    summary: text('summary'),
    description: text('description'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.toolId, table.locale] }),
    index('tool_localizations_locale_idx').on(table.locale),
  ],
);

/** 元数据快照：阶段 8 的预览与回滚依赖它，写入时保存整条展示数据。 */
export const toolMetadataVersions = pgTable(
  'tool_metadata_versions',
  {
    versionId: bigserial('version_id', { mode: 'number' }).primaryKey(),
    toolId: text('tool_id')
      .notNull()
      .references(() => tools.toolId, { onDelete: 'cascade' }),
    locale: text('locale').$type<Locale>(),
    snapshot: jsonb('snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => [
    index('tool_metadata_versions_tool_idx').on(table.toolId, table.createdAt),
  ],
);

/** 唯一管理员会话；阶段 8 才写入，这里先固定形状。 */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    sessionId: text('session_id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('admin_sessions_token_hash_idx').on(table.tokenHash),
    index('admin_sessions_expires_idx').on(table.expiresAt),
  ],
);

export type ToolRow = typeof tools.$inferSelect;
export type ToolLocalizationRow = typeof toolLocalizations.$inferSelect;
export type ToolMetadataVersionRow = typeof toolMetadataVersions.$inferSelect;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
