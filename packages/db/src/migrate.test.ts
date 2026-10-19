import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import { migrate } from './migrate.js';
import {
  assertTestDatabase,
  readTestDatabaseUrl,
  withIsolatedSchema,
  withTestDatabase,
} from './test-support/test-database.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));
const SCHEMA = 'itools_migrate_test';

interface NameRow extends QueryResultRow {
  readonly name: string;
}

async function withMigratedSchema(
  work: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withIsolatedSchema(SCHEMA, async (pool) => {
    await work(pool);
  });
}

async function tableNames(pool: Pool): Promise<readonly string[]> {
  const result = await pool.query<NameRow>(
    `select table_name as name
       from information_schema.tables
      where table_schema = current_schema()
      order by table_name`,
  );
  return result.rows.map((row) => row.name);
}

async function indexNames(pool: Pool): Promise<readonly string[]> {
  const result = await pool.query<NameRow>(
    `select indexname as name
       from pg_indexes
      where schemaname = current_schema()
      order by indexname`,
  );
  return result.rows.map((row) => row.name);
}

describe('migrate', () => {
  it('在新库上创建全部表与索引', async () => {
    await withMigratedSchema(async (pool) => {
      const report = await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      expect(report).toEqual({
        applied: ['0001_initial.sql', '0002_admin_credentials.sql'],
        skipped: [],
      });

      const tables = await tableNames(pool);
      expect(tables).toContain('_migrations');
      expect(tables.filter((name) => name !== '_migrations')).toEqual([
        'admin_credentials',
        'admin_sessions',
        'tool_localizations',
        'tool_metadata_versions',
        'tools',
      ]);

      const indexes = await indexNames(pool);
      expect(indexes.filter((name) => !name.startsWith('_migrations'))).toEqual(
        [
          'admin_credentials_pkey',
          'admin_sessions_expires_idx',
          'admin_sessions_pkey',
          'admin_sessions_token_hash_idx',
          'tool_localizations_locale_idx',
          'tool_localizations_tool_id_locale_pk',
          'tool_metadata_versions_pkey',
          'tool_metadata_versions_tool_idx',
          'tools_pkey',
        ],
      );
    });
  });

  it('列的可空性、默认值与级联删除与冻结 schema 一致', async () => {
    await withMigratedSchema(async (pool) => {
      await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      const columns = await pool.query<
        QueryResultRow & {
          readonly column_default: string | null;
          readonly column_name: string;
          readonly data_type: string;
          readonly is_nullable: string;
        }
      >(
        `select column_name, data_type, is_nullable, column_default
           from information_schema.columns
          where table_schema = current_schema() and table_name = 'tool_localizations'
          order by ordinal_position`,
      );

      expect(
        columns.rows.map((row) => [
          row.column_name,
          row.data_type,
          row.is_nullable,
        ]),
      ).toEqual([
        ['tool_id', 'text', 'NO'],
        ['locale', 'text', 'NO'],
        ['name', 'text', 'YES'],
        ['summary', 'text', 'YES'],
        ['description', 'text', 'YES'],
        ['updated_at', 'timestamp with time zone', 'NO'],
      ]);

      const updatedAt = columns.rows.find(
        (row) => row.column_name === 'updated_at',
      );
      expect(updatedAt?.column_default).toContain('now()');

      const constraints = await pool.query<
        QueryResultRow & { readonly confdeltype: string }
      >(
        `select confdeltype
           from pg_constraint
          where contype = 'f' and conrelid = 'tool_localizations'::regclass`,
      );
      expect(constraints.rows.map((row) => row.confdeltype)).toEqual(['c']);
    });
  });

  it('重复执行幂等：第二次全部跳过', async () => {
    await withMigratedSchema(async (pool) => {
      const first = await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
      const second = await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      expect(first.applied).toEqual([
        '0001_initial.sql',
        '0002_admin_credentials.sql',
      ]);
      expect(second).toEqual({
        applied: [],
        skipped: ['0001_initial.sql', '0002_admin_credentials.sql'],
      });
    });
  });

  it('已应用迁移被改写时因 checksum 不匹配而失败', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'itools-checksum-'));
    const file = join(dir, '0001_demo.sql');

    try {
      await writeFile(
        file,
        'create table checksum_demo (id integer primary key);\n',
      );

      await withMigratedSchema(async (pool) => {
        await migrate({ pool, migrationsDir: dir });
        await writeFile(
          file,
          'create table checksum_demo (id integer primary key);\n-- 内容被改写\n',
        );

        await expect(migrate({ pool, migrationsDir: dir })).rejects.toThrow(
          /checksum/,
        );
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('失败迁移整体回滚且错误信息不含 SQL 正文', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'itools-rollback-'));
    try {
      await writeFile(
        join(dir, '0001_ok.sql'),
        'create table migrate_ok (id integer primary key);\n',
      );
      await writeFile(
        join(dir, '0002_broken.sql'),
        [
          'create table rolled_back_probe (id integer primary key);',
          'insert into missing_table_xyz (id) values (1);',
        ].join('\n'),
      );

      await withMigratedSchema(async (pool) => {
        const error: unknown = await migrate({
          pool,
          migrationsDir: dir,
        }).then(
          () => undefined,
          (reason: unknown) => reason,
        );

        expect(error).toBeInstanceOf(Error);
        const message = error instanceof Error ? error.message : '';
        expect(message).toContain('0002_broken.sql');
        expect(message).not.toMatch(
          /missing_table_xyz|rolled_back_probe|create table/i,
        );

        const tables = await tableNames(pool);
        expect(tables).toContain('migrate_ok');
        expect(tables).not.toContain('rolled_back_probe');

        const applied = await pool.query<NameRow>(
          'select name from _migrations order by name',
        );
        expect(applied.rows.map((row) => row.name)).toEqual(['0001_ok.sql']);
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('按文件名升序执行（依赖表只能后建）', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'itools-order-'));
    try {
      await writeFile(
        join(dir, '0002_child.sql'),
        'create table order_child (id integer primary key, parent_id text references order_parent(id));\n',
      );
      await writeFile(
        join(dir, '0001_parent.sql'),
        'create table order_parent (id text primary key);\n',
      );

      await withMigratedSchema(async (pool) => {
        const report = await migrate({ pool, migrationsDir: dir });
        expect(report.applied).toEqual(['0001_parent.sql', '0002_child.sql']);
        expect(await tableNames(pool)).toEqual(
          expect.arrayContaining(['order_child', 'order_parent']),
        );
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('withTestDatabase 重置后不保留上一次的数据', async () => {
    const first = await withTestDatabase(async (pool) => {
      await pool.query("insert into tools (tool_id) values ('reset-probe')");
      const result = await pool.query<NameRow>(
        "select tool_id as name from tools where tool_id = 'reset-probe'",
      );
      return result.rows.length;
    });

    const second = await withTestDatabase(async (pool) => {
      const result = await pool.query<NameRow>(
        'select tool_id as name from tools',
      );
      return result.rows.length;
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it('拒绝在库名不以 _test 结尾的库上运行', () => {
    expect(() =>
      assertTestDatabase(
        'postgresql://itools:itools-dev@127.0.0.1:5432/itools',
      ),
    ).toThrow(/_test/);

    expect(() => assertTestDatabase(readTestDatabaseUrl())).not.toThrow();
  });
});
