/**
 * 阶段 8 端到端验收：真实 PostgreSQL 上的初始化、登录、编辑、版本、回滚与登出。
 * 需要 TEST_DATABASE_URL；缺失时直接失败，不静默跳过。
 */
import {
  MIGRATIONS_DIR,
  createPgSeedWriter,
  createPool,
  migrate,
  seedCatalog,
} from '@itools/db';
import type { SsrRenderer } from '@itools/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createCatalogRuntime } from '../catalog-runtime.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL === undefined || TEST_DATABASE_URL.trim() === '') {
  throw new Error(
    '管理端到端测试需要 TEST_DATABASE_URL（pnpm test 已加载 .env）。',
  );
}

/**
 * 独立 schema：与目录端到端测试并行运行时互不干扰；
 * 迁移与 Seed 都落在本 schema（SQL 使用非限定表名）。
 */
const SCHEMA_NAME = 'itools_admin_e2e';
const databaseUrl = `${TEST_DATABASE_URL}${TEST_DATABASE_URL.includes('?') ? '&' : '?'}options=-c%20search_path%3D${SCHEMA_NAME}`;

const SETUP_TOKEN = 'integration-setup-token-0123456789';
const PASSWORD = 'integration-password-1';

const fakeRenderer: SsrRenderer = {
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

const pool = createPool({ connectionString: databaseUrl });
const runtime = createCatalogRuntime({
  databaseUrl,
  adminSetupToken: SETUP_TOKEN,
  secureCookies: false,
});

interface Browser {
  session: string;
  csrf: string;
}

function cookiesOf(response: {
  cookies: readonly { name: string; value: string }[];
}): Record<string, string> {
  return Object.fromEntries(
    response.cookies.map((cookie) => [cookie.name, cookie.value]),
  );
}

function browserOf(response: {
  cookies: readonly { name: string; value: string }[];
}): Browser {
  const cookies = cookiesOf(response);
  const session = cookies['itools_admin'];
  const csrf = cookies['itools_admin_csrf'];
  if (session === undefined || csrf === undefined) {
    throw new Error('响应缺少会话或 CSRF Cookie');
  }
  return { session, csrf };
}

function headers(browser: Browser): Record<string, string> {
  return {
    cookie: `itools_admin=${browser.session}; itools_admin_csrf=${browser.csrf}`,
    'x-csrf-token': browser.csrf,
  };
}

const app = createApp({
  renderer: fakeRenderer,
  siteOrigin: 'http://itools.test',
  getTemplate: async () => '<html><head></head><body></body></html>',
  api: {
    catalog: runtime.catalog,
    ...(runtime.probeDatabase === undefined
      ? {}
      : { probeDatabase: runtime.probeDatabase }),
  },
  ...(runtime.admin === undefined ? {} : { admin: runtime.admin }),
});

let setupBrowser: Browser;
let toolId: string;
let firstPatchVersionId = 0;
let secondPatchVersionId = 0;

beforeAll(async () => {
  await pool.query(`drop schema if exists ${SCHEMA_NAME} cascade`);
  await pool.query(`create schema ${SCHEMA_NAME}`);
  await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
  await seedCatalog({ writer: createPgSeedWriter(pool) });
}, 30_000);

afterAll(async () => {
  await (await app).close();
  await runtime.close();
  await pool.end();
});

describe('管理后台端到端', () => {
  it('初始化返回 201 并下发两个 Cookie', async () => {
    const instance = await app;
    const response = await instance.inject({
      method: 'POST',
      url: '/api/v1/admin/setup',
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });

    expect(response.statusCode).toBe(201);
    setupBrowser = browserOf(response);
    expect(setupBrowser.session.length).toBeGreaterThan(20);

    const items = await runtime.catalog.listItems();
    const first = items[0];
    if (first === undefined) throw new Error('目录为空');
    toolId = first.id;
  });

  it('重复初始化返回 409', async () => {
    const instance = await app;
    const response = await instance.inject({
      method: 'POST',
      url: '/api/v1/admin/setup',
      payload: { token: SETUP_TOKEN, password: PASSWORD },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_ALREADY_INITIALIZED',
    );
  });

  it('缺少 CSRF 的写请求被拒绝', async () => {
    const instance = await app;
    const response = await instance.inject({
      method: 'PATCH',
      url: `/api/v1/admin/tools/${toolId}/metadata`,
      headers: { cookie: `itools_admin=${setupBrowser.session}` },
      payload: { localizations: { 'zh-CN': { name: '未授权改名' } } },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('ADMIN_CSRF_FAILED');
  });

  it('编辑名称后目录立即生效并产生版本', async () => {
    const instance = await app;
    const first = await instance.inject({
      method: 'PATCH',
      url: `/api/v1/admin/tools/${toolId}/metadata`,
      headers: headers(setupBrowser),
      payload: { localizations: { 'zh-CN': { name: '集成测试名称一' } } },
    });
    expect(first.statusCode).toBe(200);

    const second = await instance.inject({
      method: 'PATCH',
      url: `/api/v1/admin/tools/${toolId}/metadata`,
      headers: headers(setupBrowser),
      payload: { localizations: { 'zh-CN': { name: '集成测试名称二' } } },
    });
    expect(second.statusCode).toBe(200);

    const items = await runtime.catalog.listItems();
    const target = items.find((item) => item.id === toolId);
    expect(target?.name['zh-CN']).toBe('集成测试名称二');
    expect(target?.source).toBe('override');

    const versions = await instance.inject({
      method: 'GET',
      url: `/api/v1/admin/tools/${toolId}/versions`,
      headers: { cookie: `itools_admin=${setupBrowser.session}` },
    });
    expect(versions.statusCode).toBe(200);
    const list = versions.json<{
      data: { versionId: number; name: string; locale: string }[];
    }>().data;
    const zhVersions = list.filter((version) => version.locale === 'zh-CN');
    expect(zhVersions).toHaveLength(2);
    firstPatchVersionId = zhVersions[1]?.versionId ?? 0;
    secondPatchVersionId = zhVersions[0]?.versionId ?? 0;
    expect(firstPatchVersionId).toBeGreaterThan(0);
  });

  it('回滚恢复旧文案并追加新版本', async () => {
    const instance = await app;
    const response = await instance.inject({
      method: 'POST',
      url: `/api/v1/admin/tools/${toolId}/rollback`,
      headers: headers(setupBrowser),
      payload: {
        versionId: firstPatchVersionId,
        expectedVersionId: secondPatchVersionId,
      },
    });
    expect(response.statusCode).toBe(200);

    const items = await runtime.catalog.listItems();
    expect(items.find((item) => item.id === toolId)?.name['zh-CN']).toBe(
      '集成测试名称一',
    );
  });

  it('过期期望版本触发冲突且不写数据', async () => {
    const instance = await app;
    const response = await instance.inject({
      method: 'POST',
      url: `/api/v1/admin/tools/${toolId}/rollback`,
      headers: headers(setupBrowser),
      payload: {
        versionId: firstPatchVersionId,
        expectedVersionId: firstPatchVersionId,
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe(
      'ADMIN_VERSION_CONFLICT',
    );
  });

  it('登出后旧 Cookie 立即失效', async () => {
    const instance = await app;
    const logout = await instance.inject({
      method: 'DELETE',
      url: '/api/v1/admin/session',
      headers: { cookie: `itools_admin=${setupBrowser.session}` },
    });
    expect(logout.statusCode).toBe(204);

    const afterLogout = await instance.inject({
      method: 'PATCH',
      url: `/api/v1/admin/tools/${toolId}/metadata`,
      headers: headers(setupBrowser),
      payload: { localizations: { 'zh-CN': { name: '登出后修改' } } },
    });
    expect(afterLogout.statusCode).toBe(401);
    expect(afterLogout.json<{ code: string }>().code).toBe(
      'ADMIN_NOT_AUTHENTICATED',
    );
  });

  it('重新登录可继续编辑', async () => {
    const instance = await app;
    const login = await instance.inject({
      method: 'POST',
      url: '/api/v1/admin/session',
      payload: { password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);

    const browser = browserOf(login);
    const response = await instance.inject({
      method: 'PATCH',
      url: `/api/v1/admin/tools/${toolId}/metadata`,
      headers: headers(browser),
      payload: { localizations: { en: { name: 'Integration name' } } },
    });
    expect(response.statusCode).toBe(200);

    const items = await runtime.catalog.listItems();
    expect(items.find((item) => item.id === toolId)?.name.en).toBe(
      'Integration name',
    );
  });
});
