/**
 * 管理后台 API 客户端（阶段 8）：同源 Cookie 会话 + 双提交 CSRF。
 * 只暴露冻结契约中的方法：不缓存响应，也不把凭据写入任何存储。
 */
import { isLocale, type AdminVersion } from '@itools/contracts';

import {
  ADMIN_CSRF_COOKIE_NAME,
  ADMIN_CSRF_HEADER_NAME,
  AdminApiError,
  type AdminApiClient,
  type AdminApiClientOptions,
  type AdminAvailabilityOverride,
  type AdminAvailabilityResult,
  type AdminMetadataPatch,
  type AdminMetadataResult,
  type AdminRollbackInput,
  type AdminRollbackResult,
  type AdminSessionInfo,
  type AdminSetupStatus,
} from './admin-types.js';

const ADMIN_BASE_PATH = '/api/v1/admin';
const SETUP_PATH = '/setup';
const SESSION_PATH = '/session';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type JsonRecord = Readonly<Record<string, unknown>>;
type Guard<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isSetupStatus(value: unknown): value is AdminSetupStatus {
  return isRecord(value) && typeof value['available'] === 'boolean';
}

function isSessionInfo(value: unknown): value is AdminSessionInfo {
  return (
    isRecord(value) &&
    isNonEmptyString(value['expiresAt']) &&
    isNonEmptyString(value['lastSeenAt'])
  );
}

function isMetadataResult(value: unknown): value is AdminMetadataResult {
  if (!isRecord(value)) {
    return false;
  }
  const locales = value['updatedLocales'];
  return (
    isNonEmptyString(value['toolId']) &&
    Array.isArray(locales) &&
    locales.every((locale) => typeof locale === 'string') &&
    isInteger(value['order'])
  );
}

function isAvailabilityResult(
  value: unknown,
): value is AdminAvailabilityResult {
  return (
    isRecord(value) &&
    isNonEmptyString(value['toolId']) &&
    isNonEmptyString(value['availability'])
  );
}

function isAdminVersion(value: unknown): value is AdminVersion {
  if (!isRecord(value)) {
    return false;
  }
  const locale = value['locale'];
  return (
    isInteger(value['versionId']) &&
    isNonEmptyString(value['toolId']) &&
    typeof locale === 'string' &&
    isLocale(locale) &&
    isNonEmptyString(value['name']) &&
    isNonEmptyString(value['summary']) &&
    isNonEmptyString(value['description']) &&
    isNonEmptyString(value['createdAt'])
  );
}

function isAdminVersionList(value: unknown): value is readonly AdminVersion[] {
  return Array.isArray(value) && value.every(isAdminVersion);
}

function isRollbackResult(value: unknown): value is AdminRollbackResult {
  if (!isRecord(value)) {
    return false;
  }
  const locale = value['locale'];
  return (
    isInteger(value['versionId']) &&
    isNonEmptyString(value['toolId']) &&
    typeof locale === 'string' &&
    isLocale(locale)
  );
}

function isAdminErrorEnvelope(
  value: unknown,
): value is { code: string; message: string; requestId: string } {
  return (
    isRecord(value) &&
    isNonEmptyString(value['code']) &&
    isNonEmptyString(value['message']) &&
    isNonEmptyString(value['requestId'])
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function resolveFetch(fetchImpl: typeof fetch | undefined): typeof fetch {
  if (fetchImpl !== undefined) {
    return fetchImpl;
  }
  return (input, init) => globalThis.fetch(input, init);
}

/** 缺省从 `document.cookie` 读取；只取原值，不做 URL 解码。 */
function readDocumentCookie(name: string): string | undefined {
  const source = typeof document === 'undefined' ? '' : document.cookie;
  if (source.length === 0) {
    return undefined;
  }
  for (const segment of source.split(';')) {
    const trimmed = segment.trim();
    const separator = trimmed.indexOf('=');
    const key = (
      separator === -1 ? trimmed : trimmed.slice(0, separator)
    ).trim();
    if (key !== name) {
      continue;
    }
    const value = separator === -1 ? '' : trimmed.slice(separator + 1).trim();
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AdminApiError('INVALID_RESPONSE', response.status);
  }
}

function readData<T>(body: unknown, status: number, guard: Guard<T>): T {
  if (!isRecord(body)) {
    throw new AdminApiError('INVALID_RESPONSE', status);
  }
  const data = body['data'];
  if (!guard(data)) {
    throw new AdminApiError('INVALID_RESPONSE', status);
  }
  return data;
}

function throwForErrorBody(body: unknown, status: number): never {
  if (isAdminErrorEnvelope(body)) {
    throw new AdminApiError(body.code, status, body.requestId);
  }
  throw new AdminApiError('INVALID_RESPONSE', status);
}

export function createAdminApiClient(
  options: AdminApiClientOptions = {},
): AdminApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? '');
  const fetchImpl = resolveFetch(options.fetchImpl);
  const readCookie = options.readCookie ?? readDocumentCookie;

  function buildHeaders(
    method: HttpMethod,
    hasBody: boolean,
  ): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (method !== 'GET') {
      // 服务端要求所有非 GET 请求都带双提交令牌；Cookie 缺失时发空值，
      // 由服务端统一返回 ADMIN_CSRF_FAILED，客户端不自行编造错误码。
      headers[ADMIN_CSRF_HEADER_NAME] =
        readCookie(ADMIN_CSRF_COOKIE_NAME) ?? '';
    }
    if (hasBody) {
      headers['content-type'] = 'application/json';
    }
    return headers;
  }

  async function send(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const init: RequestInit = {
      method,
      credentials: 'same-origin',
      headers: buildHeaders(method, body !== undefined),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    try {
      return await fetchImpl(`${baseUrl}${ADMIN_BASE_PATH}${path}`, init);
    } catch {
      throw new AdminApiError('NETWORK_ERROR', 0);
    }
  }

  async function requestData<T>(
    method: HttpMethod,
    path: string,
    guard: Guard<T>,
    body?: unknown,
  ): Promise<T> {
    const response = await send(method, path, body);
    if (!response.ok) {
      throwForErrorBody(await readJson(response), response.status);
    }
    return readData(await readJson(response), response.status, guard);
  }

  function toolPath(toolId: string, suffix: string): string {
    return `/tools/${encodeURIComponent(toolId)}${suffix}`;
  }

  return {
    getSetupStatus: () => requestData('GET', SETUP_PATH, isSetupStatus),
    setup: (input) =>
      requestData('POST', SETUP_PATH, isSessionInfo, {
        token: input.token,
        password: input.password,
      }),
    login: (password) =>
      requestData('POST', SESSION_PATH, isSessionInfo, { password }),
    logout: async () => {
      const response = await send('DELETE', SESSION_PATH);
      // 204 无正文：成功路径绝不能调用 `response.json()`。
      if (!response.ok) {
        throwForErrorBody(await readJson(response), response.status);
      }
    },
    getSession: () => requestData('GET', SESSION_PATH, isSessionInfo),
    updateMetadata: (toolId, patch: AdminMetadataPatch) =>
      requestData(
        'PATCH',
        toolPath(toolId, '/metadata'),
        isMetadataResult,
        patch,
      ),
    setAvailability: (toolId, override: AdminAvailabilityOverride) =>
      requestData(
        'PATCH',
        toolPath(toolId, '/availability'),
        isAvailabilityResult,
        { override },
      ),
    listVersions: (toolId) =>
      requestData('GET', toolPath(toolId, '/versions'), isAdminVersionList),
    rollback: (toolId, input: AdminRollbackInput) =>
      requestData('POST', toolPath(toolId, '/rollback'), isRollbackResult, {
        versionId: input.versionId,
        expectedVersionId: input.expectedVersionId,
      }),
  };
}
