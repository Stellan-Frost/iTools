import { fileURLToPath } from 'node:url';

import { ADMIN_VERSION_RETENTION } from '@itools/contracts';
import type {
  AdminVersionRepository,
  AppendAdminVersionInput,
  Locale,
} from '@itools/contracts';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import { migrate } from '../migrate.js';
import { withIsolatedSchema } from '../test-support/test-database.js';
import { createPgAdminVersionRepository } from './pg-admin-versions.js';

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);
const SCHEMA = 'itools_admin_versions_test';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const TOOL_ID = 'alpha';

async function withRepository(
  work: (repo: AdminVersionRepository, pool: Pool) => Promise<void>,
): Promise<void> {
  await withIsolatedSchema(SCHEMA, async (pool) => {
    await migrate({ pool, migrationsDir: MIGRATIONS_DIR });
    await pool.query('insert into tools (tool_id) values ($1)', [TOOL_ID]);
    await work(createPgAdminVersionRepository({ pool }), pool);
  });
}

function inputOf(
  locale: Locale,
  index: number,
  toolId = TOOL_ID,
): AppendAdminVersionInput {
  return {
    toolId,
    locale,
    name: `${locale}-name-${index}`,
    summary: `${locale}-summary-${index}`,
    description: `${locale}-description-${index}`,
    createdAt: CREATED_AT,
  };
}

describe('createPgAdminVersionRepository', () => {
  it('append 返回递增 versionId 且可按 id 读回完整字段', async () => {
    await withRepository(async (repo) => {
      const first = await repo.append(inputOf('zh-CN', 1));
      const second = await repo.append(inputOf('zh-CN', 2));

      expect(second.versionId).toBeGreaterThan(first.versionId);
      expect(first).toEqual({
        versionId: first.versionId,
        toolId: TOOL_ID,
        locale: 'zh-CN',
        name: 'zh-CN-name-1',
        summary: 'zh-CN-summary-1',
        description: 'zh-CN-description-1',
        createdAt: CREATED_AT,
      });

      await expect(repo.findById(second.versionId)).resolves.toEqual(second);
      await expect(repo.findById(999_999)).resolves.toBeUndefined();
    });
  });

  it('listByTool 按 version_id 倒序返回全部语言', async () => {
    await withRepository(async (repo) => {
      const zh = await repo.append(inputOf('zh-CN', 1));
      const en = await repo.append(inputOf('en', 1));
      const zhLatest = await repo.append(inputOf('zh-CN', 2));

      const records = await repo.listByTool(TOOL_ID);
      expect(records.map((record) => record.versionId)).toEqual([
        zhLatest.versionId,
        en.versionId,
        zh.versionId,
      ]);
      expect(records.map((record) => record.locale)).toEqual([
        'zh-CN',
        'en',
        'zh-CN',
      ]);
    });
  });

  it('findLatest 按工具与语言取最新一条', async () => {
    await withRepository(async (repo) => {
      await repo.append(inputOf('zh-CN', 1));
      await repo.append(inputOf('en', 1));
      const zhLatest = await repo.append(inputOf('zh-CN', 2));

      const latest = await repo.findLatest(TOOL_ID, 'zh-CN');
      expect(latest).toEqual(zhLatest);

      const enLatest = await repo.findLatest(TOOL_ID, 'en');
      expect(enLatest?.name).toBe('en-name-1');

      await expect(repo.findLatest('missing-tool', 'zh-CN')).resolves.toBe(
        undefined,
      );
    });
  });

  it('trim 只保留最近 keep 条，且不误删另一语言', async () => {
    await withRepository(async (repo) => {
      const total = ADMIN_VERSION_RETENTION + 5;
      const zhIds: number[] = [];
      const enIds: number[] = [];

      for (let index = 1; index <= total; index += 1) {
        const zh = await repo.append(inputOf('zh-CN', index));
        zhIds.push(zh.versionId);
        const en = await repo.append(inputOf('en', index));
        enIds.push(en.versionId);
      }

      await expect(
        repo.trim(TOOL_ID, 'zh-CN', ADMIN_VERSION_RETENTION),
      ).resolves.toBe(total - ADMIN_VERSION_RETENTION);

      const records = await repo.listByTool(TOOL_ID);
      const remainingZh = records
        .filter((record) => record.locale === 'zh-CN')
        .map((record) => record.versionId);
      const remainingEn = records
        .filter((record) => record.locale === 'en')
        .map((record) => record.versionId);

      expect(remainingZh).toHaveLength(ADMIN_VERSION_RETENTION);
      expect(remainingZh).toEqual(
        zhIds.slice(-ADMIN_VERSION_RETENTION).reverse(),
      );
      expect(remainingEn).toEqual([...enIds].reverse());
    });
  });

  it('trim 在记录数不超过 keep 时不删除任何行', async () => {
    await withRepository(async (repo) => {
      await repo.append(inputOf('zh-CN', 1));
      await repo.append(inputOf('zh-CN', 2));

      await expect(repo.trim(TOOL_ID, 'zh-CN', 5)).resolves.toBe(0);
      await expect(repo.listByTool(TOOL_ID)).resolves.toHaveLength(2);
    });
  });
});
