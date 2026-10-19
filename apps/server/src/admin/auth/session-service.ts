/**
 * 会话服务：签发、解析（含滑动续期）与撤销。
 * 明文令牌只出现在返回值里；仓储只见 sha256 哈希。
 */
import type {
  AdminSessionRecord,
  AdminSessionRepository,
} from '@itools/contracts';

import { ADMIN_SESSION_ABSOLUTE_MS, ADMIN_SESSION_IDLE_MS } from '../types.js';
import { hashToken } from './tokens.js';

export interface SessionServiceOptions {
  readonly sessions: AdminSessionRepository;
  readonly now: () => Date;
  readonly createSessionId: () => string;
  readonly createToken: () => string;
}

export interface IssuedSession {
  readonly token: string;
  readonly sessionId: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
}

export interface ResolvedSession {
  readonly session: AdminSessionRecord;
  readonly expiresAt: string;
}

export interface SessionService {
  issue(): Promise<IssuedSession>;
  resolve(token: string): Promise<ResolvedSession | undefined>;
  revoke(token: string): Promise<void>;
}

export function createSessionService(
  options: SessionServiceOptions,
): SessionService {
  const { sessions, now } = options;

  async function issue(): Promise<IssuedSession> {
    const issuedAt = now();
    const issuedAtMs = issuedAt.getTime();
    const expiresAt = new Date(
      Math.min(
        issuedAtMs + ADMIN_SESSION_IDLE_MS,
        issuedAtMs + ADMIN_SESSION_ABSOLUTE_MS,
      ),
    ).toISOString();
    const createdAt = issuedAt.toISOString();
    const token = options.createToken();
    const sessionId = options.createSessionId();

    await sessions.create({
      sessionId,
      tokenHash: hashToken(token),
      createdAt,
      expiresAt,
    });

    return { token, sessionId, expiresAt, lastSeenAt: createdAt };
  }

  async function resolve(token: string): Promise<ResolvedSession | undefined> {
    const session = await sessions.findByTokenHash(hashToken(token));
    if (session === undefined || session.revokedAt !== undefined) {
      return undefined;
    }

    const seenAt = now();
    const seenAtMs = seenAt.getTime();
    if (Date.parse(session.expiresAt) <= seenAtMs) {
      return undefined;
    }

    // 绝对上限来自创建时间，滑动续期不得突破它。
    const expiresAt = new Date(
      Math.min(
        seenAtMs + ADMIN_SESSION_IDLE_MS,
        Date.parse(session.createdAt) + ADMIN_SESSION_ABSOLUTE_MS,
      ),
    ).toISOString();
    const lastSeenAt = seenAt.toISOString();

    await sessions.touch(session.sessionId, lastSeenAt, expiresAt);

    return {
      session: { ...session, lastSeenAt, expiresAt },
      expiresAt,
    };
  }

  async function revoke(token: string): Promise<void> {
    const session = await sessions.findByTokenHash(hashToken(token));
    if (session === undefined || session.revokedAt !== undefined) {
      return;
    }

    await sessions.revoke(session.sessionId, now().toISOString());
  }

  return { issue, resolve, revoke };
}
