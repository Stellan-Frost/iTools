import type {
  Locale,
  ImplementedRegistryEntry,
  RegistryEntry,
} from '@itools/contracts';
import { isImplementedEntry } from '@itools/contracts';

import { CATEGORIES, getCategory } from '../catalog/index.js';
import type { CategoryId } from '../catalog/index.js';
import { PREVIEW_TOOL_ENTRIES } from './preview-tools.js';

export interface ToolRegistry {
  readonly entries: readonly RegistryEntry[];
  listTools(): readonly RegistryEntry[];
  listVisibleTools(): readonly RegistryEntry[];
  listImplementedTools(): readonly ImplementedRegistryEntry[];
  findTool(toolId: string): RegistryEntry | undefined;
  findVisibleTool(toolId: string): RegistryEntry | undefined;
  listVisibleByCategory(categoryId: CategoryId): readonly RegistryEntry[];
  searchVisible(query: string, locale: Locale): readonly RegistryEntry[];
  listSitemapPaths(locale: Locale): readonly string[];
}

function compareEntries(left: RegistryEntry, right: RegistryEntry): number {
  const byOrder = left.metadata.order - right.metadata.order;
  if (byOrder !== 0) {
    return byOrder;
  }

  return left.metadata.id.localeCompare(right.metadata.id);
}

function sortEntries(
  entries: readonly RegistryEntry[],
): readonly RegistryEntry[] {
  return Object.freeze([...entries].sort(compareEntries));
}

/**
 * 创建注册表：默认预览条目 + 注入的已实现工具，统一按 order、id 排序。
 * 已实现工具由未来的 `packages/tool-*` 通过此入口注入，不进入默认注册表。
 */
export function createToolRegistry(
  implemented: readonly ImplementedRegistryEntry[],
): ToolRegistry {
  const entries = sortEntries([...PREVIEW_TOOL_ENTRIES, ...implemented]);
  const visibleEntries = Object.freeze(
    entries.filter((entry) => entry.availability !== 'disabled'),
  );
  const implementedEntries = Object.freeze(entries.filter(isImplementedEntry));

  const byId = new Map<string, RegistryEntry>(
    entries.map((entry): [string, RegistryEntry] => [entry.metadata.id, entry]),
  );

  const visibleById = new Map<string, RegistryEntry>(
    visibleEntries.map((entry): [string, RegistryEntry] => [
      entry.metadata.id,
      entry,
    ]),
  );

  return {
    entries,
    listTools(): readonly RegistryEntry[] {
      return entries;
    },
    listVisibleTools(): readonly RegistryEntry[] {
      return visibleEntries;
    },
    listImplementedTools(): readonly ImplementedRegistryEntry[] {
      return implementedEntries;
    },
    findTool(toolId: string): RegistryEntry | undefined {
      return byId.get(toolId);
    },
    findVisibleTool(toolId: string): RegistryEntry | undefined {
      return visibleById.get(toolId);
    },
    listVisibleByCategory(categoryId: CategoryId): readonly RegistryEntry[] {
      return Object.freeze(
        visibleEntries.filter(
          (entry) => entry.metadata.category === categoryId,
        ),
      );
    },
    searchVisible(query: string, locale: Locale): readonly RegistryEntry[] {
      const needle = query.trim().toLowerCase();
      if (needle.length === 0) {
        return visibleEntries;
      }

      const matches = visibleEntries.filter((entry) => {
        const category = getCategory(entry.metadata.category);
        const candidates = [
          entry.metadata.name[locale],
          entry.metadata.summary[locale],
          category?.name[locale] ?? '',
        ];
        return candidates.some((text) => text.toLowerCase().includes(needle));
      });
      return Object.freeze(matches);
    },
    listSitemapPaths(locale: Locale): readonly string[] {
      const paths: string[] = [`/${locale}`];

      for (const category of CATEGORIES) {
        paths.push(`/${locale}/${category.id}`);
        for (const tool of implementedEntries) {
          if (tool.metadata.category === category.id) {
            paths.push(`/${locale}/${category.id}/${tool.metadata.id}`);
          }
        }
      }

      return Object.freeze(paths);
    },
  };
}

/** 默认注册表：6 个预览条目 + 1 个停用条目，无已实现工具。 */
export const toolRegistry: ToolRegistry = createToolRegistry([]);

export function listTools(): readonly RegistryEntry[] {
  return toolRegistry.listTools();
}

export function listVisibleTools(): readonly RegistryEntry[] {
  return toolRegistry.listVisibleTools();
}

export function listImplementedTools(): readonly ImplementedRegistryEntry[] {
  return toolRegistry.listImplementedTools();
}

export function findTool(toolId: string): RegistryEntry | undefined {
  return toolRegistry.findTool(toolId);
}

export function findVisibleTool(toolId: string): RegistryEntry | undefined {
  return toolRegistry.findVisibleTool(toolId);
}

export function listVisibleByCategory(
  categoryId: CategoryId,
): readonly RegistryEntry[] {
  return toolRegistry.listVisibleByCategory(categoryId);
}

export function searchVisibleTools(
  query: string,
  locale: Locale,
): readonly RegistryEntry[] {
  return toolRegistry.searchVisible(query, locale);
}

export function listSitemapPaths(locale: Locale): readonly string[] {
  return toolRegistry.listSitemapPaths(locale);
}
