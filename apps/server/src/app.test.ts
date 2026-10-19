import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Locale, SsrRenderRequest, SsrRenderer } from '@itools/contracts';
import { DEFAULT_LOCALE, LOCALES } from '@itools/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type StaticRoots } from './app.js';
import { escapeHtml, injectHtml } from './html.js';
import { buildRobotsTxt } from './robots.js';
import { buildSitemap, escapeXml } from './sitemap.js';

const SITE_ORIGIN = 'https://itools.example';

const TEMPLATE = [
  '<!doctype html>',
  '<html lang="zh-CN">',
  '  <head>',
  '    <!--app-head-->',
  '  </head>',
  '  <body>',
  '    <div id="root"><!--app-html--></div>',
  '  </body>',
  '</html>',
].join('\n');

interface StubOptions {
  statusCode?: 200 | 404;
  lang?: Locale;
  headHtml?: string;
  appHtml?: string;
  sitemapUrls?: readonly string[];
}

interface StubRenderer extends SsrRenderer {
  readonly requests: SsrRenderRequest[];
  readonly sitemapOrigins: string[];
}

function createStubRenderer(options: StubOptions = {}): StubRenderer {
  const requests: SsrRenderRequest[] = [];
  const sitemapOrigins: string[] = [];

  return {
    supportedLocales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    requests,
    sitemapOrigins,
    async render(request) {
      requests.push(request);
      return {
        statusCode: options.statusCode ?? 200,
        lang: options.lang ?? 'zh-CN',
        headHtml: options.headHtml ?? '<title>Stub title</title>',
        appHtml: options.appHtml ?? '<main>Stub app</main>',
      };
    },
    async listSitemapUrls(siteOrigin) {
      sitemapOrigins.push(siteOrigin);
      return options.sitemapUrls ?? [];
    },
  };
}

const openApps: FastifyInstance[] = [];
const tempDirs: string[] = [];

async function createTestApp(
  renderer: SsrRenderer,
  staticRoots?: StaticRoots,
): Promise<FastifyInstance> {
  const app = await createApp({
    renderer,
    siteOrigin: SITE_ORIGIN,
    getTemplate: async () => TEMPLATE,
    ...(staticRoots === undefined ? {} : { staticRoots }),
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('根路径与尾斜杠', () => {
  it('GET / 302 到默认语言', async () => {
    const app = await createTestApp(createStubRenderer());

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/zh-CN');
  });

  it('非根路径尾斜杠 308 去除并保留查询串', async () => {
    const renderer = createStubRenderer();
    const app = await createTestApp(renderer);

    const response = await app.inject({
      method: 'GET',
      url: '/zh-CN/?from=search&page=2',
    });

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('/zh-CN?from=search&page=2');
    expect(renderer.requests).toHaveLength(0);
  });
});

describe('SSR 请求处理', () => {
  it('注入模板并原样传递 url 与 siteOrigin', async () => {
    const renderer = createStubRenderer({
      lang: 'en',
      headHtml:
        '<title>Tool</title><link rel="canonical" href="https://itools.example/en">',
      appHtml: '<main id="app">Tool</main>',
    });
    const app = await createTestApp(renderer);

    const response = await app.inject({
      method: 'GET',
      url: '/en/image/image-inspector?from=search',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe(
      'public, max-age=0, must-revalidate',
    );
    expect(response.body).toContain('<html lang="en">');
    expect(response.body).toContain('<title>Tool</title>');
    expect(response.body).toContain('<main id="app">Tool</main>');
    expect(response.body).not.toContain('<!--app-head-->');
    expect(response.body).not.toContain('<!--app-html-->');
    expect(renderer.requests).toEqual([
      { url: '/en/image/image-inspector?from=search', siteOrigin: SITE_ORIGIN },
    ]);
  });

  it('渲染器返回 404 时响应真实 404 且不缓存', async () => {
    const renderer = createStubRenderer({
      statusCode: 404,
      appHtml: '<main>Not found</main>',
    });
    const app = await createTestApp(renderer);

    const response = await app.inject({
      method: 'GET',
      url: '/en/unknown/page',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toContain('<main>Not found</main>');
  });

  it('非 GET/HEAD 的未匹配请求返回 404 且不调用渲染器', async () => {
    const renderer = createStubRenderer();
    const app = await createTestApp(renderer);

    const response = await app.inject({ method: 'POST', url: '/zh-CN' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toBe('Not Found');
    expect(renderer.requests).toHaveLength(0);
  });
});

describe('sitemap.xml', () => {
  it('输出条目、转义 XML 并设置缓存头', async () => {
    const urls = [
      `${SITE_ORIGIN}/zh-CN`,
      `${SITE_ORIGIN}/zh-CN/text?q=1&lang='en'`,
    ];
    const renderer = createStubRenderer({ sitemapUrls: urls });
    const app = await createTestApp(renderer);

    const response = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(
      'application/xml; charset=utf-8',
    );
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.body).toContain(`<loc>${SITE_ORIGIN}/zh-CN</loc>`);
    expect(response.body).toContain('?q=1&amp;lang=&apos;en&apos;');
    expect(renderer.sitemapOrigins).toEqual([SITE_ORIGIN]);
  });
});

describe('robots.txt', () => {
  it('包含抓取规则与绝对 sitemap 地址', async () => {
    const app = await createTestApp(createStubRenderer());

    const response = await app.inject({ method: 'GET', url: '/robots.txt' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.body).toContain('User-agent: *');
    expect(response.body).toContain('Allow: /');
    expect(response.body).toContain('Disallow: /zh-CN/tasks');
    expect(response.body).toContain('Disallow: /en/tasks');
    expect(response.body).toContain('Disallow: /zh-CN/admin');
    expect(response.body).toContain('Disallow: /en/admin');
    expect(response.body).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe('模板注入', () => {
  it('缺少 <!--app-html--> 时抛错', () => {
    const template = TEMPLATE.replace('<!--app-html-->', '');

    expect(() =>
      injectHtml(template, {
        statusCode: 200,
        lang: 'zh-CN',
        headHtml: '<title>x</title>',
        appHtml: '<main>x</main>',
      }),
    ).toThrow(/app-html/);
  });

  it('缺少 <!--app-head--> 时报错', () => {
    const template = TEMPLATE.replace('<!--app-head-->', '');

    expect(() =>
      injectHtml(template, {
        statusCode: 200,
        lang: 'zh-CN',
        headHtml: '',
        appHtml: '',
      }),
    ).toThrow(/app-head/);
  });

  it('替换 html lang 且不解释 appHtml 中的替换模式', () => {
    const html = injectHtml(TEMPLATE, {
      statusCode: 200,
      lang: 'en',
      headHtml: '<title>t</title>',
      appHtml: '<p>$& $1 $`</p>',
    });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<p>$& $1 $`</p>');
  });
});

describe('纯函数', () => {
  it('escapeHtml / escapeXml 覆盖全部敏感字符', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('buildSitemap 保持空列表结构合法', () => {
    expect(buildSitemap([])).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
  });

  it('buildRobotsTxt 以换行结尾', () => {
    expect(buildRobotsTxt(SITE_ORIGIN).endsWith('\n')).toBe(true);
  });
});

describe('静态资源', () => {
  it('assets 与 brand-icon 使用各自的缓存策略', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'itools-static-'));
    tempDirs.push(root);
    const assets = path.join(root, 'assets');
    const brandIcons = path.join(root, 'brand-icon');
    await mkdir(assets);
    await mkdir(brandIcons);
    await writeFile(path.join(assets, 'app.js'), 'console.log("itools");');
    await writeFile(
      path.join(brandIcons, 'favicon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );

    const app = await createTestApp(createStubRenderer(), {
      assets,
      brandIcons,
    });

    const asset = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );

    const icon = await app.inject({
      method: 'GET',
      url: '/brand-icon/favicon.svg',
    });
    expect(icon.statusCode).toBe(200);
    expect(icon.headers['cache-control']).toBe('public, max-age=86400');
  });
});
