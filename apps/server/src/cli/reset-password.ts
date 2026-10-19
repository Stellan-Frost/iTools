/**
 * 管理员口令恢复命令（仅限服务器侧手工执行）。
 * 用法：DATABASE_URL=... node dist/cli/reset-password.js
 * 可选：ADMIN_NEW_PASSWORD=... 提供新口令；缺省时生成一次性随机口令并只打印一次。
 * 口令只写 stdout，不写日志文件，也不进入错误信息。
 */
import { randomBytes } from 'node:crypto';

import { ADMIN_PASSWORD_MIN_LENGTH } from '@itools/contracts';
import {
  createPgAdminCredentialRepository,
  createPgAdminSessionRepository,
  createPool,
} from '@itools/db';

import { ResetPasswordError, resetPassword } from './reset-password-core.js';

/** 24 字节随机数经 base64url 编码后为 32 个字符，远超最小长度。 */
const GENERATED_PASSWORD_BYTES = 24;

function writeOut(text: string): void {
  process.stdout.write(text);
}

function writeError(text: string): void {
  process.stderr.write(text);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === '') {
    writeError('缺少 DATABASE_URL，无法重置管理员口令。\n');
    process.exitCode = 1;
    return;
  }

  const provided = process.env.ADMIN_NEW_PASSWORD;
  const useGenerated = provided === undefined || provided === '';
  const password = useGenerated
    ? randomBytes(GENERATED_PASSWORD_BYTES).toString('base64url')
    : provided;

  const pool = createPool({ connectionString });
  try {
    const result = await resetPassword({
      credentials: createPgAdminCredentialRepository({ pool }),
      sessions: createPgAdminSessionRepository({ pool }),
      password,
      now: () => new Date(),
    });

    writeOut(
      `管理员口令已重置（${result.updatedAt}），已撤销 ${result.revokedSessions} 个会话。\n`,
    );

    if (useGenerated) {
      writeOut(`新口令：${password}\n`);
      writeOut('仅显示一次，请立即保存。\n');
    }
  } catch (error) {
    if (error instanceof ResetPasswordError && error.code === 'weak-password') {
      writeError(
        `新口令过短：至少需要 ${ADMIN_PASSWORD_MIN_LENGTH} 个字符。\n`,
      );
    } else if (
      error instanceof ResetPasswordError &&
      error.code === 'admin-not-initialized'
    ) {
      writeError('管理员尚未初始化，请先完成初始化流程。\n');
    } else {
      const message = error instanceof Error ? error.message : String(error);
      writeError(`重置失败：${message}\n`);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  // 兜底不转发错误详情，避免把连接串等环境信息带进终端或日志。
  writeError('重置失败：发生未预期错误。\n');
  process.exitCode = 1;
});
