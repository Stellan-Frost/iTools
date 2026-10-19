/**
 * 注册表只读视图：供服务端做「工具是否存在」与「默认文案」判断。
 * 只读、不含覆盖，因此在工具被下架时依然能拿到原值（写接口需要）。
 */
import { toolRegistry } from '@itools/app-core';
import type { ToolCatalogItem, ToolCategory } from '@itools/contracts';

export function findRegistryItem(toolId: string): ToolCatalogItem | undefined {
  const entry = toolRegistry.findTool(toolId);
  if (entry === undefined) return undefined;
  const { metadata } = entry;
  return {
    id: metadata.id,
    category: metadata.category as ToolCategory,
    availability: entry.availability,
    name: metadata.name,
    summary: metadata.summary,
    description: metadata.description,
    order: metadata.order,
    source: 'registry',
  };
}

export function listRegistryToolIds(): readonly string[] {
  return toolRegistry.listTools().map((entry) => entry.metadata.id);
}
