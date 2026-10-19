import type { ToolCatalogItem } from '@itools/contracts';
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { ToolApiClient } from './client.js';
import { toolCatalogQueryKey, toolCatalogQueryOptions } from './queries.js';

const item: ToolCatalogItem = {
  id: 'image-resize',
  category: 'image',
  availability: 'implemented',
  name: { 'zh-CN': '图片缩放', en: 'Image Resize' },
  summary: { 'zh-CN': '调整图片尺寸', en: 'Resize images' },
  description: { 'zh-CN': '按像素缩放图片', en: 'Scale images by pixels' },
  order: 1,
  source: 'registry',
};

function createClientStub(): {
  readonly client: ToolApiClient;
  readonly listTools: Mock<ToolApiClient['listTools']>;
} {
  const listTools = vi
    .fn<ToolApiClient['listTools']>()
    .mockResolvedValue([item]);
  return {
    client: {
      listTools,
      getTool: vi.fn<ToolApiClient['getTool']>(),
      healthReady: vi.fn<ToolApiClient['healthReady']>(),
    },
    listTools,
  };
}

describe('toolCatalogQueryOptions', () => {
  it('使用稳定的查询键与 60 秒 staleTime', () => {
    const { client } = createClientStub();
    const options = toolCatalogQueryOptions(client);

    expect(toolCatalogQueryKey).toEqual(['tools']);
    expect(options.queryKey).toEqual(['tools']);
    expect(options.queryKey).toBe(toolCatalogQueryKey);
    expect(options.staleTime).toBe(60_000);
  });

  it('queryFn 委托给 client.listTools', async () => {
    const { client, listTools } = createClientStub();
    const options = toolCatalogQueryOptions(client);

    await expect(options.queryFn()).resolves.toEqual([item]);
    expect(listTools).toHaveBeenCalledTimes(1);
  });
});
