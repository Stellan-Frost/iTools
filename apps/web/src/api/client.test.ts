import type { ToolCatalogItem } from '@itools/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError, createToolApiClient } from './client.js';

function catalogItem(
  overrides: Partial<ToolCatalogItem> = {},
): ToolCatalogItem {
  return {
    id: 'image-resize',
    category: 'image',
    availability: 'implemented',
    name: { 'zh-CN': '图片缩放', en: 'Image Resize' },
    summary: { 'zh-CN': '调整图片尺寸', en: 'Resize images' },
    description: { 'zh-CN': '按像素缩放图片', en: 'Scale images by pixels' },
    order: 1,
    source: 'registry',
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createClient(fetchImpl: typeof fetch, baseUrl = '') {
  return createToolApiClient({ baseUrl, fetchImpl });
}

async function captureError(
  run: () => Promise<unknown>,
): Promise<ApiClientError> {
  try {
    await run();
  } catch (cause) {
    if (cause instanceof ApiClientError) {
      return cause;
    }
    throw cause;
  }
  throw new Error('expected the request to fail');
}

describe('createToolApiClient', () => {
  it('listTools 解析成功信封并归一化 baseUrl', async () => {
    const item = catalogItem();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: [item], meta: { total: 1 } }));

    const client = createClient(fetchImpl, 'https://api.example.com/');

    await expect(client.listTools()).resolves.toEqual([item]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/tools',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });

  it('getTool 对含空格与中文的 id 做 URL 编码', async () => {
    const item = catalogItem({ id: 'audio-trim' });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: item }));

    const client = createClient(fetchImpl);

    await expect(client.getTool('音 频 工具')).resolves.toEqual(item);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      '/api/v1/tools/%E9%9F%B3%20%E9%A2%91%20%E5%B7%A5%E5%85%B7',
    );
  });

  it('404 错误信封映射为 ApiClientError 并透传 requestId', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          code: 'TOOL_NOT_FOUND',
          message: '工具不存在',
          requestId: 'req-404',
        },
        404,
      ),
    );

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.getTool('missing-tool'));

    expect(error).toMatchObject({
      code: 'TOOL_NOT_FOUND',
      status: 404,
      requestId: 'req-404',
    });
  });

  it('非 JSON 响应体映射为 INVALID_RESPONSE', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('<html>gateway error</html>', { status: 502 }),
      );

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.listTools());

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('网络异常映射为 NETWORK_ERROR 且 status 为 0', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.listTools());

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
    expect(error.requestId).toBeUndefined();
  });

  it('healthReady 在 503 时返回 degraded 报告而不抛错', async () => {
    const health = {
      status: 'degraded',
      checks: { database: 'unavailable' },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: health }, 503));

    const client = createClient(fetchImpl);

    await expect(client.healthReady()).resolves.toEqual(health);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/v1/health/ready');
  });

  it('data 字段类型不合法时映射为 INVALID_RESPONSE', async () => {
    const invalidItem: Record<string, unknown> = {
      ...catalogItem(),
      order: 'first',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: [invalidItem] }));

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.listTools());

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });
});
