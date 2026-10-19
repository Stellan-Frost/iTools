import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  CATEGORY_IDS,
  SAMPLE_TASKS,
  TOOLS,
  findEnabledTool,
  findTool,
  getCategory,
  isCategoryId,
  listEnabledTools,
  listEnabledToolsByCategory,
  listSitemapPaths,
  listTools,
  searchEnabledTools,
  type LocalizedText,
} from './index.js';

const CHINESE_PATTERN = /[\u3400-\u9fff]/;
const DISABLED_TOOL_ID = 'csv-inspector';

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
});

describe('catalog tools', () => {
  it('工具 id 唯一且 categoryId 合法', () => {
    const ids = TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tool of TOOLS) {
      expect(
        isCategoryId(tool.categoryId),
        `工具 ${tool.id} 的分类 ${tool.categoryId}`,
      ).toBe(true);
      expect(
        getCategory(tool.categoryId),
        `工具 ${tool.id} 的分类不存在`,
      ).toBeDefined();
    }
  });

  it('每个工具的双语字段、预览与工作区行完整', () => {
    for (const tool of TOOLS) {
      expectLocalizedText(`工具 ${tool.id} name`, tool.name);
      expectLocalizedText(`工具 ${tool.id} summary`, tool.summary);
      expectLocalizedText(`工具 ${tool.id} description`, tool.description);
      expectLocalizedText(
        `工具 ${tool.id} inputLabel`,
        tool.preview.inputLabel,
      );
      expectLocalizedText(
        `工具 ${tool.id} sampleInput`,
        tool.preview.sampleInput,
      );
      expectLocalizedText(
        `工具 ${tool.id} workspaceTitle`,
        tool.preview.workspaceTitle,
      );
      expect(tool.icon.trim()).not.toBe('');
      expect(tool.preview.workspaceLines.length).toBeGreaterThanOrEqual(3);
      expect(tool.preview.workspaceLines.length).toBeLessThanOrEqual(4);

      for (const line of tool.preview.workspaceLines) {
        expectLocalizedText(`工具 ${tool.id} 工作区行标签`, line.label);
        expect(line.value.trim()).not.toBe('');
        expect(line.value).not.toMatch(CHINESE_PATTERN);
      }
    }
  });

  it('listTools 返回全部工具并按 order 升序', () => {
    expect(listTools()).toHaveLength(TOOLS.length);
    const orders = listTools().map((tool) => tool.order);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));
  });

  it('listEnabledTools 只包含启用工具', () => {
    const enabled = listEnabledTools();
    expect(enabled).toHaveLength(6);
    expect(enabled.every((tool) => tool.enabled)).toBe(true);
    expect(enabled.map((tool) => tool.id)).not.toContain(DISABLED_TOOL_ID);
  });

  it('按分类列出启用工具，空分类返回空列表', () => {
    expect(listEnabledToolsByCategory('audio')).toEqual([]);
    expect(listEnabledToolsByCategory('video')).toEqual([]);
    expect(listEnabledToolsByCategory('image').map((tool) => tool.id)).toEqual([
      'image-inspector',
    ]);
    expect(listEnabledToolsByCategory('text').map((tool) => tool.id)).toEqual([
      'markdown-preview',
      'json-viewer',
      'regex-playground',
      'text-diff',
    ]);
    expect(listEnabledToolsByCategory('other').map((tool) => tool.id)).toEqual([
      'timestamp-converter',
    ]);
  });

  it('停用工具可被 findTool 找到，但不出现在启用视图与搜索中', () => {
    const disabled = findTool(DISABLED_TOOL_ID);
    expect(disabled?.enabled).toBe(false);
    expect(findEnabledTool(DISABLED_TOOL_ID)).toBeUndefined();
    expect(searchEnabledTools('csv', 'en')).toEqual([]);
    expect(searchEnabledTools('CSV 检查器', 'zh-CN')).toEqual([]);
    expect(listSitemapPaths('zh-CN')).not.toContain(
      `/zh-CN/text/${DISABLED_TOOL_ID}`,
    );
  });

  it('未知工具返回 undefined', () => {
    expect(findTool('missing-tool')).toBeUndefined();
    expect(findEnabledTool('missing-tool')).toBeUndefined();
  });

  it('导出的数组是只读视图', () => {
    expect(Object.isFrozen(CATEGORIES)).toBe(true);
    expect(Object.isFrozen(TOOLS)).toBe(true);
    expect(Object.isFrozen(SAMPLE_TASKS)).toBe(true);
    expect(Object.isFrozen(listTools())).toBe(true);
    expect(Object.isFrozen(listEnabledTools())).toBe(true);
    expect(Object.isFrozen(TOOLS[0]?.preview.workspaceLines)).toBe(true);
  });
});

describe('catalog sample tasks', () => {
  it('样本任务引用真实工具且双语完整', () => {
    expect(SAMPLE_TASKS).toHaveLength(3);
    for (const task of SAMPLE_TASKS) {
      expect(
        findTool(task.toolId),
        `任务 ${task.id} 引用了不存在的工具`,
      ).toBeDefined();
      expectLocalizedText(`任务 ${task.id} status`, task.status);
      expectLocalizedText(`任务 ${task.id} timeLabel`, task.timeLabel);
    }
  });
});

describe('searchEnabledTools', () => {
  const ids = (query: string, locale: 'zh-CN' | 'en'): string[] =>
    searchEnabledTools(query, locale).map((tool) => tool.id);

  it('空查询与空白查询返回全部启用工具', () => {
    expect(ids('', 'zh-CN')).toEqual([
      'image-inspector',
      'markdown-preview',
      'json-viewer',
      'regex-playground',
      'timestamp-converter',
      'text-diff',
    ]);
    expect(ids('   ', 'en')).toHaveLength(6);
  });

  it('中文查询命中名称、摘要与分类名', () => {
    expect(ids('图片', 'zh-CN')).toEqual(['image-inspector']);
    expect(ids('时间戳', 'zh-CN')).toEqual(['timestamp-converter']);
    expect(ids('排版', 'zh-CN')).toEqual(['markdown-preview']);
    expect(ids('图像与设计', 'zh-CN')).toEqual(['image-inspector']);
  });

  it('英文查询命中名称、摘要与分类名且不区分大小写', () => {
    expect(ids('markdown', 'en')).toEqual(['markdown-preview']);
    expect(ids('MARKDOWN', 'en')).toEqual(['markdown-preview']);
    expect(ids('images', 'en')).toEqual(['image-inspector']);
    expect(ids('timestamp', 'en')).toEqual(['timestamp-converter']);
  });

  it('无匹配返回空数组', () => {
    expect(ids('nothing-matches', 'en')).toEqual([]);
    expect(ids('不存在的词', 'zh-CN')).toEqual([]);
  });

  it('结果按 order 升序且不含停用工具', () => {
    const results = searchEnabledTools('e', 'en');
    const orders = results.map((tool) => tool.order);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));
    expect(results.every((tool) => tool.enabled)).toBe(true);
  });
});

describe('listSitemapPaths', () => {
  it('中文 Sitemap 精确包含首页、分类页与启用工具页', () => {
    expect(listSitemapPaths('zh-CN')).toEqual([
      '/zh-CN',
      '/zh-CN/audio',
      '/zh-CN/image',
      '/zh-CN/image/image-inspector',
      '/zh-CN/video',
      '/zh-CN/text',
      '/zh-CN/text/markdown-preview',
      '/zh-CN/text/json-viewer',
      '/zh-CN/text/regex-playground',
      '/zh-CN/text/text-diff',
      '/zh-CN/other',
      '/zh-CN/other/timestamp-converter',
    ]);
  });

  it('英文 Sitemap 结构一致且使用 en 前缀', () => {
    expect(listSitemapPaths('en')).toEqual([
      '/en',
      '/en/audio',
      '/en/image',
      '/en/image/image-inspector',
      '/en/video',
      '/en/text',
      '/en/text/markdown-preview',
      '/en/text/json-viewer',
      '/en/text/regex-playground',
      '/en/text/text-diff',
      '/en/other',
      '/en/other/timestamp-converter',
    ]);
  });

  it('不含 tasks、admin 与停用工具，且无重复项', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      const paths = listSitemapPaths(locale);
      expect(paths.some((path) => path.includes('/tasks'))).toBe(false);
      expect(paths.some((path) => path.includes('/admin'))).toBe(false);
      expect(paths.some((path) => path.includes(DISABLED_TOOL_ID))).toBe(false);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
});
