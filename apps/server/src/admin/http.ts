/**
 * 管理 API 的统一错误输出：固定文案、no-store、带 requestId，不泄露内部信息。
 * 冻结文件：认证与写接口共用同一实现，避免两套错误格式。
 */
import { AdminErrorCode } from '@itools/contracts';
import type { AdminErrorCodeValue } from '@itools/contracts';
import type { FastifyReply } from 'fastify';

const DEFAULT_STATUS: Readonly<Record<AdminErrorCodeValue, number>> = {
  [AdminErrorCode.alreadyInitialized]: 409,
  [AdminErrorCode.notInitialized]: 404,
  [AdminErrorCode.notAuthenticated]: 401,
  [AdminErrorCode.invalidCredentials]: 401,
  [AdminErrorCode.invalidRequest]: 400,
  [AdminErrorCode.toolNotFound]: 404,
  [AdminErrorCode.versionNotFound]: 404,
  [AdminErrorCode.csrfFailed]: 403,
  [AdminErrorCode.rateLimited]: 429,
  [AdminErrorCode.versionConflict]: 409,
  [AdminErrorCode.unavailable]: 503,
};

const DEFAULT_MESSAGE: Readonly<Record<AdminErrorCodeValue, string>> = {
  [AdminErrorCode.alreadyInitialized]: 'Admin is already initialized.',
  [AdminErrorCode.notInitialized]: 'Admin is not initialized.',
  [AdminErrorCode.notAuthenticated]: 'Authentication required.',
  [AdminErrorCode.invalidCredentials]: 'Invalid credentials.',
  [AdminErrorCode.invalidRequest]: 'Request payload is invalid.',
  [AdminErrorCode.toolNotFound]: 'Tool not found.',
  [AdminErrorCode.versionNotFound]: 'Version not found.',
  [AdminErrorCode.csrfFailed]: 'CSRF validation failed.',
  [AdminErrorCode.rateLimited]: 'Too many attempts. Try again later.',
  [AdminErrorCode.versionConflict]: 'Metadata was changed by a newer edit.',
  [AdminErrorCode.unavailable]: 'Admin API is currently unavailable.',
};

export function sendAdminError(
  reply: FastifyReply,
  requestId: string,
  code: AdminErrorCodeValue,
  status?: number,
): FastifyReply {
  return reply
    .code(status ?? DEFAULT_STATUS[code])
    .header('cache-control', 'no-store')
    .send({ code, message: DEFAULT_MESSAGE[code], requestId });
}
