import type { AdminSessionInfo } from '../../api/admin-types.js';
import type { Locale } from '@itools/contracts';

export type AdminPhase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'setup' }
  | { readonly kind: 'login'; readonly notice: 'expired' | 'none' }
  | { readonly kind: 'ready'; readonly session: AdminSessionInfo }
  | { readonly kind: 'error' };

export interface ApiFailure {
  readonly code: string;
  readonly status: number;
}

/** 网络层可能抛出类实例或结构化对象，这里只读稳定字段。 */
export function readFailure(error: unknown): ApiFailure | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidate = error as {
    readonly code?: unknown;
    readonly status?: unknown;
  };
  if (
    typeof candidate.code !== 'string' ||
    typeof candidate.status !== 'number'
  ) {
    return undefined;
  }
  return { code: candidate.code, status: candidate.status };
}

export function isUnauthorized(error: unknown): boolean {
  return readFailure(error)?.status === 401;
}

export function isVersionConflict(error: unknown): boolean {
  return readFailure(error)?.code === 'ADMIN_VERSION_CONFLICT';
}

export function isRateLimited(error: unknown): boolean {
  const failure = readFailure(error);
  return failure?.status === 429 || failure?.code === 'ADMIN_RATE_LIMITED';
}

/** 会话过期时间按界面语言本地化；无法解析时退回原始值。 */
export function formatDateTime(value: string, locale: Locale): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}
