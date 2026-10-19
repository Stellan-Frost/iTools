/**
 * `CatalogRepository` 的测试替身：记录每次 `upsertOverride` 的入参，
 * 便于断言「未提交的字段没有被写入」「清除覆盖后回落到注册表」等语义。
 */
import type {
  CatalogOverride,
  CatalogOverrideInput,
  CatalogRepository,
  LocalizationOverride,
} from '@itools/contracts';

function copyLocalization(source: LocalizationOverride): LocalizationOverride {
  return {
    locale: source.locale,
    ...(source.name === undefined ? {} : { name: source.name }),
    ...(source.summary === undefined ? {} : { summary: source.summary }),
    ...(source.description === undefined
      ? {}
      : { description: source.description }),
  };
}

function copyOverride(source: CatalogOverride): CatalogOverride {
  return {
    toolId: source.toolId,
    ...(source.displayOrder === undefined
      ? {}
      : { displayOrder: source.displayOrder }),
    ...(source.availabilityOverride === undefined
      ? {}
      : { availabilityOverride: source.availabilityOverride }),
    localizations: source.localizations.map(copyLocalization),
  };
}

function copyInput(source: CatalogOverrideInput): CatalogOverrideInput {
  return {
    toolId: source.toolId,
    displayOrder: source.displayOrder,
    availabilityOverride: source.availabilityOverride,
    localizations: source.localizations.map(copyLocalization),
  };
}

export class FakeCatalogRepository implements CatalogRepository {
  private readonly overrides = new Map<string, CatalogOverride>();
  /** 按调用顺序保存的入参快照；测试取最后一条断言。 */
  readonly upsertCalls: CatalogOverrideInput[] = [];

  constructor(seed: readonly CatalogOverride[] = []) {
    for (const override of seed) {
      this.overrides.set(override.toolId, copyOverride(override));
    }
  }

  lastUpsert(): CatalogOverrideInput {
    const call = this.upsertCalls[this.upsertCalls.length - 1];
    if (call === undefined) {
      throw new Error('upsertOverride 尚未被调用');
    }
    return call;
  }

  async listOverrides(): Promise<readonly CatalogOverride[]> {
    return [...this.overrides.values()].map(copyOverride);
  }

  async getOverride(toolId: string): Promise<CatalogOverride | undefined> {
    const override = this.overrides.get(toolId);
    return override === undefined ? undefined : copyOverride(override);
  }

  async listLocalizations(
    toolId: string,
  ): Promise<readonly LocalizationOverride[]> {
    const override = this.overrides.get(toolId);
    return override === undefined
      ? []
      : override.localizations.map(copyLocalization);
  }

  async upsertOverride(input: CatalogOverrideInput): Promise<void> {
    this.upsertCalls.push(copyInput(input));
    this.overrides.set(input.toolId, {
      toolId: input.toolId,
      ...(input.displayOrder === null
        ? {}
        : { displayOrder: input.displayOrder }),
      ...(input.availabilityOverride === null
        ? {}
        : { availabilityOverride: input.availabilityOverride }),
      localizations: input.localizations.map(copyLocalization),
    });
  }
}
