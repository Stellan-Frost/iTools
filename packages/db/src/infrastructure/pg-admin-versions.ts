/**
 * `AdminVersionRepository` 的 PostgreSQL 实现。
 * 展示字段存放在 `snapshot`（jsonb）里；读取时展开为契约要求的扁平记录。
 * 同一「工具 + 语言」只保留最近 `keep` 条，由单条 delete 完成。
 */
import { isLocale } from '@itools/contracts';
import type {
  AdminVersionRecord,
  AdminVersionRepository,
  AppendAdminVersionInput,
  Locale,
} from '@itools/contracts';
import type { Pool, QueryResultRow } from 'pg';

export interface PgAdminVersionRepositoryOptions {
  readonly pool: Pool;
}

interface VersionRow extends QueryResultRow {
  readonly created_at: Date;
  readonly description: string | null;
  readonly locale: string | null;
  readonly name: string | null;
  readonly summary: string | null;
  readonly tool_id: string;
  readonly version_id: string;
}

const VERSION_COLUMNS = `version_id,
  tool_id,
  locale,
  snapshot->>'name' as name,
  snapshot->>'summary' as summary,
  snapshot->>'description' as description,
  created_at`;

const INSERT_VERSION_SQL = `insert into tool_metadata_versions (tool_id, locale, snapshot, created_at, created_by)
  values ($1, $2, $3::jsonb, $4::timestamptz, $5)
  returning ${VERSION_COLUMNS}`;

const LIST_BY_TOOL_SQL = `select ${VERSION_COLUMNS}
  from tool_metadata_versions
  where tool_id = $1
  order by version_id desc`;

const FIND_BY_ID_SQL = `select ${VERSION_COLUMNS}
  from tool_metadata_versions
  where version_id = $1::bigint`;

const FIND_LATEST_SQL = `select ${VERSION_COLUMNS}
  from tool_metadata_versions
  where tool_id = $1 and locale = $2
  order by version_id desc
  limit 1`;

/** 子查询选出要保留的最新 keep 条，其余（更旧的）删除。 */
const TRIM_SQL = `delete from tool_metadata_versions
  where tool_id = $1
    and locale = $2
    and version_id not in (
      select version_id
        from tool_metadata_versions
       where tool_id = $1 and locale = $2
       order by version_id desc
       limit $3
    )`;

function toRecord(row: VersionRow): AdminVersionRecord | undefined {
  const { locale } = row;
  if (
    locale === null ||
    !isLocale(locale) ||
    row.name === null ||
    row.summary === null ||
    row.description === null
  ) {
    return undefined;
  }

  const versionId = Number(row.version_id);
  if (!Number.isSafeInteger(versionId)) {
    return undefined;
  }

  return {
    versionId,
    toolId: row.tool_id,
    locale,
    name: row.name,
    summary: row.summary,
    description: row.description,
    createdAt: row.created_at.toISOString(),
  };
}

function firstRecord(
  rows: readonly VersionRow[],
): AdminVersionRecord | undefined {
  const row = rows[0];
  return row === undefined ? undefined : toRecord(row);
}

export function createPgAdminVersionRepository(
  options: PgAdminVersionRepositoryOptions,
): AdminVersionRepository {
  const { pool } = options;

  return {
    async append(input: AppendAdminVersionInput): Promise<AdminVersionRecord> {
      const snapshot = JSON.stringify({
        name: input.name,
        summary: input.summary,
        description: input.description,
      });

      const result = await pool.query<VersionRow>(INSERT_VERSION_SQL, [
        input.toolId,
        input.locale,
        snapshot,
        input.createdAt,
        null,
      ]);

      const record = firstRecord(result.rows);
      if (record === undefined) {
        throw new Error('追加元数据版本失败：未能读回插入行。');
      }

      return record;
    },

    async listByTool(toolId: string): Promise<readonly AdminVersionRecord[]> {
      const result = await pool.query<VersionRow>(LIST_BY_TOOL_SQL, [toolId]);
      return result.rows
        .map(toRecord)
        .filter((item): item is AdminVersionRecord => item !== undefined);
    },

    async findById(versionId: number): Promise<AdminVersionRecord | undefined> {
      const result = await pool.query<VersionRow>(FIND_BY_ID_SQL, [versionId]);
      return firstRecord(result.rows);
    },

    async findLatest(
      toolId: string,
      locale: Locale,
    ): Promise<AdminVersionRecord | undefined> {
      const result = await pool.query<VersionRow>(FIND_LATEST_SQL, [
        toolId,
        locale,
      ]);
      return firstRecord(result.rows);
    },

    async trim(toolId: string, locale: Locale, keep: number): Promise<number> {
      if (!Number.isInteger(keep) || keep < 0) {
        throw new RangeError('keep 必须是非负整数。');
      }

      const result = await pool.query(TRIM_SQL, [toolId, locale, keep]);
      return result.rowCount ?? 0;
    },
  };
}
