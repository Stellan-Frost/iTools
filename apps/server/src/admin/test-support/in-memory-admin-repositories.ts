/**
 * 管理仓储的内存替身：供认证与写接口测试共用，语义与 pg 实现保持一致。
 * 冻结文件：由根 Agent 维护，实施 Agent 不得修改。
 */
import type {
  AdminCredentialRecord,
  AdminCredentialRepository,
  AdminSessionRecord,
  AdminSessionRepository,
  AdminVersionRecord,
  AdminVersionRepository,
  AppendAdminVersionInput,
  CreateAdminSessionInput,
} from '@itools/contracts';

export class InMemoryAdminCredentialRepository implements AdminCredentialRepository {
  private record: AdminCredentialRecord | undefined;

  async get(): Promise<AdminCredentialRecord | undefined> {
    return this.record;
  }

  async create(passwordHash: string): Promise<boolean> {
    if (this.record !== undefined) return false;
    const now = new Date().toISOString();
    this.record = { passwordHash, createdAt: now, updatedAt: now };
    return true;
  }

  async updatePasswordHash(passwordHash: string): Promise<void> {
    if (this.record === undefined) {
      throw new Error('管理员尚未初始化');
    }
    this.record = {
      ...this.record,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };
  }
}

export class InMemoryAdminSessionRepository implements AdminSessionRepository {
  readonly sessions = new Map<string, AdminSessionRecord>();

  async create(input: CreateAdminSessionInput): Promise<void> {
    this.sessions.set(input.sessionId, {
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      createdAt: input.createdAt,
      lastSeenAt: input.createdAt,
      expiresAt: input.expiresAt,
    });
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<AdminSessionRecord | undefined> {
    return [...this.sessions.values()].find(
      (session) => session.tokenHash === tokenHash,
    );
  }

  async touch(
    sessionId: string,
    lastSeenAt: string,
    expiresAt: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return;
    this.sessions.set(sessionId, { ...session, lastSeenAt, expiresAt });
  }

  async revoke(sessionId: string, revokedAt: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return;
    this.sessions.set(sessionId, { ...session, revokedAt });
  }

  async revokeAll(revokedAt: string): Promise<number> {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.revokedAt !== undefined) continue;
      this.sessions.set(id, { ...session, revokedAt });
      count += 1;
    }
    return count;
  }

  async deleteExpired(now: string): Promise<number> {
    let removed = 0;
    for (const [id, session] of [...this.sessions]) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

export class InMemoryAdminVersionRepository implements AdminVersionRepository {
  readonly versions: AdminVersionRecord[] = [];
  private sequence = 0;

  async append(input: AppendAdminVersionInput): Promise<AdminVersionRecord> {
    this.sequence += 1;
    const record: AdminVersionRecord = { versionId: this.sequence, ...input };
    this.versions.push(record);
    return record;
  }

  async listByTool(toolId: string): Promise<readonly AdminVersionRecord[]> {
    return this.versions
      .filter((version) => version.toolId === toolId)
      .sort((left, right) => right.versionId - left.versionId);
  }

  async findById(versionId: number): Promise<AdminVersionRecord | undefined> {
    return this.versions.find((version) => version.versionId === versionId);
  }

  async findLatest(
    toolId: string,
    locale: AdminVersionRecord['locale'],
  ): Promise<AdminVersionRecord | undefined> {
    const matching = this.versions.filter(
      (version) => version.toolId === toolId && version.locale === locale,
    );
    return matching[matching.length - 1];
  }

  async trim(
    toolId: string,
    locale: AdminVersionRecord['locale'],
    keep: number,
  ): Promise<number> {
    const matching = this.versions.filter(
      (version) => version.toolId === toolId && version.locale === locale,
    );
    const excess = matching.length - keep;
    if (excess <= 0) return 0;
    const doomed = new Set(
      matching
        .slice()
        .sort((left, right) => left.versionId - right.versionId)
        .slice(0, excess)
        .map((version) => version.versionId),
    );
    for (let index = this.versions.length - 1; index >= 0; index -= 1) {
      const version = this.versions[index];
      if (version !== undefined && doomed.has(version.versionId)) {
        this.versions.splice(index, 1);
      }
    }
    return doomed.size;
  }
}
