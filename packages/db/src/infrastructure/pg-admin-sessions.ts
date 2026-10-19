/**
 * `AdminSessionRepository` 的 PostgreSQL 实现。
 * 时间一律以 ISO 字符串进出，SQL 侧显式 `::timestamptz`，避免本地时区参与解释。
 */
import type {
  AdminSessionRecord,
  AdminSessionRepository,
  CreateAdminSessionInput,
} from '@itools/contracts';
import type { Pool, QueryResultRow } from 'pg';

export interface PgAdminSessionRepositoryOptions {
  readonly pool: Pool;
}

interface SessionRow extends QueryResultRow {
  readonly created_at: Date;
  readonly expires_at: Date;
  readonly last_seen_at: Date;
  readonly revoked_at: Date | null;
  readonly session_id: string;
  readonly token_hash: string;
}

const SESSION_COLUMNS = `session_id, token_hash, created_at, last_seen_at, expires_at, revoked_at`;

const INSERT_SESSION_SQL = `insert into admin_sessions (session_id, token_hash, created_at, last_seen_at, expires_at)
  values ($1, $2, $3::timestamptz, $3::timestamptz, $4::timestamptz)`;

const FIND_BY_TOKEN_HASH_SQL = `select ${SESSION_COLUMNS}
  from admin_sessions
  where token_hash = $1`;

/** 只有未撤销的会话才续期。 */
const TOUCH_SESSION_SQL = `update admin_sessions
  set last_seen_at = $2::timestamptz,
      expires_at = $3::timestamptz
  where session_id = $1 and revoked_at is null`;

/** coalesce 保留首次撤销时间，重复撤销是幂等的。 */
const REVOKE_SESSION_SQL = `update admin_sessions
  set revoked_at = coalesce(revoked_at, $2::timestamptz)
  where session_id = $1`;

const REVOKE_ALL_SQL = `update admin_sessions
  set revoked_at = $1::timestamptz
  where revoked_at is null`;

const DELETE_EXPIRED_SQL = `delete from admin_sessions
  where expires_at <= $1::timestamptz`;

function toRecord(row: SessionRow): AdminSessionRecord {
  return {
    sessionId: row.session_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    ...(row.revoked_at === null
      ? {}
      : { revokedAt: row.revoked_at.toISOString() }),
  };
}

export function createPgAdminSessionRepository(
  options: PgAdminSessionRepositoryOptions,
): AdminSessionRepository {
  const { pool } = options;

  return {
    async create(input: CreateAdminSessionInput): Promise<void> {
      await pool.query(INSERT_SESSION_SQL, [
        input.sessionId,
        input.tokenHash,
        input.createdAt,
        input.expiresAt,
      ]);
    },

    async findByTokenHash(
      tokenHash: string,
    ): Promise<AdminSessionRecord | undefined> {
      const result = await pool.query<SessionRow>(FIND_BY_TOKEN_HASH_SQL, [
        tokenHash,
      ]);
      const row = result.rows[0];
      return row === undefined ? undefined : toRecord(row);
    },

    async touch(
      sessionId: string,
      lastSeenAt: string,
      expiresAt: string,
    ): Promise<void> {
      await pool.query(TOUCH_SESSION_SQL, [sessionId, lastSeenAt, expiresAt]);
    },

    async revoke(sessionId: string, revokedAt: string): Promise<void> {
      await pool.query(REVOKE_SESSION_SQL, [sessionId, revokedAt]);
    },

    async revokeAll(revokedAt: string): Promise<number> {
      const result = await pool.query(REVOKE_ALL_SQL, [revokedAt]);
      return result.rowCount ?? 0;
    },

    async deleteExpired(now: string): Promise<number> {
      const result = await pool.query(DELETE_EXPIRED_SQL, [now]);
      return result.rowCount ?? 0;
    },
  };
}
