/**
 * 公开只读 API 的固定速率限制：每 IP 每分钟 120 次。
 * 超过阈值返回 429 + retry-after，健康检查同样受限。
 */
import type { SsrRenderer, ToolCatalogItem } from '@itools/contracts';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

const renderer: SsrRenderer = {
  supportedLocales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN',
  render: async () => ({
    statusCode: 200,
    lang: 'zh-CN',
    headHtml: '<title>test</title>',
    appHtml: '<div id="root"></div>',
  }),
  listSitemapUrls: async () => [],
};

const item: ToolCatalogItem = {
  id: 'json-viewer',
  category: 'text',
  availability: 'preview',
  name: { 'zh-CN': 'JSON 查看器', en: 'JSON viewer' },
  summary: { 'zh-CN': '查看 JSON', en: 'View JSON' },
  description: { 'zh-CN': '查看 JSON 结构', en: 'Inspect JSON' },
  order: 10,
  source: 'registry',
};

async function createTestApp() {
  return createApp({
    renderer,
    siteOrigin: 'http://localhost:5173',
    getTemplate: async () =>
      '<html lang="zh-CN"><head><!--app-head--></head><body><!--app-html--></body></html>',
    api: {
      catalog: {
        listItems: async () => [item],
        getItem: async (toolId) => (toolId === item.id ? item : undefined),
        listByCategory: async () => [item],
      },
    },
  });
}

describe('公开 API 速率限制', () => {
  it('前 120 次放行，第 121 次返回 429', async () => {
    const app = await createTestApp();

    for (let index = 0; index < 120; index += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json<{ code: string }>().code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['cache-control']).toBe('no-store');
    await app.close();
  }, 30_000);
});
