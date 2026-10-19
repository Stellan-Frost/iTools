import type {
  DatabaseHealth,
  SsrRenderRequest,
  SsrRenderer,
  ToolCatalogItem,
  ToolCatalogService,
} from '@itools/contracts';
import { DEFAULT_LOCALE, LOCALES } from '@itools/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { ApiOptions } from './options.js';

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

const TOOL: ToolCatalogItem = {
  id: 'image-inspector',
  category: 'image',
  availability: 'implemented',
  name: { 'zh-CN': '图片检查器', en: 'Image Inspector' },
  summary: { 'zh-CN': '查看图片信息', en: 'Inspect image metadata' },
  description: {
    'zh-CN': '查看图片的详细信息。',
    en: 'Inspect image details.',
  },
  order: 1,
  source: 'registry',
};

function createStubRenderer(): SsrRenderer {
  const requests: SsrRenderRequest[] = [];

  return {
    supportedLocales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    async render(request) {
      requests.push(request);
      return {
        statusCode: 200,
        lang: 'zh-CN',
        headHtml: '<title>Stub</title>',
        appHtml: '<main>Stub</main>',
      };
    },
    async listSitemapUrls() {
      return [];
    },
  };
}

interface CatalogStub {
  readonly catalog: ToolCatalogService;
  readonly state: {
    listItemsCalls: number;
    getItemCalls: string[];
  };
}

function createStubCatalog(items: readonly ToolCatalogItem[]): CatalogStub {
  const state = { listItemsCalls: 0, getItemCalls: [] as string[] };

  return {
    state,
    catalog: {
      async listItems() {
        state.listItemsCalls += 1;
        return items;
      },
      async getItem(toolId) {
        state.getItemCalls.push(toolId);
        return items.find((item) => item.id === toolId);
      },
      async listByCategory(category) {
        return items.filter((item) => item.category === category);
      },
    },
  };
}

const openApps: FastifyInstance[] = [];

async function createTestApp(api?: ApiOptions): Promise<FastifyInstance> {
  const app = await createApp({
    renderer: createStubRenderer(),
    siteOrigin: SITE_ORIGIN,
    getTemplate: async () => TEMPLATE,
    ...(api === undefined ? {} : { api }),
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('GET /api/v1/tools', () => {
  it('返回目录并只调用一次 listItems', async () => {
    const { catalog, state } = createStubCatalog([TOOL]);
    const app = await createTestApp({ catalog });

    const response = await app.inject({ method: 'GET', url: '/api/v1/tools' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(state.listItemsCalls).toBe(1);
    expect(response.json<{ data: ToolCatalogItem[] }>()).toEqual({
      data: [TOOL],
    });
  });

  it('目录服务抛错时返回 503 且不泄露内部信息', async () => {
    const secret =
      'connect ECONNREFUSED postgres://itools:secret@10.0.0.5:5432/itools';
    const catalog: ToolCatalogService = {
      async listItems() {
        throw new Error(secret);
      },
      async getItem() {
        throw new Error(secret);
      },
      async listByCategory() {
        throw new Error(secret);
      },
    };
    const app = await createTestApp({ catalog });

    const response = await app.inject({ method: 'GET', url: '/api/v1/tools' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<{
      code: string;
      message: string;
      requestId: string;
    }>();
    expect(body.code).toBe('CATALOG_UNAVAILABLE');
    expect(body.requestId).not.toBe('');
    for (const leaked of ['ECONNREFUSED', 'postgres', 'secret', '10.0.0.5']) {
      expect(body.message).not.toContain(leaked);
      expect(response.body).not.toContain(leaked);
    }
  });

  it('未注入 catalog 时返回 503 而不是空数组', async () => {
    const app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/v1/tools' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<{
      code: string;
      message: string;
      requestId: string;
    }>();
    expect(body.code).toBe('CATALOG_UNAVAILABLE');
    expect(body.requestId).not.toBe('');
    expect(response.body).not.toContain('"data"');
  });
});

describe('GET /api/v1/tools/:toolId', () => {
  it('命中时返回条目且不缓存', async () => {
    const { catalog, state } = createStubCatalog([TOOL]);
    const app = await createTestApp({ catalog });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tools/image-inspector',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json<{ data: ToolCatalogItem }>()).toEqual({ data: TOOL });
    expect(state.getItemCalls).toEqual(['image-inspector']);
  });

  it('未命中时返回 404 且错误结构含 requestId', async () => {
    const { catalog } = createStubCatalog([TOOL]);
    const app = await createTestApp({ catalog });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tools/missing-tool',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<{
      code: string;
      message: string;
      requestId: string;
    }>();
    expect(body.code).toBe('TOOL_NOT_FOUND');
    expect(body.message.length).toBeGreaterThan(0);
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
  });

  it('未注入 catalog 时返回 503', async () => {
    const app = await createTestApp({});

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tools/image-inspector',
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json<{ code: string }>().code).toBe('CATALOG_UNAVAILABLE');
  });
});

describe('健康检查', () => {
  it('live 不探测数据库', async () => {
    let probeCalls = 0;
    const app = await createTestApp({
      probeDatabase: async () => {
        probeCalls += 1;
        return 'unavailable';
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });

    expect(response.statusCode).toBe(200);
    expect(probeCalls).toBe(0);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: { database: 'skipped' },
    });
  });

  it('ready 在数据库可用时返回 200', async () => {
    const app = await createTestApp({
      probeDatabase: async () => 'ok',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: { database: 'ok' },
    });
  });

  it('ready 在数据库不可用时返回 503', async () => {
    const app = await createTestApp({
      probeDatabase: async () => 'unavailable',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      status: 'degraded',
      checks: { database: 'unavailable' },
    });
  });

  it('ready 未注入探测函数时返回 skipped', async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: { database: 'skipped' },
    });
  });

  it('ready 探测抛错时按不可用处理且不泄露错误', async () => {
    const app = await createTestApp({
      probeDatabase: async (): Promise<DatabaseHealth> => {
        throw new Error('password authentication failed for user "itools"');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/ready',
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('password');
    expect(response.json()).toEqual({
      status: 'degraded',
      checks: { database: 'unavailable' },
    });
  });
});

describe('OpenAPI', () => {
  it('文档可获取且包含四条 API 路径', async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/openapi.json',
    });

    expect(response.statusCode).toBe(200);
    const document = response.json<{
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    }>();

    expect(document.openapi).toBe('3.1.0');
    for (const path of [
      '/api/v1/tools',
      '/api/v1/tools/{toolId}',
      '/api/v1/health/live',
      '/api/v1/health/ready',
    ]) {
      expect(document.paths[path]).toBeDefined();
      expect(document.paths[path]?.['get']).toBeDefined();
    }
  });

  it('OpenAPI 文档不暴露在 /api/v1 之外', async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/documentation/json',
    });

    expect(response.headers['content-type']).toContain('text/html');
  });
});
