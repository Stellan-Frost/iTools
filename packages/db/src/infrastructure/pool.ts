import { Pool } from 'pg';

export interface PoolOptions {
  readonly connectionString: string;
  readonly max?: number;
}

const DEFAULT_MAX = 10;
const CONNECTION_TIMEOUT_MS = 5000;
const IDLE_TIMEOUT_MS = 10000;
const STATEMENT_TIMEOUT_MS = 10000;
const APPLICATION_NAME = 'itools';

/**
 * 创建带超时与空闲回收的连接池。
 * 错误事件必须消费，否则空闲连接断开会冒泡成未捕获异常。
 */
export function createPool(options: PoolOptions): Pool {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.max ?? DEFAULT_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    application_name: APPLICATION_NAME,
    options: `-c statement_timeout=${STATEMENT_TIMEOUT_MS}`,
  });

  pool.on('error', () => {
    // 空闲连接异常不需要中断进程；此处不打印任何连接细节，避免泄露凭据。
  });

  return pool;
}
