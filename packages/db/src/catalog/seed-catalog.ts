import { toolRegistry } from '@itools/app-core';
import type {
  CatalogSeedWriter,
  Locale,
  RegistryEntry,
  SeedReport,
} from '@itools/contracts';
import { LOCALES } from '@itools/contracts';

export interface SeedCatalogOptions {
  readonly writer: CatalogSeedWriter;
  /** 缺省使用 @itools/app-core 的 toolRegistry */
  readonly entries?: readonly RegistryEntry[];
}

function localizationKey(toolId: string, locale: Locale): string {
  return `${toolId}:${locale}`;
}

/**
 * 把注册表投影到数据库：只为缺失的行做初始化写入。
 * 已存在的工具行与文案一律不覆盖——运营改过的数据必须保留。
 */
export async function seedCatalog(
  options: SeedCatalogOptions,
): Promise<SeedReport> {
  const entries = options.entries ?? toolRegistry.entries;
  const createdToolIds: string[] = [];
  const existingToolIds: string[] = [];
  const createdLocalizationKeys: string[] = [];

  for (const entry of entries) {
    const { metadata } = entry;
    const toolCreated = await options.writer.ensureTool({
      toolId: metadata.id,
      displayOrder: metadata.order,
    });

    if (toolCreated) {
      createdToolIds.push(metadata.id);
    } else {
      existingToolIds.push(metadata.id);
    }

    // 含 preview / disabled 条目：目录降级与恢复都依赖完整快照。
    for (const locale of LOCALES) {
      const localizedCreated = await options.writer.ensureLocalization({
        toolId: metadata.id,
        locale,
        name: metadata.name[locale],
        summary: metadata.summary[locale],
        description: metadata.description[locale],
      });

      if (localizedCreated) {
        createdLocalizationKeys.push(localizationKey(metadata.id, locale));
      }
    }
  }

  return {
    createdToolIds,
    createdLocalizationKeys,
    existingToolIds,
  };
}
