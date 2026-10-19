import type {
  CatalogOverride,
  CatalogOverrideInput,
  CatalogRepository,
  CatalogSeedWriter,
  LocalizationOverride,
  Locale,
} from '@itools/contracts';

interface ToolRecord {
  displayOrder?: number;
  availabilityOverride?: 'disabled';
}

export interface InMemoryToolRow {
  readonly toolId: string;
  readonly displayOrder?: number;
  readonly availabilityOverride?: 'disabled';
}

export interface InMemoryLocalizationRow {
  readonly toolId: string;
  readonly locale: Locale;
  readonly name?: string;
  readonly summary?: string;
  readonly description?: string;
}

export interface InMemoryCatalogSnapshot {
  /** 按 toolId 升序，便于稳定断言。 */
  readonly tools: readonly InMemoryToolRow[];
  /** 按 `toolId:locale` 升序。 */
  readonly localizations: readonly InMemoryLocalizationRow[];
}

export interface InMemoryCatalogRepositoryOptions {
  /** 预置覆盖，等价于构造时执行一次 `upsertOverride`。 */
  readonly overrides?: readonly CatalogOverride[];
}

function copyLocalization(
  localization: LocalizationOverride,
): LocalizationOverride {
  return {
    locale: localization.locale,
    ...(localization.name === undefined ? {} : { name: localization.name }),
    ...(localization.summary === undefined
      ? {}
      : { summary: localization.summary }),
    ...(localization.description === undefined
      ? {}
      : { description: localization.description }),
  };
}

function copyLocalizationRow(
  row: InMemoryLocalizationRow,
): InMemoryLocalizationRow {
  return {
    toolId: row.toolId,
    locale: row.locale,
    ...(row.name === undefined ? {} : { name: row.name }),
    ...(row.summary === undefined ? {} : { summary: row.summary }),
    ...(row.description === undefined ? {} : { description: row.description }),
  };
}

function compareKeys(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

/**
 * 测试替身：同时实现读路径（`CatalogRepository`）与 seed 写入路径
 * （`CatalogSeedWriter`），全部保存在内存中，不连接任何数据库。
 */
export class InMemoryCatalogRepository
  implements CatalogRepository, CatalogSeedWriter
{
  private readonly tools = new Map<string, ToolRecord>();

  private readonly localizations = new Map<
    string,
    Map<Locale, LocalizationOverride>
  >();

  constructor(options: InMemoryCatalogRepositoryOptions = {}) {
    for (const override of options.overrides ?? []) {
      this.setToolRecord(override.toolId, {
        ...(override.displayOrder === undefined
          ? {}
          : { displayOrder: override.displayOrder }),
        ...(override.availabilityOverride === undefined
          ? {}
          : { availabilityOverride: override.availabilityOverride }),
      });
      this.setLocalizations(override.toolId, override.localizations);
    }
  }

  private setToolRecord(toolId: string, record: ToolRecord): void {
    this.tools.set(toolId, record);
  }

  private setLocalizations(
    toolId: string,
    localizations: readonly LocalizationOverride[],
  ): void {
    const byLocale = new Map<Locale, LocalizationOverride>();
    for (const localization of localizations) {
      byLocale.set(localization.locale, copyLocalization(localization));
    }

    this.localizations.set(toolId, byLocale);
  }

  private buildOverride(toolId: string): CatalogOverride {
    const record = this.tools.get(toolId) ?? {};
    const byLocale = this.localizations.get(toolId);
    const localizations = [...(byLocale?.values() ?? [])]
      .map(copyLocalization)
      .sort((left, right) => compareKeys(left.locale, right.locale));

    return {
      toolId,
      ...(record.displayOrder === undefined
        ? {}
        : { displayOrder: record.displayOrder }),
      ...(record.availabilityOverride === undefined
        ? {}
        : { availabilityOverride: record.availabilityOverride }),
      localizations,
    };
  }

  async listOverrides(): Promise<readonly CatalogOverride[]> {
    return [...this.tools.keys()]
      .sort(compareKeys)
      .map((toolId) => this.buildOverride(toolId));
  }

  async getOverride(toolId: string): Promise<CatalogOverride | undefined> {
    if (!this.tools.has(toolId) && !this.localizations.has(toolId)) {
      return undefined;
    }

    return this.buildOverride(toolId);
  }

  async listLocalizations(
    toolId: string,
  ): Promise<readonly LocalizationOverride[]> {
    return this.buildOverride(toolId).localizations;
  }

  async upsertOverride(input: CatalogOverrideInput): Promise<void> {
    const record: ToolRecord = {};
    if (input.displayOrder !== null) {
      record.displayOrder = input.displayOrder;
    }

    if (input.availabilityOverride !== null) {
      record.availabilityOverride = input.availabilityOverride;
    }

    this.setToolRecord(input.toolId, record);
    this.setLocalizations(input.toolId, input.localizations);
  }

  async ensureTool(input: {
    readonly toolId: string;
    readonly displayOrder: number;
  }): Promise<boolean> {
    if (this.tools.has(input.toolId)) {
      return false;
    }

    this.setToolRecord(input.toolId, { displayOrder: input.displayOrder });
    return true;
  }

  async ensureLocalization(input: {
    readonly toolId: string;
    readonly locale: Locale;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
  }): Promise<boolean> {
    let byLocale = this.localizations.get(input.toolId);
    if (byLocale === undefined) {
      byLocale = new Map<Locale, LocalizationOverride>();
      this.localizations.set(input.toolId, byLocale);
    }

    if (byLocale.has(input.locale)) {
      return false;
    }

    byLocale.set(input.locale, {
      locale: input.locale,
      name: input.name,
      summary: input.summary,
      description: input.description,
    });
    return true;
  }

  /** 导出当前写入内容，便于测试断言且不泄露内部 Map。 */
  snapshot(): InMemoryCatalogSnapshot {
    const tools: InMemoryToolRow[] = [...this.tools.entries()]
      .sort(([left], [right]) => compareKeys(left, right))
      .map(([toolId, record]) => ({
        toolId,
        ...(record.displayOrder === undefined
          ? {}
          : { displayOrder: record.displayOrder }),
        ...(record.availabilityOverride === undefined
          ? {}
          : { availabilityOverride: record.availabilityOverride }),
      }));

    const localizations: InMemoryLocalizationRow[] = [];
    for (const [toolId, byLocale] of this.localizations) {
      for (const localization of byLocale.values()) {
        localizations.push(copyLocalizationRow({ toolId, ...localization }));
      }
    }

    localizations.sort((left, right) =>
      compareKeys(
        `${left.toolId}:${left.locale}`,
        `${right.toolId}:${right.locale}`,
      ),
    );

    return { tools, localizations };
  }
}
