/**
 * 版本化迁移执行器：按文件名升序执行 `migrations/*.sql`，每个文件一个事务。
 * 已执行的文件记录 sha256 校验和，内容被改写时拒绝继续执行。
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool, QueryResultRow } from 'pg';

/** 包内迁移目录：源码运行（src/）与构建产物（dist/）都能解析到同一位置。 */
export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../migrations', import.meta.url),
);

export interface MigrateOptions {
  /** 绝对路径形式的迁移目录。 */
  readonly migrationsDir: string;
  readonly pool: Pool;
}

export interface MigrateReport {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

interface AppliedRow extends QueryResultRow {
  readonly checksum: string;
  readonly name: string;
}

const CREATE_MIGRATIONS_TABLE_SQL = `create table if not exists _migrations (
  name text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
)`;

const SELECT_APPLIED_SQL = 'select name, checksum from _migrations';

const MIGRATION_FILE_PATTERN = /\.sql$/;

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

/** 只取错误码用于日志，避免把可能含有 SQL 片段的原始信息透出。 */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : undefined;
}

function checksumOf(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort(compareNames);
}

async function applyMigration(
  pool: Pool,
  name: string,
  sql: string,
  checksum: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into _migrations (name, checksum) values ($1, $2)',
      [name, checksum],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    const code = errorCode(error);
    const detail = code === undefined ? '' : `（错误码 ${code}）`;
    throw new Error(`迁移 ${name} 执行失败，已整体回滚${detail}。`, {
      cause: error,
    });
  } finally {
    client.release();
  }
}

export async function migrate(options: MigrateOptions): Promise<MigrateReport> {
  const { pool } = options;
  await pool.query(CREATE_MIGRATIONS_TABLE_SQL);

  const files = await listMigrationFiles(options.migrationsDir);
  const recorded = await pool.query<AppliedRow>(SELECT_APPLIED_SQL);
  const known = new Map(recorded.rows.map((row) => [row.name, row.checksum]));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const name of files) {
    const sql = await readFile(join(options.migrationsDir, name), 'utf8');
    const checksum = checksumOf(sql);
    const previous = known.get(name);

    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new Error(
          `迁移 ${name} 的内容与登记记录不一致（checksum 不匹配），已应用的迁移不得改写。`,
        );
      }

      skipped.push(name);
      continue;
    }

    await applyMigration(pool, name, sql, checksum);
    applied.push(name);
  }

  return { applied, skipped };
}
