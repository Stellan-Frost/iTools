/**
 * pg 版 CatalogSeedWriter：只做「不存在则插入」，绝不覆盖已有行。
 * 语义由 seedCatalog 决定，这里只提供数据库机制（on conflict do nothing）。
 */
import type { Pool } from 'pg';

import type { CatalogSeedWriter } from '@itools/contracts';

export function createPgSeedWriter(pool: Pool): CatalogSeedWriter {
  return {
    async ensureTool(input): Promise<boolean> {
      const result = await pool.query(
        `insert into tools (tool_id, display_order)
         values ($1, $2)
         on conflict (tool_id) do nothing
         returning tool_id`,
        [input.toolId, input.displayOrder],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async ensureLocalization(input): Promise<boolean> {
      const result = await pool.query(
        `insert into tool_localizations (tool_id, locale, name, summary, description)
         values ($1, $2, $3, $4, $5)
         on conflict (tool_id, locale) do nothing
         returning tool_id`,
        [
          input.toolId,
          input.locale,
          input.name,
          input.summary,
          input.description,
        ],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
