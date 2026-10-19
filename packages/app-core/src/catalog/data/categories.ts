import type { CatalogCategory } from '../types.js';

const categories: readonly CatalogCategory[] = [
  {
    id: 'audio',
    icon: 'graphic_eq',
    order: 10,
    name: { 'zh-CN': '音频与声音', en: 'Audio & sound' },
    shortName: { 'zh-CN': '音频', en: 'Audio' },
    description: {
      'zh-CN': '音频转换、检查与素材整理。',
      en: 'Audio conversion, inspection, and asset organization.',
    },
  },
  {
    id: 'image',
    icon: 'image',
    order: 20,
    name: { 'zh-CN': '图像与设计', en: 'Images & design' },
    shortName: { 'zh-CN': '图像', en: 'Images' },
    description: {
      'zh-CN': '图片整理、尺寸检查与视觉素材预览。',
      en: 'Image organization, size checks, and visual asset previews.',
    },
  },
  {
    id: 'video',
    icon: 'movie',
    order: 30,
    name: { 'zh-CN': '视频与动效', en: 'Video & motion' },
    shortName: { 'zh-CN': '视频', en: 'Video' },
    description: {
      'zh-CN': '视频文件的检查、转码与动效预览。',
      en: 'Video inspection, conversion, and motion previews.',
    },
  },
  {
    id: 'text',
    icon: 'article',
    order: 40,
    name: { 'zh-CN': '文档与文字', en: 'Text & documents' },
    shortName: { 'zh-CN': '文本', en: 'Text' },
    description: {
      'zh-CN': '文本、文档和结构化内容的处理与格式化。',
      en: 'Processing and formatting for text, documents, and structured content.',
    },
  },
  {
    id: 'other',
    icon: 'widgets',
    order: 50,
    name: { 'zh-CN': '实用与其他', en: 'Utilities & other' },
    shortName: { 'zh-CN': '其他', en: 'Other' },
    description: {
      'zh-CN': '时间、标识和常见信息换算等实用工具。',
      en: 'Time, identifiers, and everyday utility conversions.',
    },
  },
];

export const CATEGORIES: readonly CatalogCategory[] = Object.freeze(categories);
