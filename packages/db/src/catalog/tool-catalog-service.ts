import { toolRegistry } from '@itools/app-core';
import type {
  CatalogOverride,
  CatalogRepository,
  LocalizationOverride,
  LocalizedText,
  Locale,
  RegistryEntry,
  ToolCatalogItem,
  ToolCatalogService,
  ToolCategory,
} from '@itools/contracts';

export interface CreateToolCatalogServiceOptions {
  readonly repository: CatalogRepository;
  /** 缺省使用 @itools/app-core 的 toolRegistry */
  readonly entries?: readonly RegistryEntry[];
}

type TextField = 'name' | 'summary' | 'description';

interface MergedText {
  readonly text: LocalizedText;
  /** 至少一个 locale 的该字段真的来自数据库覆盖。 */
  readonly overridden: boolean;
}

function indexLocalizations(
  localizations: readonly LocalizationOverride[],
): ReadonlyMap<Locale, LocalizationOverride> {
  return new Map(localizations.map((item) => [item.locale, item] as const));
}

/**
 * 空字符串与 undefined 一律视为「未覆盖」，回落注册表默认文案；
 * 只有非空字符串才算运营覆盖。
 */
function pickOverride(
  index: ReadonlyMap<Locale, LocalizationOverride>,
  locale: Locale,
  field: TextField,
): string | undefined {
  const value = index.get(locale)?.[field];
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return value;
}

/** 逐 locale、逐字段合并；不得整条替换某个 locale 的对象。 */
function mergeText(
  base: LocalizedText,
  index: ReadonlyMap<Locale, LocalizationOverride>,
  field: TextField,
): MergedText {
  const zhCN = pickOverride(index, 'zh-CN', field);
  const en = pickOverride(index, 'en', field);
  const resolvedZh = zhCN ?? base['zh-CN'];
  const resolvedEn = en ?? base.en;

  return {
    text: {
      'zh-CN': resolvedZh,
      en: resolvedEn,
    },
    // 与注册表默认值相同的写入（Seed 预填）不算覆盖。
    overridden: resolvedZh !== base['zh-CN'] || resolvedEn !== base.en,
  };
}

function mergeItem(
  entry: RegistryEntry,
  override: CatalogOverride | undefined,
): ToolCatalogItem {
  const localizations = indexLocalizations(override?.localizations ?? []);
  const name = mergeText(entry.metadata.name, localizations, 'name');
  const summary = mergeText(entry.metadata.summary, localizations, 'summary');
  const description = mergeText(
    entry.metadata.description,
    localizations,
    'description',
  );

  // 只有“与注册表不同”才算覆盖：Seed 会把注册表默认值写进库，
  // 那种情况不应让 source 变成 override，否则来源标记失去意义。
  const orderOverridden =
    override?.displayOrder !== undefined &&
    override.displayOrder !== entry.metadata.order;
  const availabilityOverridden = override?.availabilityOverride === 'disabled';
  const textOverridden =
    name.overridden || summary.overridden || description.overridden;

  return {
    id: entry.metadata.id,
    // 分类只能来自注册表：数据库没有、也不允许有分类字段。
    category: entry.metadata.category,
    availability: availabilityOverridden ? 'disabled' : entry.availability,
    name: name.text,
    summary: summary.text,
    description: description.text,
    order: override?.displayOrder ?? entry.metadata.order,
    source:
      orderOverridden || availabilityOverridden || textOverridden
        ? 'override'
        : 'registry',
  };
}

/** 字典序比较（不依赖运行环境 locale），保证不同机器排序稳定。 */
function compareItems(left: ToolCatalogItem, right: ToolCatalogItem): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}

function finalize(
  items: readonly ToolCatalogItem[],
): readonly ToolCatalogItem[] {
  return items
    .filter((item) => item.availability !== 'disabled')
    .sort(compareItems);
}

function visibleItem(
  entry: RegistryEntry,
  override: CatalogOverride | undefined,
): ToolCatalogItem | undefined {
  const item = mergeItem(entry, override);
  return item.availability === 'disabled' ? undefined : item;
}

function indexEntries(
  entries: readonly RegistryEntry[],
): ReadonlyMap<string, RegistryEntry> {
  return new Map(entries.map((entry) => [entry.metadata.id, entry] as const));
}

export function createToolCatalogService(
  options: CreateToolCatalogServiceOptions,
): ToolCatalogService {
  const entries = options.entries ?? toolRegistry.entries;
  const entriesById = indexEntries(entries);

  const listItems = async (): Promise<readonly ToolCatalogItem[]> => {
    // 只查一次：整表覆盖一次性取回，避免按工具逐个查询造成 N+1。
    const overrides = await options.repository.listOverrides();
    const overridesByToolId = new Map(
      overrides.map((override) => [override.toolId, override] as const),
    );

    return finalize(
      entries.map((entry) =>
        mergeItem(entry, overridesByToolId.get(entry.metadata.id)),
      ),
    );
  };

  return {
    listItems,
    async getItem(toolId: string): Promise<ToolCatalogItem | undefined> {
      const entry = entriesById.get(toolId);
      if (entry === undefined) {
        return undefined;
      }

      return visibleItem(entry, await options.repository.getOverride(toolId));
    },
    async listByCategory(
      category: ToolCategory,
    ): Promise<readonly ToolCatalogItem[]> {
      const items = await listItems();
      return items.filter((item) => item.category === category);
    },
  };
}

/** 数据库不可用时的降级目录：只用注册表，绝不抛错。 */
export function createRegistryOnlyCatalog(
  entries: readonly RegistryEntry[] = toolRegistry.entries,
): ToolCatalogService {
  const entriesById = indexEntries(entries);

  const listItems = async (): Promise<readonly ToolCatalogItem[]> =>
    finalize(entries.map((entry) => mergeItem(entry, undefined)));

  return {
    listItems,
    async getItem(toolId: string): Promise<ToolCatalogItem | undefined> {
      const entry = entriesById.get(toolId);
      if (entry === undefined) {
        return undefined;
      }

      return visibleItem(entry, undefined);
    },
    async listByCategory(
      category: ToolCategory,
    ): Promise<readonly ToolCatalogItem[]> {
      const items = await listItems();
      return items.filter((item) => item.category === category);
    },
  };
}
