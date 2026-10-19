import { describe, expect, it } from 'vitest';
import Type from 'typebox';
import Value from 'typebox/value';
import {
  TOOL_CONTRACT_VERSION,
  type ImplementedRegistryEntry,
  type LocalizedText,
  type PreviewRegistryEntry,
  type RegistryEntry,
  type ToolCatalogMetadata,
  type ToolCategory,
  type ToolExecutionContext,
  type ToolManifest,
  type ToolTranslationResources,
} from '@itools/contracts';

import { SAMPLE_TASKS } from '../catalog/index.js';
import type { SampleTask } from '../catalog/index.js';
import {
  PREVIEW_TOOL_ENTRIES,
  createToolRegistry,
  findTool,
  findVisibleTool,
  listImplementedTools,
  listSitemapPaths,
  listTools,
  listVisibleByCategory,
  listVisibleTools,
  searchVisibleTools,
  toolRegistry,
  validateToolRegistry,
} from './index.js';

const CHINESE_PATTERN = /[\u3400-\u9fff]/;
const DISABLED_TOOL_ID = 'csv-inspector';
const FIXTURE_ID = 'fixture-echo';
const FIXTURE_NAMESPACE = 'tools/fixture-echo';

const FixtureInputSchema = Type.Object(
  { text: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
const FixtureOutputSchema = Type.Object({ upper: Type.String() });

const fixtureManifest: ToolManifest = {
  contractVersion: TOOL_CONTRACT_VERSION,
  id: FIXTURE_ID,
  routeKey: FIXTURE_ID,
  category: 'text',
  icon: 'bolt',
  implementationVersion: '0.0.0-test',
  translationNamespace: FIXTURE_NAMESPACE,
  dependencies: [],
  requiredBrowserApis: [],
  supportedFormats: ['text/plain'],
  maxInputBytes: 1024,
  estimatedMemoryBytes: 1024,
  computeClass: 'light',
  resultTypes: ['text'],
};

const fixtureMetadata: ToolCatalogMetadata = {
  id: FIXTURE_ID,
  category: 'text',
  icon: 'bolt',
  order: 70,
  name: { 'zh-CN': '测试回显工具', en: 'Fixture echo' },
  summary: {
    'zh-CN': '仅用于测试执行契约的专用工具。',
    en: 'Test-only tool used to verify the execution contract.',
  },
  description: {
    'zh-CN': '该工具只存在于测试中，不会进入产品注册表。',
    en: 'This tool exists only in tests and never enters the product registry.',
  },
  preview: {
    inputLabel: { 'zh-CN': '测试文本', en: 'Test text' },
    sampleInput: { 'zh-CN': 'hello', en: 'hello' },
    workspaceTitle: { 'zh-CN': '测试工作区', en: 'Test workspace' },
    workspaceLines: Object.freeze([
      { label: { 'zh-CN': '字符数', en: 'Characters' }, value: '5' },
    ]),
  },
};

const fixtureResources: ToolTranslationResources = {
  'zh-CN': { [FIXTURE_NAMESPACE]: { greeting: '你好' } },
  en: { [FIXTURE_NAMESPACE]: { greeting: 'Hello' } },
};

const fixtureEntry: ImplementedRegistryEntry = {
  availability: 'implemented',
  metadata: fixtureMetadata,
  definition: {
    manifest: fixtureManifest,
    inputSchema: FixtureInputSchema,
    outputSchema: FixtureOutputSchema,
    adapter: {
      async execute(input: { text: string }) {
        return { upper: input.text.toUpperCase() };
      },
    },
  },
  resources: fixtureResources,
};

const fixtureContext: ToolExecutionContext = {
  taskId: 'fixture-task',
  cancellation: {
    isCancellationRequested: false,
    throwIfCancellationRequested() {
      // 测试不触发取消。
    },
  },
  reportProgress() {
    // 测试不采集进度。
  },
};

function previewEntry(
  id: string,
  metadataOverrides: Partial<ToolCatalogMetadata> = {},
): PreviewRegistryEntry {
  return {
    availability: 'preview',
    metadata: { ...fixtureMetadata, id, order: 200, ...metadataOverrides },
  };
}

function implementedEntry(
  id: string,
  routeKey: string,
  resources: ToolTranslationResources = fixtureResources,
): ImplementedRegistryEntry {
  return {
    availability: 'implemented',
    metadata: { ...fixtureMetadata, id, order: 150 },
    definition: {
      ...fixtureEntry.definition,
      manifest: { ...fixtureManifest, id, routeKey },
    },
    resources,
  };
}

function sampleTask(id: string, toolId: string): SampleTask {
  return {
    id,
    toolId,
    status: { 'zh-CN': '样本状态', en: 'Sample status' },
    timeLabel: { 'zh-CN': '刚刚', en: 'Just now' },
  };
}

function codesFor(
  entries: readonly RegistryEntry[],
  tasks: readonly SampleTask[] = [],
): readonly string[] {
  return validateToolRegistry(entries, tasks).map((issue) => issue.code);
}

function expectLocalizedText(label: string, text: LocalizedText): void {
  expect(text['zh-CN'].trim(), `${label} 缺少中文`).not.toBe('');
  expect(text.en.trim(), `${label} 缺少英文`).not.toBe('');
  expect(text.en, `${label} 英文残留中文`).not.toMatch(CHINESE_PATTERN);
}

describe('默认注册表', () => {
  it('包含 7 条：6 预览 + 1 停用，无已实现工具', () => {
    expect(toolRegistry.entries).toHaveLength(7);
    expect(
      toolRegistry.entries.filter((entry) => entry.availability === 'preview'),
    ).toHaveLength(6);
    expect(
      toolRegistry.entries.filter((entry) => entry.availability === 'disabled'),
    ).toHaveLength(1);
    expect(listImplementedTools()).toEqual([]);
    expect(PREVIEW_TOOL_ENTRIES).toHaveLength(7);
  });

  it('工具 id 唯一且按 order 升序', () => {
    const ids = toolRegistry.entries.map((entry) => entry.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);

    const orders = toolRegistry.entries.map((entry) => entry.metadata.order);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));
  });

  it('所有展示文案双语非空且英文不含 CJK', () => {
    for (const entry of toolRegistry.entries) {
      const { metadata } = entry;
      expectLocalizedText(`${metadata.id} name`, metadata.name);
      expectLocalizedText(`${metadata.id} summary`, metadata.summary);
      expectLocalizedText(`${metadata.id} description`, metadata.description);
      expectLocalizedText(
        `${metadata.id} inputLabel`,
        metadata.preview.inputLabel,
      );
      expectLocalizedText(
        `${metadata.id} sampleInput`,
        metadata.preview.sampleInput,
      );
      expectLocalizedText(
        `${metadata.id} workspaceTitle`,
        metadata.preview.workspaceTitle,
      );
      expect(metadata.icon.trim(), `${metadata.id} 缺少图标`).not.toBe('');

      for (const line of metadata.preview.workspaceLines) {
        expectLocalizedText(`${metadata.id} 工作区行标签`, line.label);
        expect(line.value.trim(), `${metadata.id} 工作区行为空`).not.toBe('');
      }
    }
  });

  it('默认注册表通过校验', () => {
    expect(validateToolRegistry(toolRegistry.entries, SAMPLE_TASKS)).toEqual(
      [],
    );
  });

  it('导出的集合是只读视图', () => {
    expect(Object.isFrozen(toolRegistry.entries)).toBe(true);
    expect(Object.isFrozen(listVisibleTools())).toBe(true);
    expect(Object.isFrozen(PREVIEW_TOOL_ENTRIES)).toBe(true);
    expect(
      Object.isFrozen(PREVIEW_TOOL_ENTRIES[0]?.metadata.preview.workspaceLines),
    ).toBe(true);
  });
});

describe('可见性与查找', () => {
  it('可见列表排除停用工具，findTool 仍能取到', () => {
    const visibleIds = listVisibleTools().map((entry) => entry.metadata.id);
    expect(visibleIds).not.toContain(DISABLED_TOOL_ID);
    expect(findVisibleTool(DISABLED_TOOL_ID)).toBeUndefined();

    const disabled = findTool(DISABLED_TOOL_ID);
    expect(disabled?.availability).toBe('disabled');
    expect(findTool('missing-tool')).toBeUndefined();
  });

  it('按分类列出可见工具，空分类返回空数组', () => {
    expect(listVisibleByCategory('audio')).toEqual([]);
    expect(listVisibleByCategory('video')).toEqual([]);
    expect(
      listVisibleByCategory('image').map((entry) => entry.metadata.id),
    ).toEqual(['image-inspector']);
    expect(
      listVisibleByCategory('text').map((entry) => entry.metadata.id),
    ).toEqual([
      'markdown-preview',
      'json-viewer',
      'regex-playground',
      'text-diff',
    ]);
    expect(
      listVisibleByCategory('other').map((entry) => entry.metadata.id),
    ).toEqual(['timestamp-converter']);
  });

  it('便捷导出委托默认注册表', () => {
    expect(listTools()).toBe(toolRegistry.entries);
    expect(findTool('json-viewer')?.metadata.id).toBe('json-viewer');
    expect(findVisibleTool('image-inspector')?.availability).toBe('preview');
  });
});

describe('Sitemap', () => {
  it('默认只含首页与五个分类，不含预览与停用工具', () => {
    expect(listSitemapPaths('zh-CN')).toEqual([
      '/zh-CN',
      '/zh-CN/audio',
      '/zh-CN/image',
      '/zh-CN/video',
      '/zh-CN/text',
      '/zh-CN/other',
    ]);

    expect(listSitemapPaths('en')).toEqual([
      '/en',
      '/en/audio',
      '/en/image',
      '/en/video',
      '/en/text',
      '/en/other',
    ]);
  });

  it('注入已实现工具后只加入该工具路径', () => {
    const registry = createToolRegistry([fixtureEntry]);
    const paths = registry.listSitemapPaths('en');

    expect(paths).toContain('/en/text/fixture-echo');
    expect(paths).not.toContain('/en/text/json-viewer');
    expect(paths).not.toContain('/en/text/csv-inspector');
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('搜索', () => {
  it('英文关键词命中 json-viewer，且不区分大小写', () => {
    expect(
      searchVisibleTools('json', 'en').map((entry) => entry.metadata.id),
    ).toEqual(['json-viewer']);
    expect(
      searchVisibleTools('JSON', 'en').map((entry) => entry.metadata.id),
    ).toEqual(['json-viewer']);
  });

  it('中文关键词命中名称、摘要与分类名', () => {
    expect(
      searchVisibleTools('时间戳', 'zh-CN').map((entry) => entry.metadata.id),
    ).toEqual(['timestamp-converter']);
    expect(
      searchVisibleTools('图片', 'zh-CN').map((entry) => entry.metadata.id),
    ).toEqual(['image-inspector']);
    expect(
      searchVisibleTools('图像与设计', 'zh-CN').map(
        (entry) => entry.metadata.id,
      ),
    ).toEqual(['image-inspector']);
  });

  it('不返回停用工具，无匹配返回空数组', () => {
    expect(searchVisibleTools('csv', 'en')).toEqual([]);
    expect(searchVisibleTools('CSV 检查器', 'zh-CN')).toEqual([]);
    expect(searchVisibleTools('nothing-matches', 'en')).toEqual([]);
  });

  it('空查询返回全部可见工具且保持排序', () => {
    const results = searchVisibleTools('   ', 'en');
    expect(results).toHaveLength(6);
    expect(results.map((entry) => entry.metadata.order)).toEqual(
      [...results]
        .map((entry) => entry.metadata.order)
        .sort((left, right) => left - right),
    );
  });
});

describe('createToolRegistry 与执行契约', () => {
  it('注入 fixture 后可被可见/已实现/分类视图找到', () => {
    const registry = createToolRegistry([fixtureEntry]);

    expect(registry.entries).toHaveLength(8);
    expect(registry.listVisibleTools()).toHaveLength(7);
    expect(registry.listImplementedTools()).toEqual([fixtureEntry]);
    expect(registry.findTool(FIXTURE_ID)?.availability).toBe('implemented');
    expect(registry.findVisibleTool(FIXTURE_ID)).toBe(fixtureEntry);
    expect(
      registry.listVisibleByCategory('text').map((entry) => entry.metadata.id),
    ).toContain(FIXTURE_ID);
    expect(registry.findTool(DISABLED_TOOL_ID)?.availability).toBe('disabled');
  });

  it('fixture 注册表通过校验（含样本任务）', () => {
    const registry = createToolRegistry([fixtureEntry]);
    expect(validateToolRegistry(registry.entries, SAMPLE_TASKS)).toEqual([]);
  });

  it('输入校验 → 适配器执行 → 输出校验', async () => {
    const input = { text: 'hello' };

    expect(Value.Check(fixtureEntry.definition.inputSchema, input)).toBe(true);

    const output = await fixtureEntry.definition.adapter.execute(
      input,
      fixtureContext,
    );

    expect(output).toEqual({ upper: 'HELLO' });
    expect(Value.Check(fixtureEntry.definition.outputSchema, output)).toBe(
      true,
    );
  });

  it('非法输入被拒绝，不进入适配器', async () => {
    async function runFixture(input: unknown): Promise<unknown> {
      if (!Value.Check(FixtureInputSchema, input)) {
        throw new Error('invalid fixture input');
      }

      // Value.Check 返回 boolean，不提供类型收窄；断言只发生在运行时校验通过之后。
      return fixtureEntry.definition.adapter.execute(
        input as { text: string },
        fixtureContext,
      );
    }

    await expect(runFixture({})).rejects.toThrow('invalid fixture input');
    await expect(runFixture({ text: '' })).rejects.toThrow(
      'invalid fixture input',
    );
    await expect(runFixture({ text: 'hello', extra: true })).rejects.toThrow(
      'invalid fixture input',
    );
    await expect(runFixture({ text: 'hello' })).resolves.toEqual({
      upper: 'HELLO',
    });
  });
});

describe('validateToolRegistry 负向用例', () => {
  it('重复 id', () => {
    expect(codesFor([previewEntry('dup'), previewEntry('dup')])).toContain(
      'duplicate-id',
    );
  });

  it('重复 routeKey（不同 id 指向同一 routeKey）', () => {
    const entries = [
      implementedEntry('tool-a', 'shared-route'),
      implementedEntry('tool-b', 'shared-route'),
    ];
    expect(codesFor(entries)).toContain('duplicate-route-key');
  });

  it('routeKey 与 metadata.id 不一致', () => {
    expect(codesFor([implementedEntry('tool-a', 'other-route')])).toContain(
      'duplicate-route-key',
    );
  });

  it('非法分类', () => {
    const entry = previewEntry('bad-category', {
      // 测试模拟外部注入的非法分类值。
      category: 'documents' as unknown as ToolCategory,
    });
    expect(codesFor([entry])).toContain('invalid-category');
  });

  it('缺少英文翻译与英文含 CJK', () => {
    const missing = previewEntry('missing-en', {
      name: { 'zh-CN': '缺少英文', en: '' },
    });
    expect(codesFor([missing])).toContain('missing-translation');

    const cjk = previewEntry('cjk-en', {
      summary: { 'zh-CN': '中文摘要', en: '中文 summary' },
    });
    expect(codesFor([cjk])).toContain('missing-translation');
  });

  it('预览条目携带 definition', () => {
    const entry = {
      ...previewEntry('preview-with-definition'),
      definition: fixtureEntry.definition,
    } as unknown as RegistryEntry;

    expect(codesFor([entry])).toContain('preview-with-definition');
  });

  it('已实现条目缺少 definition', () => {
    const entry = {
      availability: 'implemented',
      metadata: { ...fixtureMetadata, id: 'no-definition' },
      resources: fixtureResources,
    } as unknown as RegistryEntry;

    expect(codesFor([entry])).toContain('implemented-without-definition');
  });

  it('已实现条目缺少翻译命名空间', () => {
    const entry = implementedEntry('no-namespace', 'no-namespace', {});
    expect(codesFor([entry])).toContain('implemented-without-namespace');

    const zhOnly: ToolTranslationResources = {
      'zh-CN': { [FIXTURE_NAMESPACE]: { greeting: '你好' } },
    };
    const partial = implementedEntry('zh-only', 'zh-only', zhOnly);
    expect(codesFor([partial])).toContain('implemented-without-namespace');
  });

  it('contractVersion 不匹配', () => {
    const entry = {
      ...implementedEntry('bad-version', 'bad-version'),
      definition: {
        ...fixtureEntry.definition,
        manifest: {
          ...fixtureManifest,
          id: 'bad-version',
          routeKey: 'bad-version',
          // 测试模拟旧/新契约版本的运行时数据。
          contractVersion: 2,
        },
      },
    } as unknown as RegistryEntry;

    expect(codesFor([entry]).length).toBeGreaterThan(0);
    expect(codesFor([entry])).toContain('invalid-contract-version');
  });

  it('样本任务引用不存在的工具', () => {
    expect(
      codesFor([], [sampleTask('task-missing', 'missing-tool')]),
    ).toContain('sample-task-missing-tool');
  });

  it('样本任务引用已停用工具', () => {
    expect(
      codesFor(toolRegistry.entries, [
        sampleTask('task-disabled', DISABLED_TOOL_ID),
      ]),
    ).toContain('sample-task-disabled-tool');
  });

  it('不依赖默认注册表：空数组与空任务无 issue', () => {
    expect(validateToolRegistry([], [])).toEqual([]);
  });
});
