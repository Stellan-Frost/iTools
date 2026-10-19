import type { TSchema } from 'typebox';
import type { Locale } from './locale.js';
import type { ToolCategory, ToolDefinition } from './tool.js';

/** 阶段 4 冻结的工具可用性三态。 */
export const TOOL_AVAILABILITIES = [
  'preview',
  'implemented',
  'disabled',
] as const;

export type ToolAvailability = (typeof TOOL_AVAILABILITIES)[number];

/** 所有面向用户的内容都必须同时提供中英两版，不允许回退占位。 */
export type LocalizedText = Record<Locale, string>;

export interface ToolWorkspaceLine {
  label: LocalizedText;
  /** 原文值，两种语言下保持一致。 */
  value: string;
}

/** 预览页展示的示例内容；不代表真实处理结果。 */
export interface ToolPreviewContent {
  inputLabel: LocalizedText;
  sampleInput: LocalizedText;
  workspaceTitle: LocalizedText;
  workspaceLines: readonly ToolWorkspaceLine[];
}

/** 注册表中与实现无关的展示元数据。 */
export interface ToolCatalogMetadata {
  /** 稳定 kebab-case 标识，同时作为 routeKey。 */
  id: string;
  category: ToolCategory;
  icon: string;
  order: number;
  name: LocalizedText;
  summary: LocalizedText;
  /** SEO 描述，1–2 句。 */
  description: LocalizedText;
  preview: ToolPreviewContent;
}

export interface PreviewRegistryEntry {
  availability: 'preview';
  metadata: ToolCatalogMetadata;
}

/** 工具包自带的 `tools/<id>` 命名空间资源。 */
export type ToolTranslationResources = Partial<
  Record<Locale, Record<string, Record<string, string>>>
>;

export interface ImplementedRegistryEntry {
  availability: 'implemented';
  metadata: ToolCatalogMetadata;
  definition: ToolDefinition<TSchema, TSchema>;
  resources: ToolTranslationResources;
}

export interface DisabledRegistryEntry {
  availability: 'disabled';
  metadata: ToolCatalogMetadata;
}

export type RegistryEntry =
  PreviewRegistryEntry | ImplementedRegistryEntry | DisabledRegistryEntry;

export function isPreviewEntry(
  entry: RegistryEntry,
): entry is PreviewRegistryEntry {
  return entry.availability === 'preview';
}

export function isImplementedEntry(
  entry: RegistryEntry,
): entry is ImplementedRegistryEntry {
  return entry.availability === 'implemented';
}
