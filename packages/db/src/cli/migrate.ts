/**
 * 迁移 CLI：`DATABASE_URL=... node dist/cli/migrate.js`。
 * 不打印连接串，缺配置时以非零码退出。
 */
import { fileURLToPath } from 'node:url';

import { createPool } from '../infrastructure/pool.js';
import { migrate } from '../migrate.js';

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

async function main(): Promise<number> {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString.trim() === '') {
    process.stderr.write(
      '未设置 DATABASE_URL，无法执行数据库迁移。请提供 PostgreSQL 连接串后重试。\n',
    );
    return 1;
  }

  const pool = createPool({ connectionString });
  try {
    const report = await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
    process.stdout.write(
      `迁移完成：应用 ${report.applied.length} 个，跳过 ${report.skipped.length} 个。\n`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    process.stderr.write(`迁移失败：${message}\n`);
    return 1;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();
