import {
  TOOL_AVAILABILITIES,
  type ApiError,
  type HealthResponse,
  type ToolCatalogItem,
} from '@itools/contracts';

export interface ApiClientOptions {
  /** 例如 ''（同源）或 'https://api.example.com'；末尾斜杠要归一化。 */
  readonly baseUrl: string;
  /** 缺省 globalThis.fetch；测试注入替身。 */
  readonly fetchImpl?: typeof fetch;
}

/**
 * 前端 API 失败统一形态：
 * - `code`：服务端错误码；无法解析服务端信封时为 `INVALID_RESPONSE`。
 * - `status`：HTTP 状态码；请求根本没有到达服务端时为 0。
 * - `requestId`：服务端错误信封透传的请求 ID，用于日志关联。
 */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(code: string, status: number, requestId?: string) {
    super(`API request failed: ${code}`);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    if (requestId !== undefined) {
      this.requestId = requestId;
    }
  }
}

export interface ToolApiClient {
  listTools(): Promise<readonly ToolCatalogItem[]>;
  getTool(toolId: string): Promise<ToolCatalogItem>;
  healthReady(): Promise<HealthResponse>;
}

const TOOL_CATEGORIES: ReadonlySet<string> = new Set([
  'audio',
  'image',
  'video',
  'text',
  'other',
]);
const TOOL_AVAILABILITY_SET: ReadonlySet<string> = new Set(TOOL_AVAILABILITIES);
const DATABASE_HEALTH_SET: ReadonlySet<string> = new Set([
  'ok',
  'unavailable',
  'skipped',
]);

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isLocalizedText(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value['zh-CN']) && isNonEmptyString(value.en);
}

function isToolCatalogItem(value: unknown): value is ToolCatalogItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    typeof value.category === 'string' &&
    TOOL_CATEGORIES.has(value.category) &&
    typeof value.availability === 'string' &&
    TOOL_AVAILABILITY_SET.has(value.availability) &&
    isLocalizedText(value.name) &&
    isLocalizedText(value.summary) &&
    isLocalizedText(value.description) &&
    typeof value.order === 'number' &&
    Number.isInteger(value.order) &&
    (value.source === 'registry' || value.source === 'override')
  );
}

function isToolCatalogList(
  value: unknown,
): value is readonly ToolCatalogItem[] {
  return Array.isArray(value) && value.every(isToolCatalogItem);
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!isRecord(value)) {
    return false;
  }
  if (value.status !== 'ok' && value.status !== 'degraded') {
    return false;
  }
  const checks = value.checks;
  if (!isRecord(checks)) {
    return false;
  }
  return (
    typeof checks.database === 'string' &&
    DATABASE_HEALTH_SET.has(checks.database)
  );
}

function isApiErrorEnvelope(value: unknown): value is ApiError {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message) &&
    isNonEmptyString(value.requestId)
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

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ApiClientError('INVALID_RESPONSE', response.status);
  }
}

function readData<T>(
  body: unknown,
  status: number,
  guard: (value: unknown) => value is T,
): T {
  if (!isRecord(body)) {
    throw new ApiClientError('INVALID_RESPONSE', status);
  }
  const data = body.data;
  if (!guard(data)) {
    throw new ApiClientError('INVALID_RESPONSE', status);
  }
  return data;
}

function throwForErrorBody(body: unknown, status: number): never {
  if (isApiErrorEnvelope(body)) {
    throw new ApiClientError(body.code, status, body.requestId);
  }
  throw new ApiClientError('INVALID_RESPONSE', status);
}

export function createToolApiClient(options: ApiClientOptions): ToolApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = resolveFetch(options.fetchImpl);

  async function send(path: string): Promise<{
    readonly response: Response;
    readonly body: unknown;
  }> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        headers: { accept: 'application/json' },
      });
    } catch {
      throw new ApiClientError('NETWORK_ERROR', 0);
    }
    const body = await readJsonBody(response);
    return { response, body };
  }

  async function requestData<T>(
    path: string,
    guard: (value: unknown) => value is T,
  ): Promise<T> {
    const { response, body } = await send(path);
    if (!response.ok) {
      throwForErrorBody(body, response.status);
    }
    return readData(body, response.status, guard);
  }

  return {
    listTools: () => requestData('/api/v1/tools', isToolCatalogList),
    getTool: (toolId) =>
      requestData(
        `/api/v1/tools/${encodeURIComponent(toolId)}`,
        isToolCatalogItem,
      ),
    healthReady: async () => {
      const { response, body } = await send('/api/v1/health/ready');
      // 503 表示依赖降级，响应体本身仍是合法健康报告，交由调用方展示。
      if (!response.ok && response.status !== 503) {
        throwForErrorBody(body, response.status);
      }
      return readData(body, response.status, isHealthResponse);
    },
  };
}
