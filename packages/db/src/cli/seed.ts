/**
 * Seed CLI：把代码注册表同步进数据库（只新建，不覆盖管理员改动）。
 * 用法：DATABASE_URL=... node dist/cli/seed.js
 */
import { createPgSeedWriter } from '../infrastructure/pg-seed-writer.js';
import { createPool } from '../infrastructure/pool.js';
import { seedCatalog } from '../catalog/seed-catalog.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === '') {
    process.stderr.write('缺少 DATABASE_URL，无法执行 Seed。\n');
    process.exitCode = 1;
    return;
  }

  const pool = createPool({ connectionString });
  try {
    const report = await seedCatalog({ writer: createPgSeedWriter(pool) });
    process.stdout.write(
      `Seed 完成：新建工具 ${report.createdToolIds.length} 个，` +
        `新增文案 ${report.createdLocalizationKeys.length} 条，` +
        `已存在 ${report.existingToolIds.length} 个。\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Seed 失败：${message}\n`);
  process.exitCode = 1;
});
