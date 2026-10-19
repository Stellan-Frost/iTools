import { describe, expect, it } from 'vitest';

import type { RegistryEntry, ToolCategory } from '@itools/contracts';

import { InMemoryCatalogRepository } from '../test-support/in-memory-catalog-repository.js';
import { seedCatalog } from './seed-catalog.js';

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

describe('seedCatalog', () => {
  it('为全部注册表条目建档（含 preview 与 disabled），顺序与注册表一致', async () => {
    const writer = new InMemoryCatalogRepository();

    const report = await seedCatalog({
      writer,
      entries: [
        makeEntry('alpha', { order: 10 }),
        makeEntry('beta', { order: 20 }),
        makeEntry('hidden', { order: 30, availability: 'disabled' }),
      ],
    });

    expect(report.createdToolIds).toEqual(['alpha', 'beta', 'hidden']);
    expect(report.existingToolIds).toEqual([]);
    expect(writer.snapshot().tools.map((row) => row.toolId)).toEqual([
      'alpha',
      'beta',
      'hidden',
    ]);
  });

  it('两个 locale 都写入，键格式为 `toolId:locale` 且顺序稳定', async () => {
    const writer = new InMemoryCatalogRepository();

    const report = await seedCatalog({
      writer,
      entries: [makeEntry('alpha'), makeEntry('beta')],
    });

    expect(report.createdLocalizationKeys).toEqual([
      'alpha:zh-CN',
      'alpha:en',
      'beta:zh-CN',
      'beta:en',
    ]);
  });

  it('写入的 displayOrder 与三列文案取自注册表默认值', async () => {
    const writer = new InMemoryCatalogRepository();
    const entry = makeEntry('alpha', { order: 42 });

    await seedCatalog({ writer, entries: [entry] });

    const snapshot = writer.snapshot();
    expect(snapshot.tools).toEqual([{ toolId: 'alpha', displayOrder: 42 }]);

    const zhRow = snapshot.localizations.find(
      (row) => row.toolId === 'alpha' && row.locale === 'zh-CN',
    );
    const enRow = snapshot.localizations.find(
      (row) => row.toolId === 'alpha' && row.locale === 'en',
    );

    expect(zhRow).toEqual({
      toolId: 'alpha',
      locale: 'zh-CN',
      name: 'alpha 名称',
      summary: 'alpha 摘要',
      description: 'alpha 描述',
    });
    expect(enRow).toEqual({
      toolId: 'alpha',
      locale: 'en',
      name: 'alpha name',
      summary: 'alpha summary',
      description: 'alpha description',
    });
  });

  it('连续两次 seed 幂等：第二次没有新建，工具全部记为已存在', async () => {
    const writer = new InMemoryCatalogRepository();
    const entries = [makeEntry('alpha'), makeEntry('beta')];

    await seedCatalog({ writer, entries });
    const firstSnapshot = writer.snapshot();
    const second = await seedCatalog({ writer, entries });

    expect(second.createdToolIds).toEqual([]);
    expect(second.createdLocalizationKeys).toEqual([]);
    expect(second.existingToolIds).toEqual(['alpha', 'beta']);
    expect(writer.snapshot()).toEqual(firstSnapshot);
  });

  it('已存在的运营文案不被覆盖，只补写缺失的 locale', async () => {
    const writer = new InMemoryCatalogRepository();
    await writer.upsertOverride({
      toolId: 'alpha',
      displayOrder: null,
      availabilityOverride: null,
      localizations: [
        {
          locale: 'zh-CN',
          name: '运营名',
          summary: '运营摘要',
          description: '运营描述',
        },
      ],
    });

    const report = await seedCatalog({ writer, entries: [makeEntry('alpha')] });

    expect(report.createdLocalizationKeys).toEqual(['alpha:en']);
    const snapshot = writer.snapshot();
    const zhRow = snapshot.localizations.find(
      (row) => row.toolId === 'alpha' && row.locale === 'zh-CN',
    );
    const enRow = snapshot.localizations.find(
      (row) => row.toolId === 'alpha' && row.locale === 'en',
    );

    expect(zhRow).toMatchObject({
      name: '运营名',
      summary: '运营摘要',
      description: '运营描述',
    });
    expect(enRow).toMatchObject({ name: 'alpha name' });
  });

  it('已存在的工具行不被覆盖：人工调整过的 displayOrder 保留', async () => {
    const writer = new InMemoryCatalogRepository();
    await writer.upsertOverride({
      toolId: 'alpha',
      displayOrder: 999,
      availabilityOverride: null,
      localizations: [],
    });

    const report = await seedCatalog({
      writer,
      entries: [makeEntry('alpha', { order: 10 })],
    });

    expect(report.createdToolIds).toEqual([]);
    expect(report.existingToolIds).toEqual(['alpha']);
    expect(writer.snapshot().tools).toEqual([
      { toolId: 'alpha', displayOrder: 999 },
    ]);
  });

  it('部分已存在时分别归入 created 与 existing', async () => {
    const writer = new InMemoryCatalogRepository();
    await seedCatalog({ writer, entries: [makeEntry('alpha')] });

    const report = await seedCatalog({
      writer,
      entries: [makeEntry('alpha'), makeEntry('beta')],
    });

    expect(report.createdToolIds).toEqual(['beta']);
    expect(report.existingToolIds).toEqual(['alpha']);
    expect(report.createdLocalizationKeys).toEqual(['beta:zh-CN', 'beta:en']);
  });

  it('缺省使用完整注册表（含停用条目）', async () => {
    const writer = new InMemoryCatalogRepository();

    const report = await seedCatalog({ writer });

    expect(report.createdToolIds).toHaveLength(7);
    expect(report.createdToolIds).toContain('csv-inspector');
    expect(report.createdLocalizationKeys).toHaveLength(14);
    expect(report.createdLocalizationKeys).toContain('csv-inspector:zh-CN');
    expect(writer.snapshot().tools).toContainEqual({
      toolId: 'image-inspector',
      displayOrder: 10,
    });
  });

  it('空条目集合返回空报告且不写入任何行', async () => {
    const writer = new InMemoryCatalogRepository();

    const report = await seedCatalog({ writer, entries: [] });

    expect(report).toEqual({
      createdToolIds: [],
      createdLocalizationKeys: [],
      existingToolIds: [],
    });
    expect(writer.snapshot()).toEqual({ tools: [], localizations: [] });
  });
});
