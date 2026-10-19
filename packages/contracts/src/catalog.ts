import Type, { type Static } from 'typebox';

import type { Locale } from './locale.js';
import { ToolCategorySchema } from './tool.js';
import type { ToolCategory } from './tool.js';
import { TOOL_AVAILABILITIES } from './tool-registry.js';
import type { ToolAvailability } from './tool-registry.js';

/** 双语展示文本；两种语言都必须有值，缺语言视为数据错误。 */
export const LocalizedTextSchema = Type.Object(
  {
    'zh-CN': Type.String({ minLength: 1 }),
    en: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const CatalogItemSourceSchema = Type.Union([
  Type.Literal('registry'),
  Type.Literal('override'),
]);

/** 与 `TOOL_AVAILABILITIES` 同源，避免两处枚举漂移。 */
export const CatalogAvailabilitySchema = Type.Unsafe<ToolAvailability>({
  type: 'string',
  enum: [...TOOL_AVAILABILITIES],
});

/**
 * 对外暴露的工具目录条目：注册表提供身份与默认值，数据库只能覆盖展示字段。
 * `source` 标明本次结果是否被运营覆盖过，便于前端与审计区分。
 */
export const ToolCatalogItemSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    category: ToolCategorySchema,
    availability: CatalogAvailabilitySchema,
    name: LocalizedTextSchema,
    summary: LocalizedTextSchema,
    description: LocalizedTextSchema,
    order: Type.Integer(),
    source: CatalogItemSourceSchema,
  },
  { additionalProperties: false },
);

export const DatabaseHealthSchema = Type.Union([
  Type.Literal('ok'),
  Type.Literal('unavailable'),
  Type.Literal('skipped'),
]);

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]),
    checks: Type.Object(
      { database: DatabaseHealthSchema },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export type CatalogItemSource = Static<typeof CatalogItemSourceSchema>;
export type ToolCatalogItem = Static<typeof ToolCatalogItemSchema>;
export type DatabaseHealth = Static<typeof DatabaseHealthSchema>;
export type HealthResponse = Static<typeof HealthResponseSchema>;

/* ------------------------------------------------------------------ *
 * 目录服务契约：上层只依赖这些接口，仓储可被 pg 实现或测试替身替换。
 * ------------------------------------------------------------------ */

export interface LocalizationOverride {
  readonly locale: Locale;
  readonly name?: string;
  readonly summary?: string;
  readonly description?: string;
}

/** 某工具的运营覆盖；只有显式存在的字段才算覆盖。 */
export interface CatalogOverride {
  readonly toolId: string;
  readonly displayOrder?: number;
  readonly availabilityOverride?: 'disabled';
  readonly localizations: readonly LocalizationOverride[];
}

export interface CatalogOverrideInput {
  readonly toolId: string;
  /** `null` 表示清除该字段，回落到注册表。 */
  readonly displayOrder: number | null;
  readonly availabilityOverride: 'disabled' | null;
  readonly localizations: readonly LocalizationOverride[];
}

export interface CatalogRepository {
  listOverrides(): Promise<readonly CatalogOverride[]>;
  getOverride(toolId: string): Promise<CatalogOverride | undefined>;
  listLocalizations(toolId: string): Promise<readonly LocalizationOverride[]>;
  upsertOverride(input: CatalogOverrideInput): Promise<void>;
}

export interface ToolCatalogService {
  /** 已按 `order` 升序、同序按 id 升序排好，可直接渲染。 */
  listItems(): Promise<readonly ToolCatalogItem[]>;
  getItem(toolId: string): Promise<ToolCatalogItem | undefined>;
  listByCategory(category: ToolCategory): Promise<readonly ToolCatalogItem[]>;
}

export interface CatalogSeedWriter {
  /** 返回 true 表示本次新建。已存在的行不得被覆盖。 */
  ensureTool(input: {
    readonly toolId: string;
    readonly displayOrder: number;
  }): Promise<boolean>;
  /** 返回 true 表示本次新建。已存在的文案不得被覆盖。 */
  ensureLocalization(input: {
    readonly toolId: string;
    readonly locale: Locale;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
  }): Promise<boolean>;
}

export interface SeedReport {
  readonly createdToolIds: readonly string[];
  readonly createdLocalizationKeys: readonly string[];
  readonly existingToolIds: readonly string[];
}
