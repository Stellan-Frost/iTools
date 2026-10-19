/**
 * 端到端验收：真实 PostgreSQL → 迁移 → Seed → 目录合并 → HTTP API。
 * 需要 TEST_DATABASE_URL；缺失时直接失败，不静默跳过（避免把未执行写成通过）。
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

import { createApp } from './app.js';
import { createCatalogRuntime } from './catalog-runtime.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim() === '') {
  throw new Error(
    '数据库集成测试需要 TEST_DATABASE_URL；请用 pnpm test（已加载 .env）运行。',
  );
}

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
const runtime = createCatalogRuntime({ databaseUrl });

beforeAll(async () => {
  // 独立测试库：重建 schema 后跑迁移与 Seed。
  await pool.query('drop schema public cascade');
  await pool.query('create schema public');
  await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
  await seedCatalog({ writer: createPgSeedWriter(pool) });
}, 30_000);

afterAll(async () => {
  await runtime.close();
  await pool.end();
});

describe('目录 API 端到端', () => {
  it('Seed 后能从数据库读出完整目录', async () => {
    const items = await runtime.catalog.listItems();

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.availability !== 'disabled')).toBe(true);
    // 排序稳定：order 升序，同序按 id 升序。
    const sorted = [...items].sort(
      (left, right) =>
        left.order - right.order || (left.id < right.id ? -1 : 1),
    );
    expect(items.map((item) => item.id)).toEqual(sorted.map((item) => item.id));
    // Seed 预填的是注册表默认值，不应被标记为运营覆盖。
    expect(items.every((item) => item.source === 'registry')).toBe(true);
  });

  it('运营覆盖生效并标记来源', async () => {
    const items = await runtime.catalog.listItems();
    const target = items[1];
    if (target === undefined) throw new Error('目录条目不足，无法验证覆盖');

    await pool.query(
      `update tools set display_order = $2, updated_at = now() where tool_id = $1`,
      [target.id, -10],
    );

    try {
      const overridden = await runtime.catalog.listItems();
      expect(overridden[0]?.id).toBe(target.id);
      expect(overridden[0]?.order).toBe(-10);
      expect(overridden[0]?.source).toBe('override');
    } finally {
      await pool.query(
        `update tools set display_order = $2 where tool_id = $1`,
        [target.id, target.order],
      );
    }
  });

  it('下架覆盖后工具从目录消失并返回 404', async () => {
    const items = await runtime.catalog.listItems();
    const target = items[0];
    if (target === undefined) throw new Error('目录条目不足，无法验证下架');

    await pool.query(
      `update tools set availability_override = 'disabled' where tool_id = $1`,
      [target.id],
    );

    const app = await createApp({
      renderer: fakeRenderer,
      siteOrigin: 'https://itools.test',
      getTemplate: async () => '<html><head></head><body></body></html>',
      api: {
        catalog: runtime.catalog,
        ...(runtime.probeDatabase === undefined
          ? {}
          : { probeDatabase: runtime.probeDatabase }),
      },
    });

    try {
      const list = await app.inject({ method: 'GET', url: '/api/v1/tools' });
      expect(list.statusCode).toBe(200);
      const payload = list.json<{ data: { id: string }[] }>();
      expect(payload.data.map((item) => item.id)).not.toContain(target.id);

      const single = await app.inject({
        method: 'GET',
        url: `/api/v1/tools/${target.id}`,
      });
      expect(single.statusCode).toBe(404);
      expect(single.json<{ code: string }>().code).toBe('TOOL_NOT_FOUND');
    } finally {
      await pool.query(
        `update tools set availability_override = null where tool_id = $1`,
        [target.id],
      );
      await app.close();
    }
  });

  it('健康检查报告数据库可用', async () => {
    const app = await createApp({
      renderer: fakeRenderer,
      siteOrigin: 'https://itools.test',
      getTemplate: async () => '<html><head></head><body></body></html>',
      api: {
        catalog: runtime.catalog,
        ...(runtime.probeDatabase === undefined
          ? {}
          : { probeDatabase: runtime.probeDatabase }),
      },
    });

    try {
      const ready = await app.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });
      expect(ready.statusCode).toBe(200);
      expect(
        ready.json<{ checks: { database: string } }>().checks.database,
      ).toBe('ok');

      const live = await app.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });
      expect(live.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
