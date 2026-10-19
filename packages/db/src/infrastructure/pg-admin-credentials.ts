/**
 * `AdminCredentialRepository` 的 PostgreSQL 实现。
 * 单行表：id 恒为 1，由 `admin_credentials_single_row` 约束兜底。
 */
import type {
  AdminCredentialRecord,
  AdminCredentialRepository,
} from '@itools/contracts';
import type { Pool, QueryResultRow } from 'pg';

export interface PgAdminCredentialRepositoryOptions {
  readonly pool: Pool;
}

interface CredentialRow extends QueryResultRow {
  readonly created_at: Date;
  readonly password_hash: string;
  readonly updated_at: Date;
}

const SELECT_CREDENTIAL_SQL = `select password_hash, created_at, updated_at
  from admin_credentials
  where id = 1`;

/** on conflict do nothing：并发初始化时只有第一个事务能插入成功。 */
const INSERT_CREDENTIAL_SQL = `insert into admin_credentials (id, password_hash)
  values (1, $1)
  on conflict (id) do nothing`;

const UPDATE_PASSWORD_HASH_SQL = `update admin_credentials
  set password_hash = $1,
      updated_at = now()
  where id = 1`;

function toRecord(row: CredentialRow): AdminCredentialRecord {
  return {
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function createPgAdminCredentialRepository(
  options: PgAdminCredentialRepositoryOptions,
): AdminCredentialRepository {
  const { pool } = options;

  return {
    async get(): Promise<AdminCredentialRecord | undefined> {
      const result = await pool.query<CredentialRow>(SELECT_CREDENTIAL_SQL);
      const row = result.rows[0];
      return row === undefined ? undefined : toRecord(row);
    },

    async create(passwordHash: string): Promise<boolean> {
      const result = await pool.query(INSERT_CREDENTIAL_SQL, [passwordHash]);
      return result.rowCount === 1;
    },

    async updatePasswordHash(passwordHash: string): Promise<void> {
      const result = await pool.query(UPDATE_PASSWORD_HASH_SQL, [passwordHash]);
      if (result.rowCount !== 1) {
        throw new Error('管理员凭据尚未初始化，无法更新口令哈希。');
      }
    },
  };
}
