import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_CSRF_COOKIE_NAME,
  ADMIN_CSRF_HEADER_NAME,
  AdminApiError,
  type AdminSessionInfo,
} from './admin-types.js';
import { createAdminApiClient } from './admin-client.js';

const CSRF_TOKEN = 'csrf-token-123';
const PASSWORD = 'correct horse battery';
const SESSION: AdminSessionInfo = {
  expiresAt: '2026-10-19T12:00:00.000Z',
  lastSeenAt: '2026-10-19T11:00:00.000Z',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createClient(fetchImpl: typeof fetch, baseUrl = '') {
  return createAdminApiClient({
    baseUrl,
    fetchImpl,
    readCookie: (name) =>
      name === ADMIN_CSRF_COOKIE_NAME ? CSRF_TOKEN : undefined,
  });
}

function headersOf(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers ?? {});
}

function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(String(init?.body)) as unknown;
}

async function captureError(
  run: () => Promise<unknown>,
): Promise<AdminApiError> {
  try {
    await run();
  } catch (cause) {
    if (cause instanceof AdminApiError) {
      return cause;
    }
    throw cause;
  }
  throw new Error('expected the request to fail');
}

describe('createAdminApiClient', () => {
  it('getSetupStatus 解析信封并归一化 baseUrl', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: { available: true } }));

    const client = createClient(fetchImpl, 'https://admin.example.com/');

    await expect(client.getSetupStatus()).resolves.toEqual({ available: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://admin.example.com/api/v1/admin/setup',
    );

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('same-origin');
    expect(headersOf(init).get(ADMIN_CSRF_HEADER_NAME)).toBeNull();
  });

  it('setup 发送 JSON 请求体与非 GET 的 CSRF 头', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: SESSION }, 201));

    const client = createClient(fetchImpl);

    await expect(
      client.setup({ token: 'setup-token', password: PASSWORD }),
    ).resolves.toEqual(SESSION);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/v1/admin/setup');
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');

    const headers = headersOf(init);
    expect(headers.get('x-csrf-token')).toBe(CSRF_TOKEN);
    expect(headers.get('content-type')).toBe('application/json');
    expect(bodyOf(init)).toEqual({ token: 'setup-token', password: PASSWORD });
  });

  it('login 401 映射为 ADMIN_INVALID_CREDENTIALS 并透传 requestId', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          code: 'ADMIN_INVALID_CREDENTIALS',
          message: 'Invalid credentials.',
          requestId: 'req-login-1',
        },
        401,
      ),
    );

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.login('wrong-password'));

    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({
      code: 'ADMIN_INVALID_CREDENTIALS',
      status: 401,
      requestId: 'req-login-1',
    });
    expect(bodyOf(fetchImpl.mock.calls[0]?.[1])).toEqual({
      password: 'wrong-password',
    });
  });

  it('429 映射为 ADMIN_RATE_LIMITED', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          code: 'ADMIN_RATE_LIMITED',
          message: 'Too many attempts. Try again later.',
          requestId: 'req-rate-1',
        },
        429,
      ),
    );

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.login(PASSWORD));

    expect(error).toMatchObject({
      code: 'ADMIN_RATE_LIMITED',
      status: 429,
      requestId: 'req-rate-1',
    });
  });

  it('logout 收到 204 直接返回，且 DELETE 也带 CSRF 头', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    const client = createClient(fetchImpl);

    await expect(client.logout()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/v1/admin/session');

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(init?.credentials).toBe('same-origin');

    const headers = headersOf(init);
    expect(headers.get('x-csrf-token')).toBe(CSRF_TOKEN);
    expect(headers.get('content-type')).toBeNull();
    expect(init?.body).toBeUndefined();
  });

  it('toolId 含空格与中文时按路径段编码', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: [] }));

    const client = createClient(fetchImpl);

    await expect(client.listVersions('音 频 工具')).resolves.toEqual([]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      '/api/v1/admin/tools/%E9%9F%B3%20%E9%A2%91%20%E5%B7%A5%E5%85%B7/versions',
    );
  });

  it('非 JSON 响应体映射为 INVALID_RESPONSE', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('<html>gateway error</html>', { status: 200 }),
      );

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.getSetupStatus());

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });

  it('网络异常映射为 NETWORK_ERROR 且 status 为 0', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.getSession());

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
    expect(error.requestId).toBeUndefined();
  });

  it('listVersions 解析空数组', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: [] }));

    const client = createClient(fetchImpl);

    await expect(client.listVersions('image-resize')).resolves.toEqual([]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      '/api/v1/admin/tools/image-resize/versions',
    );
    expect(
      headersOf(fetchImpl.mock.calls[0]?.[1]).get('x-csrf-token'),
    ).toBeNull();
  });

  it('updateMetadata 发送 PATCH 补丁并解析结果', async () => {
    const result = {
      toolId: 'image-resize',
      updatedLocales: ['zh-CN'],
      order: 3,
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: result }));

    const client = createClient(fetchImpl);

    await expect(
      client.updateMetadata('image-resize', {
        localizations: { 'zh-CN': { name: '图片缩放' } },
        order: 3,
      }),
    ).resolves.toEqual(result);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      '/api/v1/admin/tools/image-resize/metadata',
    );
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
    expect(headersOf(init).get('x-csrf-token')).toBe(CSRF_TOKEN);
    expect(bodyOf(init)).toEqual({
      localizations: { 'zh-CN': { name: '图片缩放' } },
      order: 3,
    });
  });

  it('rollback 解析回滚结果并只发送契约字段', async () => {
    const result = { versionId: 12, toolId: 'image-resize', locale: 'en' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: result }));

    const client = createClient(fetchImpl);

    await expect(
      client.rollback('image-resize', {
        versionId: 12,
        expectedVersionId: 15,
      }),
    ).resolves.toEqual(result);

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      '/api/v1/admin/tools/image-resize/rollback',
    );
    expect(bodyOf(init)).toEqual({ versionId: 12, expectedVersionId: 15 });
  });

  it('2xx 但 data 结构不符时映射为 INVALID_RESPONSE', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ data: { available: 'yes' } }));

    const client = createClient(fetchImpl);
    const error = await captureError(() => client.getSetupStatus());

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });
});
