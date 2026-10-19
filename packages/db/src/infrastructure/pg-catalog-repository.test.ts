import { fileURLToPath } from 'node:url';

import type { CatalogRepository } from '@itools/contracts';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import { migrate } from '../migrate.js';
import { withIsolatedSchema } from '../test-support/test-database.js';
import { createPgCatalogRepository } from './pg-catalog-repository.js';

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);
const SCHEMA = 'itools_catalog_repository_test';

interface CountRow extends QueryResultRow {
  readonly count: number;
}

async function withRepository(
  work: (repo: CatalogRepository, pool: Pool) => Promise<void>,
): Promise<void> {
  await withIsolatedSchema(SCHEMA, async (pool) => {
    await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
    await work(createPgCatalogRepository({ pool }), pool);
  });
}

interface CountingPool {
  readonly pool: Pool;
  calls(): number;
}

function isQueryFailure(args: readonly unknown[]): boolean {
  return (
    typeof args[0] === 'string' &&
    args[0].includes('insert into tool_localizations')
  );
}

function wrapClient(client: PoolClient, shouldFail: boolean): PoolClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'query') {
        const query = target.query as unknown as (
          ...args: readonly unknown[]
        ) => Promise<unknown>;
        return (...args: readonly unknown[]) =>
          shouldFail && isQueryFailure(args)
            ? Promise.reject(new Error('模拟写入失败'))
            : query.apply(target, [...args]);
      }

      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** 让 localization 写入失败，用于验证单事务回滚。 */
function failingLocalizationPool(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, property, receiver) {
      if (property === 'connect') {
        return async () => wrapClient(await target.connect(), true);
      }

      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function withQueryCounter(pool: Pool): CountingPool {
  let calls = 0;
  const proxy = new Proxy(pool, {
    get(target, property, receiver) {
      if (property === 'query') {
        const query = target.query as unknown as (
          ...args: readonly unknown[]
        ) => Promise<unknown>;
        return (...args: readonly unknown[]) => {
          calls += 1;
          return query.apply(target, [...args]);
        };
      }

      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return { pool: proxy, calls: () => calls };
}

describe('createPgCatalogRepository', () => {
  it('无覆盖时读取为空', async () => {
    await withRepository(async (repo) => {
      await expect(repo.listOverrides()).resolves.toEqual([]);
      await expect(repo.getOverride('missing')).resolves.toBeUndefined();
      await expect(repo.listLocalizations('missing')).resolves.toEqual([]);
    });
  });

  it('upsert 后读取结果与写入一致', async () => {
    await withRepository(async (repo) => {
      await repo.upsertOverride({
        toolId: 'alpha',
        displayOrder: 3,
        availabilityOverride: 'disabled',
        localizations: [
          {
            locale: 'zh-CN',
            name: '阿尔法',
            summary: '摘要',
            description: '描述',
          },
          { locale: 'en', name: 'Alpha' },
        ],
      });

      const expected = {
        toolId: 'alpha',
        displayOrder: 3,
        availabilityOverride: 'disabled' as const,
        localizations: [
          { locale: 'en' as const, name: 'Alpha' },
          {
            locale: 'zh-CN' as const,
            name: '阿尔法',
            summary: '摘要',
            description: '描述',
          },
        ],
      };

      await expect(repo.getOverride('alpha')).resolves.toEqual(expected);
      await expect(repo.listOverrides()).resolves.toEqual([expected]);
    });
  });

  it('displayOrder 与 availabilityOverride 传 null 时清除覆盖', async () => {
    await withRepository(async (repo) => {
      await repo.upsertOverride({
        toolId: 'beta',
        displayOrder: 9,
        availabilityOverride: 'disabled',
        localizations: [],
      });

      await repo.upsertOverride({
        toolId: 'beta',
        displayOrder: null,
        availabilityOverride: null,
        localizations: [],
      });

      await expect(repo.getOverride('beta')).resolves.toEqual({
        toolId: 'beta',
        localizations: [],
      });
    });
  });

  it('有 tools 行但没有文案时也要返回空 localizations', async () => {
    await withRepository(async (repo) => {
      await repo.upsertOverride({
        toolId: 'gamma',
        displayOrder: 1,
        availabilityOverride: null,
        localizations: [],
      });

      await expect(repo.listOverrides()).resolves.toEqual([
        { toolId: 'gamma', displayOrder: 1, localizations: [] },
      ]);
    });
  });

  it('某一 locale 的字段更新不影响其它 locale 的覆盖', async () => {
    await withRepository(async (repo) => {
      await repo.upsertOverride({
        toolId: 'delta',
        displayOrder: 2,
        availabilityOverride: null,
        localizations: [
          {
            locale: 'zh-CN',
            name: '德尔塔',
            summary: '旧摘要',
            description: '旧描述',
          },
          { locale: 'en', name: 'Delta', summary: 'Summary' },
        ],
      });

      await repo.upsertOverride({
        toolId: 'delta',
        displayOrder: 2,
        availabilityOverride: null,
        localizations: [
          {
            locale: 'zh-CN',
            name: '德尔塔',
            summary: '旧摘要',
            description: '旧描述',
          },
          { locale: 'en', name: 'Delta Updated' },
        ],
      });

      await expect(repo.listLocalizations('delta')).resolves.toEqual([
        { locale: 'en', name: 'Delta Updated' },
        {
          locale: 'zh-CN',
          name: '德尔塔',
          summary: '旧摘要',
          description: '旧描述',
        },
      ]);
    });
  });

  it('同一 locale 再次写入时整行替换（省略字段落库为 NULL）', async () => {
    await withRepository(async (repo, pool) => {
      await repo.upsertOverride({
        toolId: 'epsilon',
        displayOrder: null,
        availabilityOverride: null,
        localizations: [
          {
            locale: 'zh-CN',
            name: '旧名称',
            summary: '旧摘要',
            description: '旧描述',
          },
        ],
      });

      await repo.upsertOverride({
        toolId: 'epsilon',
        displayOrder: null,
        availabilityOverride: null,
        localizations: [{ locale: 'zh-CN', name: '新名称' }],
      });

      await expect(repo.listLocalizations('epsilon')).resolves.toEqual([
        { locale: 'zh-CN', name: '新名称' },
      ]);

      const row = await pool.query<
        QueryResultRow & { readonly summary: string | null }
      >(
        'select summary from tool_localizations where tool_id = $1 and locale = $2',
        ['epsilon', 'zh-CN'],
      );
      expect(row.rows[0]?.summary).toBeNull();
    });
  });

  it('多工具多语言聚合正确且只发一次查询', async () => {
    await withRepository(async (repo, pool) => {
      await repo.upsertOverride({
        toolId: 'tool-c',
        displayOrder: 30,
        availabilityOverride: null,
        localizations: [
          { locale: 'zh-CN', name: 'C 中文' },
          { locale: 'en', name: 'C English' },
        ],
      });
      await repo.upsertOverride({
        toolId: 'tool-a',
        displayOrder: 10,
        availabilityOverride: 'disabled',
        localizations: [{ locale: 'en', name: 'A English' }],
      });
      await repo.upsertOverride({
        toolId: 'tool-b',
        displayOrder: null,
        availabilityOverride: null,
        localizations: [{ locale: 'zh-CN', name: 'B 中文', summary: 'B 摘要' }],
      });

      const counted = withQueryCounter(pool);
      const countingRepo = createPgCatalogRepository({ pool: counted.pool });

      const overrides = await countingRepo.listOverrides();
      expect(counted.calls()).toBe(1);

      expect(overrides).toEqual([
        {
          toolId: 'tool-a',
          displayOrder: 10,
          availabilityOverride: 'disabled',
          localizations: [{ locale: 'en', name: 'A English' }],
        },
        {
          toolId: 'tool-b',
          localizations: [
            { locale: 'zh-CN', name: 'B 中文', summary: 'B 摘要' },
          ],
        },
        {
          toolId: 'tool-c',
          displayOrder: 30,
          localizations: [
            { locale: 'en', name: 'C English' },
            { locale: 'zh-CN', name: 'C 中文' },
          ],
        },
      ]);
    });
  });

  it('删除 tools 行时级联删除 localizations', async () => {
    await withRepository(async (repo, pool) => {
      await repo.upsertOverride({
        toolId: 'cascade',
        displayOrder: null,
        availabilityOverride: null,
        localizations: [
          { locale: 'zh-CN', name: '级联' },
          { locale: 'en', name: 'Cascade' },
        ],
      });

      await pool.query('delete from tools where tool_id = $1', ['cascade']);

      const result = await pool.query<CountRow>(
        'select count(*)::int as count from tool_localizations where tool_id = $1',
        ['cascade'],
      );
      expect(result.rows[0]?.count).toBe(0);
      await expect(repo.getOverride('cascade')).resolves.toBeUndefined();
    });
  });

  it('upsert 是单事务：写入失败时不留半条数据', async () => {
    await withRepository(async (repo, pool) => {
      await repo.upsertOverride({
        toolId: 'atomic',
        displayOrder: 1,
        availabilityOverride: null,
        localizations: [{ locale: 'zh-CN', name: '原始' }],
      });

      const failingRepo = createPgCatalogRepository({
        pool: failingLocalizationPool(pool),
      });
      await expect(
        failingRepo.upsertOverride({
          toolId: 'atomic',
          displayOrder: 99,
          availabilityOverride: 'disabled',
          localizations: [{ locale: 'en', name: 'Atomic' }],
        }),
      ).rejects.toThrow(/模拟写入失败/);

      await expect(repo.getOverride('atomic')).resolves.toEqual({
        toolId: 'atomic',
        displayOrder: 1,
        localizations: [{ locale: 'zh-CN', name: '原始' }],
      });
    });
  });
});
