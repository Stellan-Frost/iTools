import { fileURLToPath } from 'node:url';

import type { AdminCredentialRepository } from '@itools/contracts';
import type { Pool, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import { migrate } from '../migrate.js';
import { withIsolatedSchema } from '../test-support/test-database.js';
import { createPgAdminCredentialRepository } from './pg-admin-credentials.js';

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);
const SCHEMA = 'itools_admin_credentials_test';

const MIGRATION_FILES = ['0001_initial.sql', '0002_admin_credentials.sql'];
const DOMAIN_TABLES = [
  'admin_credentials',
  'admin_sessions',
  'tool_localizations',
  'tool_metadata_versions',
  'tools',
];

interface NameRow extends QueryResultRow {
  readonly name: string;
}

interface ColumnRow extends QueryResultRow {
  readonly column_default: string | null;
  readonly column_name: string;
  readonly data_type: string;
  readonly is_nullable: string;
}

async function withMigrated(
  work: (repo: AdminCredentialRepository, pool: Pool) => Promise<void>,
): Promise<void> {
  await withIsolatedSchema(SCHEMA, async (pool) => {
    await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
    await work(createPgAdminCredentialRepository({ pool }), pool);
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

describe('迁移 0002_admin_credentials.sql', () => {
  it('0001 + 0002 顺序执行后建出 5 张业务表', async () => {
    await withIsolatedSchema(SCHEMA, async (pool) => {
      const report = await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      expect(report).toEqual({ applied: MIGRATION_FILES, skipped: [] });
      expect(
        (await tableNames(pool)).filter((name) => name !== '_migrations'),
      ).toEqual(DOMAIN_TABLES);
    });
  });

  it('重复执行幂等：第二次全部跳过', async () => {
    await withIsolatedSchema(SCHEMA, async (pool) => {
      await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
      const second = await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      expect(second).toEqual({ applied: [], skipped: MIGRATION_FILES });
    });
  });

  it('admin_credentials 的列与冻结 schema 逐字段一致', async () => {
    await withIsolatedSchema(SCHEMA, async (pool) => {
      await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      const columns = await pool.query<ColumnRow>(
        `select column_name, data_type, is_nullable, column_default
           from information_schema.columns
          where table_schema = current_schema() and table_name = 'admin_credentials'
          order by ordinal_position`,
      );

      expect(
        columns.rows.map((row) => [
          row.column_name,
          row.data_type,
          row.is_nullable,
        ]),
      ).toEqual([
        ['id', 'integer', 'NO'],
        ['password_hash', 'text', 'NO'],
        ['created_at', 'timestamp with time zone', 'NO'],
        ['updated_at', 'timestamp with time zone', 'NO'],
      ]);

      for (const name of ['created_at', 'updated_at']) {
        const row = columns.rows.find((item) => item.column_name === name);
        expect(row?.column_default).toContain('now()');
      }
    });
  });

  it('单行约束名为 admin_credentials_single_row', async () => {
    await withIsolatedSchema(SCHEMA, async (pool) => {
      await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      const constraints = await pool.query<NameRow>(
        `select conname as name
           from pg_constraint
          where contype = 'c'
            and conrelid = 'admin_credentials'::regclass`,
      );

      expect(constraints.rows.map((row) => row.name)).toEqual([
        'admin_credentials_single_row',
      ]);
    });
  });

  it('插入 id = 2 被 check 约束拒绝', async () => {
    await withIsolatedSchema(SCHEMA, async (pool) => {
      await migrate({ pool, migrationsDir: MIGRATIONS_DIR });

      await expect(
        pool.query(
          "insert into admin_credentials (id, password_hash) values (2, 'x')",
        ),
      ).rejects.toThrow(/admin_credentials_single_row/);
    });
  });
});

describe('createPgAdminCredentialRepository', () => {
  it('未初始化时 get() 返回 undefined', async () => {
    await withMigrated(async (repo) => {
      await expect(repo.get()).resolves.toBeUndefined();
    });
  });

  it('create 只在首次成功，第二次返回 false 且不覆盖', async () => {
    await withMigrated(async (repo) => {
      await expect(repo.create('hash-first')).resolves.toBe(true);
      await expect(repo.create('hash-second')).resolves.toBe(false);

      const record = await repo.get();
      expect(record?.passwordHash).toBe('hash-first');
      expect(record?.createdAt).toBe(record?.updatedAt);
    });
  });

  it('并发 create 只有一个成功', async () => {
    await withMigrated(async (repo) => {
      const results = await Promise.all([
        repo.create('hash-a'),
        repo.create('hash-b'),
      ]);

      expect(results.filter((result) => result)).toHaveLength(1);
      const record = await repo.get();
      expect(['hash-a', 'hash-b']).toContain(record?.passwordHash);
    });
  });

  it('updatePasswordHash 写入新值并刷新 updated_at', async () => {
    await withMigrated(async (repo, pool) => {
      await repo.create('hash-old');
      await pool.query(
        "update admin_credentials set updated_at = '2020-01-01T00:00:00Z' where id = 1",
      );

      await repo.updatePasswordHash('hash-new');

      const record = await repo.get();
      expect(record?.passwordHash).toBe('hash-new');
      expect(Date.parse(record?.updatedAt ?? '')).toBeGreaterThan(
        Date.parse('2020-01-01T00:00:00Z'),
      );
    });
  });

  it('没有凭据行时 updatePasswordHash 抛错', async () => {
    await withMigrated(async (repo) => {
      await expect(repo.updatePasswordHash('hash-new')).rejects.toThrow(
        /尚未初始化/,
      );
    });
  });
});
