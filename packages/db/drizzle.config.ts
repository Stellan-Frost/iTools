import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env['DATABASE_URL'];

/**
 * Drizzle Kit 仅用于结构对照与生成草稿；实际执行由 src/cli/migrate.ts 完成。
 * 未配置 DATABASE_URL 时不写入 dbCredentials，保证 `db:generate` 可用。
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/tables.ts',
  out: './migrations',
  strict: true,
  verbose: true,
  ...(databaseUrl === undefined || databaseUrl.trim() === ''
    ? {}
    : { dbCredentials: { url: databaseUrl } }),
});
