import { Pool } from 'pg';
import type { Pool as PoolType } from 'pg';
import { describe, expect, it } from 'vitest';

import { readTestDatabaseUrl } from '../test-support/test-database.js';
import { createDatabaseProbe } from './probe.js';

describe('createDatabaseProbe', () => {
  it('连接正常时返回 ok', async () => {
    const pool = new Pool({ connectionString: readTestDatabaseUrl(), max: 1 });

    try {
      const probe = createDatabaseProbe({ pool });
      await expect(probe()).resolves.toBe('ok');
    } finally {
      await pool.end();
    }
  });

  it('连接池已关闭时返回 unavailable 且不抛错', async () => {
    const pool = new Pool({ connectionString: readTestDatabaseUrl(), max: 1 });
    await pool.end();

    const probe = createDatabaseProbe({ pool });
    await expect(probe()).resolves.toBe('unavailable');
  });

  it('查询挂起时由硬超时判定为 unavailable', async () => {
    const hanging = {
      query: () => new Promise<never>(() => undefined),
    } as unknown as PoolType;

    const probe = createDatabaseProbe({ pool: hanging, timeoutMs: 30 });
    const startedAt = Date.now();
    const health = await probe();
    const elapsed = Date.now() - startedAt;

    expect(health).toBe('unavailable');
    expect(elapsed).toBeLessThan(1000);
  });

  it('查询报错时返回 unavailable', async () => {
    const failing = {
      query: () => Promise.reject(new Error('boom')),
    } as unknown as PoolType;

    await expect(createDatabaseProbe({ pool: failing })()).resolves.toBe(
      'unavailable',
    );
  });
});
