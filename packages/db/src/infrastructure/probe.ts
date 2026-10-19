/**
 * 数据库健康探测：`select 1` 成功即 ok，异常或超过硬超时为 unavailable。
 * 探测本身永不抛错，避免健康检查把请求拖死。
 */
import type { DatabaseHealth } from '@itools/contracts';
import type { Pool } from 'pg';

export interface DatabaseProbeOptions {
  readonly pool: Pool;
  /** 硬超时毫秒数，默认 1000。 */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 1000;

export function createDatabaseProbe(
  options: DatabaseProbeOptions,
): () => Promise<DatabaseHealth> {
  const { pool } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function probe(): Promise<DatabaseHealth> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hardTimeout = new Promise<DatabaseHealth>((resolve) => {
      timer = setTimeout(() => resolve('unavailable'), timeoutMs);
    });

    const query = pool.query('select 1').then(
      () => 'ok' as const,
      () => 'unavailable' as const,
    );

    try {
      return await Promise.race([query, hardTimeout]);
    } catch {
      return 'unavailable';
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  };
}
