/**
 * 真实 PostgreSQL 的测试支持。
 * 安全闸门：库名必须以 `_test` 结尾，避免误清开发库或生产库。
 */
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { createPool } from '../infrastructure/pool.js';
import { migrate } from '../migrate.js';

const DEFAULT_MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

const TEST_SUFFIX = '_test';
const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

export interface ResetTestDatabaseOptions {
  readonly migrationsDir?: string;
}

export interface WithTestDatabaseOptions extends ResetTestDatabaseOptions {
  readonly max?: number;
}

function databaseNameOf(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('TEST_DATABASE_URL 不是合法的 PostgreSQL 连接串。');
  }

  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (name === '') {
    throw new Error('TEST_DATABASE_URL 未指定数据库名。');
  }

  return name;
}

/** 库名不以 `_test` 结尾时抛错；只暴露库名，不回显连接串。 */
export function assertTestDatabase(connectionString: string): void {
  const name = databaseNameOf(connectionString);
  if (!name.endsWith(TEST_SUFFIX)) {
    throw new Error(
      `拒绝在数据库 ${name} 上执行测试重置：库名必须以 "${TEST_SUFFIX}" 结尾。`,
    );
  }
}

export function readTestDatabaseUrl(): string {
  const value = process.env['TEST_DATABASE_URL'];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      '缺少 TEST_DATABASE_URL，数据库测试无法运行（需指向库名以 _test 结尾的库）。',
    );
  }

  assertTestDatabase(value);
  return value;
}

function migrationsDirOf(options: ResetTestDatabaseOptions): string {
  return options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
}

/** 清空 public schema 后重跑迁移，得到与全新环境一致的库。 */
export async function resetTestDatabase(
  pool: Pool,
  options: ResetTestDatabaseOptions = {},
): Promise<void> {
  await pool.query('drop schema if exists public cascade');
  await pool.query('create schema public');
  await migrate({ pool, migrationsDir: migrationsDirOf(options) });
}

/** 连接 → 重置 → 执行 → 关闭。 */
export async function withTestDatabase<T>(
  work: (pool: Pool) => Promise<T>,
  options: WithTestDatabaseOptions = {},
): Promise<T> {
  const pool = createPool({
    connectionString: readTestDatabaseUrl(),
    max: options.max ?? 4,
  });

  try {
    await resetTestDatabase(pool, options);
    return await work(pool);
  } finally {
    await pool.end();
  }
}

/**
 * 为单个测试文件创建独立 schema 并隔离 `search_path`，
 * 让多个测试文件可并行访问同一个测试库而互不影响。
 */
export async function withIsolatedSchema<T>(
  schema: string,
  work: (pool: Pool) => Promise<T>,
): Promise<T> {
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new Error(`非法 schema 名：${schema}`);
  }

  const connectionString = readTestDatabaseUrl();
  const bootstrap = new Pool({ connectionString, max: 1 });
  try {
    await bootstrap.query(`drop schema if exists "${schema}" cascade`);
    await bootstrap.query(`create schema "${schema}"`);
  } finally {
    await bootstrap.end();
  }

  const pool = new Pool({
    connectionString,
    max: 4,
    options: `-c search_path=${schema}`,
  });

  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}
