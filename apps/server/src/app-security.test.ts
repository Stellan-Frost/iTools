/**
 * 应用级安全验收：所有响应（HTML / API / 404）都必须带安全头。
 * 这里用真实的 createApp，避免只测中间件而漏掉接线。
 */
import type { SsrRenderer } from '@itools/contracts';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

const renderer: SsrRenderer = {
  supportedLocales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN',
  // 未知路径返回 404，用于验证真实状态码下的响应头。
  render: async ({ url }) => ({
    statusCode: url.includes('/nope') ? 404 : 200,
    lang: 'zh-CN',
    headHtml: '<title>test</title>',
    appHtml: '<div id="root"></div>',
  }),
  listSitemapUrls: async () => [],
};

const template =
  '<html lang="zh-CN"><head><!--app-head--></head><body><!--app-html--></body></html>';

async function createTestApp(isProduction: boolean) {
  return createApp({
    renderer,
    siteOrigin: isProduction ? 'https://itools.test' : 'http://localhost:5173',
    getTemplate: async () => template,
    isProduction,
  });
}

describe('安全响应头接线', () => {
  it('首页 302 带安全头', async () => {
    const app = await createTestApp(true);
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(302);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    await app.close();
  });

  it('未知路径 404 带安全头且不发 HSTS（http 站点）', async () => {
    const app = await createTestApp(false);
    const response = await app.inject({ method: 'GET', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-security-policy']).toBeTruthy();
    expect(response.headers['strict-transport-security']).toBeUndefined();
    await app.close();
  });

  it('API 503 也带安全头，HTTPS 站点带 HSTS', async () => {
    const app = await createTestApp(true);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tools',
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-security-policy']).toBeTruthy();
    expect(response.headers['strict-transport-security']).toContain(
      'max-age=31536000',
    );
    await app.close();
  });

  it('生产 CSP 不放行内联脚本', async () => {
    const app = await createTestApp(true);
    const response = await app.inject({ method: 'GET', url: '/zh-CN' });
    const policy = String(response.headers['content-security-policy']);

    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    await app.close();
  });
});
