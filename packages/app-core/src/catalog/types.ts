import type { LocalizedText } from '@itools/contracts';

export type { LocalizedText };

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

export interface SampleTask {
  id: string;
  toolId: string;
  status: LocalizedText;
  timeLabel: LocalizedText;
}
