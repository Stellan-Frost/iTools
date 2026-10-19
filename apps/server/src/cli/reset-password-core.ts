/**
 * 管理员口令恢复核心逻辑（仅服务器侧 CLI 使用，不对外暴露 HTTP 入口）。
 * 顺序固定：校验输入 → 确认已初始化 → 更新哈希 → 撤销全部会话。
 * 本模块不接收、不打印任何口令或哈希，错误信息也不包含它们。
 */
import { ADMIN_PASSWORD_MIN_LENGTH } from '@itools/contracts';
import type {
  AdminCredentialRepository,
  AdminSessionRepository,
} from '@itools/contracts';

import { hashPassword } from '../admin/auth/password.js';

export interface ResetPasswordOptions {
  readonly credentials: AdminCredentialRepository;
  readonly sessions: AdminSessionRepository;
  readonly password: string;
  readonly now: () => Date;
}

export interface ResetPasswordResult {
  readonly revokedSessions: number;
  readonly updatedAt: string;
}

export type ResetPasswordErrorCode = 'admin-not-initialized' | 'weak-password';

const ERROR_MESSAGES: Record<ResetPasswordErrorCode, string> = {
  'admin-not-initialized': '管理员尚未初始化',
  'weak-password': `管理员口令至少需要 ${ADMIN_PASSWORD_MIN_LENGTH} 个字符`,
};

export class ResetPasswordError extends Error {
  readonly code: ResetPasswordErrorCode;

  constructor(code: ResetPasswordErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ResetPasswordError';
    this.code = code;
  }
}

/**
 * 重置唯一管理员的口令，并撤销全部旧会话。
 * 口令过短或未初始化时在写任何数据之前就失败。
 * 两次写入无法共享事务：口令先落库，会话撤销失败会抛错，调用方需重跑本命令。
 */
export async function resetPassword(
  options: ResetPasswordOptions,
): Promise<ResetPasswordResult> {
  const { credentials, sessions, password, now } = options;

  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new ResetPasswordError('weak-password');
  }

  const existing = await credentials.get();
  if (existing === undefined) {
    throw new ResetPasswordError('admin-not-initialized');
  }

  const passwordHash = await hashPassword(password);
  const updatedAt = now().toISOString();

  await credentials.updatePasswordHash(passwordHash);
  const revokedSessions = await sessions.revokeAll(updatedAt);

  return { revokedSessions, updatedAt };
}
