import type { QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import { readTestDatabaseUrl } from '../test-support/test-database.js';
import { createPool } from './pool.js';

interface SettingsRow extends QueryResultRow {
  readonly app_name: string;
  readonly statement_timeout: string;
}

describe('createPool', () => {
  it('可以连接并执行 select 1', async () => {
    const pool = createPool({
      connectionString: readTestDatabaseUrl(),
      max: 2,
    });

    try {
      const result = await pool.query<SettingsRow>(
        `select current_setting('application_name') as app_name,
                current_setting('statement_timeout') as statement_timeout`,
      );

      expect(result.rows[0]).toEqual({
        app_name: 'itools',
        statement_timeout: '10s',
      });

      const one = await pool.query<QueryResultRow>('select 1 as value');
      expect(one.rows).toHaveLength(1);
    } finally {
      await pool.end();
    }
  });

  it('默认连接上限为 10，且应用名固定为 itools', async () => {
    const pool = createPool({ connectionString: readTestDatabaseUrl() });

    try {
      expect(pool.options.max).toBe(10);
      expect(pool.options.application_name).toBe('itools');
      expect(pool.options.connectionTimeoutMillis).toBe(5000);
      expect(pool.options.idleTimeoutMillis).toBe(10000);
    } finally {
      await pool.end();
    }
  });
});
