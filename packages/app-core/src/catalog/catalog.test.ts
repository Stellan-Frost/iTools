import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  CATEGORY_IDS,
  SAMPLE_TASKS,
  getCategory,
  isCategoryId,
} from './index.js';
import type { LocalizedText } from './index.js';

const CHINESE_PATTERN = /[\u3400-\u9fff]/;

function expectLocalizedText(label: string, text: LocalizedText): void {
  expect(text['zh-CN'].trim(), `${label} 缺少中文`).not.toBe('');
  expect(text.en.trim(), `${label} 缺少英文`).not.toBe('');
  expect(text.en, `${label} 英文残留中文`).not.toMatch(CHINESE_PATTERN);
}

describe('catalog categories', () => {
  it('提供冻结的五个分类并按 order 排列', () => {
    expect(CATEGORIES).toHaveLength(5);
    expect(CATEGORIES.map((category) => category.id)).toEqual([
      ...CATEGORY_IDS,
    ]);
    expect(CATEGORIES.map((category) => category.order)).toEqual([
      10, 20, 30, 40, 50,
    ]);
  });

  it('每个分类的双语字段完整且英文不含中文', () => {
    for (const category of CATEGORIES) {
      expectLocalizedText(`分类 ${category.id} name`, category.name);
      expectLocalizedText(`分类 ${category.id} shortName`, category.shortName);
      expectLocalizedText(
        `分类 ${category.id} description`,
        category.description,
      );
      expect(category.icon.trim(), `分类 ${category.id} 缺少图标`).not.toBe('');
    }
  });

  it('按 id 查找分类，未知分类返回 undefined', () => {
    expect(getCategory('text')?.id).toBe('text');
    expect(getCategory('documents')).toBeUndefined();
    expect(getCategory('')).toBeUndefined();
    expect(isCategoryId('text')).toBe(true);
    expect(isCategoryId('documents')).toBe(false);
    expect(isCategoryId('')).toBe(false);
  });

  it('导出的数组是只读视图', () => {
    expect(Object.isFrozen(CATEGORIES)).toBe(true);
    expect(Object.isFrozen(SAMPLE_TASKS)).toBe(true);
  });
});

describe('catalog sample tasks', () => {
  it('样本任务双语完整且字段非空', () => {
    expect(SAMPLE_TASKS).toHaveLength(3);
    for (const task of SAMPLE_TASKS) {
      expect(task.id.trim(), '任务 id 不能为空').not.toBe('');
      expect(task.toolId.trim(), `任务 ${task.id} toolId 不能为空`).not.toBe(
        '',
      );
      expectLocalizedText(`任务 ${task.id} status`, task.status);
      expectLocalizedText(`任务 ${task.id} timeLabel`, task.timeLabel);
    }
  });

  it('样本任务 id 唯一', () => {
    const ids = SAMPLE_TASKS.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
