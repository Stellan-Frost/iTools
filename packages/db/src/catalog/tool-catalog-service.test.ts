import { describe, expect, it } from 'vitest';

import type {
  CatalogOverride,
  CatalogOverrideInput,
  CatalogRepository,
  LocalizationOverride,
  RegistryEntry,
  ToolCategory,
} from '@itools/contracts';

import { InMemoryCatalogRepository } from '../test-support/in-memory-catalog-repository.js';
import {
  createRegistryOnlyCatalog,
  createToolCatalogService,
} from './tool-catalog-service.js';

interface EntryOptions {
  readonly order?: number;
  readonly category?: ToolCategory;
  readonly availability?: 'preview' | 'disabled';
}

function makeEntry(id: string, options: EntryOptions = {}): RegistryEntry {
  const metadata = {
    id,
    category: options.category ?? 'text',
    icon: 'description',
    order: options.order ?? 10,
    name: { 'zh-CN': `${id} 名称`, en: `${id} name` },
    summary: { 'zh-CN': `${id} 摘要`, en: `${id} summary` },
    description: { 'zh-CN': `${id} 描述`, en: `${id} description` },
    preview: {
      inputLabel: { 'zh-CN': '输入', en: 'Input' },
      sampleInput: { 'zh-CN': '样例', en: 'Sample' },
      workspaceTitle: { 'zh-CN': '工作区', en: 'Workspace' },
      workspaceLines: [],
    },
  };

  if (options.availability === 'disabled') {
    return { availability: 'disabled', metadata };
  }

  return { availability: 'preview', metadata };
}

function localization(
  locale: LocalizationOverride['locale'],
  fields: Omit<LocalizationOverride, 'locale'>,
): LocalizationOverride {
  return { locale, ...fields };
}

function override(
  toolId: string,
  fields: Omit<CatalogOverride, 'toolId' | 'localizations'> & {
    readonly localizations?: readonly LocalizationOverride[];
  },
): CatalogOverride {
  return {
    toolId,
    ...fields,
    localizations: fields.localizations ?? [],
  };
}

class CountingCatalogRepository implements CatalogRepository {
  listOverridesCalls = 0;

  getOverrideCalls = 0;

  constructor(private readonly inner: CatalogRepository) {}

  listOverrides(): Promise<readonly CatalogOverride[]> {
    this.listOverridesCalls += 1;
    return this.inner.listOverrides();
  }

  getOverride(toolId: string): Promise<CatalogOverride | undefined> {
    this.getOverrideCalls += 1;
    return this.inner.getOverride(toolId);
  }

  listLocalizations(toolId: string): Promise<readonly LocalizationOverride[]> {
    return this.inner.listLocalizations(toolId);
  }

  upsertOverride(input: CatalogOverrideInput): Promise<void> {
    return this.inner.upsertOverride(input);
  }
}

function createThrowingRepository(): CatalogRepository {
  return {
    async listOverrides(): Promise<readonly CatalogOverride[]> {
      throw new Error('db down');
    },
    async getOverride(): Promise<CatalogOverride | undefined> {
      throw new Error('db down');
    },
    async listLocalizations(): Promise<readonly LocalizationOverride[]> {
      throw new Error('db down');
    },
    async upsertOverride(): Promise<void> {
      throw new Error('db down');
    },
  };
}

describe('createToolCatalogService', () => {
  it('缺省使用注册表，排除停用条目并按 order 排序', async () => {
    const service = createToolCatalogService({
      repository: new InMemoryCatalogRepository(),
    });

    const items = await service.listItems();

    expect(items.map((item) => item.id)).toEqual([
      'image-inspector',
      'markdown-preview',
      'json-viewer',
      'regex-playground',
      'timestamp-converter',
      'text-diff',
    ]);
    expect(items.every((item) => item.source === 'registry')).toBe(true);
  });

  it('数据库只能停用工具：disabled 覆盖会被排除，且 getItem 返回 undefined', async () => {
    const repository = new InMemoryCatalogRepository({
      overrides: [override('beta', { availabilityOverride: 'disabled' })],
    });
    const service = createToolCatalogService({
      repository,
      entries: [makeEntry('alpha'), makeEntry('beta')],
    });

    const items = await service.listItems();

    expect(items.map((item) => item.id)).toEqual(['alpha']);
    await expect(service.getItem('beta')).resolves.toBeUndefined();
  });

  it('order 覆盖生效，同 order 时按 id 字典序稳定排序', async () => {
    const repository = new InMemoryCatalogRepository({
      overrides: [override('gamma', { displayOrder: 10 })],
    });
    const service = createToolCatalogService({
      repository,
      entries: [
        makeEntry('alpha', { order: 10 }),
        makeEntry('beta', { order: 20 }),
        makeEntry('gamma', { order: 30 }),
      ],
    });

    const items = await service.listItems();

    expect(items.map((item) => item.id)).toEqual(['alpha', 'gamma', 'beta']);
    expect(items.map((item) => item.order)).toEqual([10, 10, 20]);
  });

  it('文案按 locale、按字段回落，空字符串视为未覆盖', async () => {
    const repository = new InMemoryCatalogRepository({
      overrides: [
        override('alpha', {
          localizations: [
            localization('zh-CN', { name: '', summary: '覆盖摘要' }),
            localization('en', { name: 'Overridden name' }),
          ],
        }),
      ],
    });
    const service = createToolCatalogService({
      repository,
      entries: [makeEntry('alpha')],
    });

    const item = await service.getItem('alpha');

    expect(item?.name).toEqual({
      'zh-CN': 'alpha 名称',
      en: 'Overridden name',
    });
    expect(item?.summary).toEqual({
      'zh-CN': '覆盖摘要',
      en: 'alpha summary',
    });
    expect(item?.description).toEqual({
      'zh-CN': 'alpha 描述',
      en: 'alpha description',
    });
  });

  it('文案覆盖与排序覆盖都标记 source 为 override，纯注册表标记 registry', async () => {
    const repository = new InMemoryCatalogRepository({
      overrides: [
        override('alpha', {
          localizations: [localization('en', { description: 'custom' })],
        }),
        override('beta', { displayOrder: 5 }),
      ],
    });
    const service = createToolCatalogService({
      repository,
      entries: [makeEntry('alpha'), makeEntry('beta'), makeEntry('gamma')],
    });

    const items = await service.listItems();
    const sourceById = new Map(items.map((item) => [item.id, item.source]));

    expect(sourceById.get('alpha')).toBe('override');
    expect(sourceById.get('beta')).toBe('override');
    expect(sourceById.get('gamma')).toBe('registry');
  });

  it('listItems 只调用一次 listOverrides，不做逐工具查询', async () => {
    const counting = new CountingCatalogRepository(
      new InMemoryCatalogRepository({
        overrides: [override('beta', { displayOrder: 1 })],
      }),
    );
    const service = createToolCatalogService({
      repository: counting,
      entries: [makeEntry('alpha'), makeEntry('beta'), makeEntry('gamma')],
    });

    await service.listItems();

    expect(counting.listOverridesCalls).toBe(1);
    expect(counting.getOverrideCalls).toBe(0);
  });

  it('仓储异常向上冒泡，不静默返回空目录', async () => {
    const service = createToolCatalogService({
      repository: createThrowingRepository(),
      entries: [makeEntry('alpha')],
    });

    await expect(service.listItems()).rejects.toThrow('db down');
    await expect(service.getItem('alpha')).rejects.toThrow('db down');
    await expect(service.listByCategory('text')).rejects.toThrow('db down');
  });

  it('getItem 对注册表中不存在的 id 直接返回 undefined，不访问仓储', async () => {
    const counting = new CountingCatalogRepository(
      new InMemoryCatalogRepository(),
    );
    const service = createToolCatalogService({
      repository: counting,
      entries: [makeEntry('alpha')],
    });

    await expect(service.getItem('missing')).resolves.toBeUndefined();
    expect(counting.getOverrideCalls).toBe(0);
  });

  it('getItem 合并且不改变分类', async () => {
    const repository = new InMemoryCatalogRepository({
      overrides: [
        override('alpha', {
          displayOrder: 3,
          localizations: [localization('zh-CN', { name: '运营名' })],
        }),
      ],
    });
    const service = createToolCatalogService({
      repository,
      entries: [makeEntry('alpha', { category: 'image' })],
    });

    const item = await service.getItem('alpha');

    expect(item).toMatchObject({
      id: 'alpha',
      category: 'image',
      availability: 'preview',
      order: 3,
      source: 'override',
      name: { 'zh-CN': '运营名', en: 'alpha name' },
    });
  });

  it('listByCategory 在 listItems 结果上过滤并保持排序', async () => {
    const repository = new InMemoryCatalogRepository({
      overrides: [override('gamma', { displayOrder: 1 })],
    });
    const service = createToolCatalogService({
      repository,
      entries: [
        makeEntry('alpha', { category: 'image', order: 10 }),
        makeEntry('beta', { category: 'text', order: 20 }),
        makeEntry('gamma', { category: 'text', order: 30 }),
      ],
    });

    const textItems = await service.listByCategory('text');

    expect(textItems.map((item) => item.id)).toEqual(['gamma', 'beta']);
  });
});

describe('createRegistryOnlyCatalog', () => {
  it('只读注册表、排除停用条目，且不依赖仓储', async () => {
    const service = createRegistryOnlyCatalog([
      makeEntry('alpha'),
      makeEntry('hidden', { availability: 'disabled' }),
      makeEntry('beta', { category: 'image' }),
    ]);

    const items = await service.listItems();

    expect(items.map((item) => item.id)).toEqual(['alpha', 'beta']);
    expect(items.every((item) => item.source === 'registry')).toBe(true);
    await expect(service.getItem('hidden')).resolves.toBeUndefined();
    await expect(service.listByCategory('image')).resolves.toHaveLength(1);
  });

  it('缺省使用注册表，空条目返回空目录', async () => {
    const defaultService = createRegistryOnlyCatalog();
    const emptyService = createRegistryOnlyCatalog([]);

    const defaultItems = await defaultService.listItems();
    const emptyItems = await emptyService.listItems();

    expect(defaultItems).toHaveLength(6);
    expect(defaultItems.some((item) => item.id === 'csv-inspector')).toBe(
      false,
    );
    expect(emptyItems).toEqual([]);
  });
});
