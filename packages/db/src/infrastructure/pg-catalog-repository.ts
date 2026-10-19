/**
 * `CatalogRepository` 的 PostgreSQL 实现。
 * 读路径一次 join 取回全部覆盖；写路径单事务完成，null 落到 SQL NULL。
 */
import { isLocale } from '@itools/contracts';
import type {
  CatalogOverride,
  CatalogOverrideInput,
  CatalogRepository,
  LocalizationOverride,
} from '@itools/contracts';
import type { Pool, PoolClient, QueryResultRow } from 'pg';

export interface PgCatalogRepositoryOptions {
  readonly pool: Pool;
}

interface LocalizationRow extends QueryResultRow {
  readonly description: string | null;
  readonly locale: string | null;
  readonly name: string | null;
  readonly summary: string | null;
  readonly tool_id: string;
}

interface OverrideRow extends LocalizationRow {
  readonly availability_override: string | null;
  readonly display_order: number | null;
}

interface ToolOverrideDraft {
  readonly availabilityOverride: string | null;
  readonly displayOrder: number | null;
  readonly localizations: LocalizationOverride[];
}

const SELECT_COLUMNS = `t.tool_id,
  t.display_order,
  t.availability_override,
  l.locale,
  l.name,
  l.summary,
  l.description`;

const LIST_OVERRIDES_SQL = `select ${SELECT_COLUMNS}
  from tools t
  left join tool_localizations l on l.tool_id = t.tool_id
  order by t.tool_id asc, l.locale asc`;

const GET_OVERRIDE_SQL = `select ${SELECT_COLUMNS}
  from tools t
  left join tool_localizations l on l.tool_id = t.tool_id
  where t.tool_id = $1
  order by l.locale asc`;

const LIST_LOCALIZATIONS_SQL = `select tool_id, locale, name, summary, description
  from tool_localizations
  where tool_id = $1
  order by locale asc`;

const UPSERT_TOOL_SQL = `insert into tools (tool_id, display_order, availability_override, created_at, updated_at)
  values ($1, $2, $3, now(), now())
  on conflict (tool_id) do update
  set display_order = excluded.display_order,
      availability_override = excluded.availability_override,
      updated_at = now()`;

const UPSERT_LOCALIZATION_SQL = `insert into tool_localizations (tool_id, locale, name, summary, description, updated_at)
  values ($1, $2, $3, $4, $5, now())
  on conflict (tool_id, locale) do update
  set name = excluded.name,
      summary = excluded.summary,
      description = excluded.description,
      updated_at = now()`;

function toLocalization(
  row: LocalizationRow,
): LocalizationOverride | undefined {
  if (row.locale === null || !isLocale(row.locale)) {
    return undefined;
  }

  return {
    locale: row.locale,
    ...(row.name === null ? {} : { name: row.name }),
    ...(row.summary === null ? {} : { summary: row.summary }),
    ...(row.description === null ? {} : { description: row.description }),
  };
}

function toOverride(toolId: string, draft: ToolOverrideDraft): CatalogOverride {
  return {
    toolId,
    ...(draft.displayOrder === null
      ? {}
      : { displayOrder: draft.displayOrder }),
    ...(draft.availabilityOverride === 'disabled'
      ? { availabilityOverride: 'disabled' as const }
      : {}),
    localizations: draft.localizations,
  };
}

function groupRows(rows: readonly OverrideRow[]): CatalogOverride[] {
  const byTool = new Map<string, ToolOverrideDraft>();

  for (const row of rows) {
    let draft = byTool.get(row.tool_id);
    if (draft === undefined) {
      draft = {
        availabilityOverride: row.availability_override,
        displayOrder: row.display_order,
        localizations: [],
      };
      byTool.set(row.tool_id, draft);
    }

    const localization = toLocalization(row);
    if (localization !== undefined) {
      draft.localizations.push(localization);
    }
  }

  return [...byTool.entries()].map(([toolId, draft]) =>
    toOverride(toolId, draft),
  );
}

function optionalText(value: string | undefined): string | null {
  return value === undefined ? null : value;
}

async function writeLocalizations(
  client: PoolClient,
  toolId: string,
  localizations: readonly LocalizationOverride[],
): Promise<void> {
  for (const localization of localizations) {
    await client.query(UPSERT_LOCALIZATION_SQL, [
      toolId,
      localization.locale,
      optionalText(localization.name),
      optionalText(localization.summary),
      optionalText(localization.description),
    ]);
  }
}

export function createPgCatalogRepository(
  options: PgCatalogRepositoryOptions,
): CatalogRepository {
  const { pool } = options;

  return {
    async listOverrides(): Promise<readonly CatalogOverride[]> {
      const result = await pool.query<OverrideRow>(LIST_OVERRIDES_SQL);
      return groupRows(result.rows);
    },

    async getOverride(toolId: string): Promise<CatalogOverride | undefined> {
      const result = await pool.query<OverrideRow>(GET_OVERRIDE_SQL, [toolId]);
      return groupRows(result.rows)[0];
    },

    async listLocalizations(
      toolId: string,
    ): Promise<readonly LocalizationOverride[]> {
      const result = await pool.query<LocalizationRow>(LIST_LOCALIZATIONS_SQL, [
        toolId,
      ]);

      return result.rows
        .map(toLocalization)
        .filter((item): item is LocalizationOverride => item !== undefined);
    },

    async upsertOverride(input: CatalogOverrideInput): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(UPSERT_TOOL_SQL, [
          input.toolId,
          input.displayOrder,
          input.availabilityOverride,
        ]);
        await writeLocalizations(client, input.toolId, input.localizations);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
