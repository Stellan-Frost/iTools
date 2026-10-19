import type { Locale } from '@itools/contracts';

/** 所有面向用户的内容都必须同时提供中英两版，不允许回退占位。 */
export type LocalizedText = Record<Locale, string>;

/** 分类集合由 docs/02 冻结，顺序即展示顺序。 */
export const CATEGORY_IDS = [
  'audio',
  'image',
  'video',
  'text',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CatalogCategory {
  id: CategoryId;
  /** Material Symbols 图标名。 */
  icon: string;
  order: number;
  name: LocalizedText;
  shortName: LocalizedText;
  description: LocalizedText;
}

export interface ToolWorkspaceLine {
  label: LocalizedText;
  /** 原文值，两种语言下保持一致。 */
  value: string;
}

export interface CatalogTool {
  /** 稳定 kebab-case 标识，用于 URL。 */
  id: string;
  categoryId: CategoryId;
  icon: string;
  order: number;
  /** 阶段 3 由代码注册表决定；阶段 7 起改由数据库决定。 */
  enabled: boolean;
  name: LocalizedText;
  summary: LocalizedText;
  /** SEO 描述，1–2 句。 */
  description: LocalizedText;
  preview: {
    inputLabel: LocalizedText;
    sampleInput: LocalizedText;
    workspaceTitle: LocalizedText;
    workspaceLines: readonly ToolWorkspaceLine[];
  };
}

export interface SampleTask {
  id: string;
  toolId: string;
  status: LocalizedText;
  timeLabel: LocalizedText;
}
