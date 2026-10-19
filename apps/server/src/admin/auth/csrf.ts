/**
 * CSRF 双提交令牌：随机值同时放在非 HttpOnly Cookie 与请求头里，
 * 服务端只比对两者是否一致（常量时间）。
 */
import { randomBytes } from 'node:crypto';
import { timingSafeEqualString } from './tokens.js';

const CSRF_BYTES = 16;

export function createCsrfToken(): string {
  return randomBytes(CSRF_BYTES).toString('base64url');
}

export function isValidCsrf(
  headerValue: string | undefined,
  cookieValue: string | undefined,
): boolean {
  if (
    headerValue === undefined ||
    cookieValue === undefined ||
    headerValue.length === 0 ||
    cookieValue.length === 0
  ) {
    return false;
  }

  return timingSafeEqualString(headerValue, cookieValue);
}
