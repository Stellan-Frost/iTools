import type { DatabaseHealth } from '@itools/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createFixedWindowLimiter } from '../admin/auth/rate-limit.js';
import type { ApiOptions } from './options.js';
import {
  ErrorResponseSchema,
  HealthSchema,
  ToolItemResponseSchema,
  ToolListResponseSchema,
} from './schemas.js';

const TOOLS_CACHE_CONTROL = 'public, max-age=60';
const NO_STORE_CACHE_CONTROL = 'no-store';
const CATALOG_UNAVAILABLE_CODE = 'CATALOG_UNAVAILABLE';
const CATALOG_UNAVAILABLE_MESSAGE = 'Tool catalog is currently unavailable.';
const TOOL_NOT_FOUND_CODE = 'TOOL_NOT_FOUND';
const TOOL_NOT_FOUND_MESSAGE = 'Tool not found.';
const RATE_LIMITED_CODE = 'RATE_LIMITED';
const RATE_LIMITED_MESSAGE = 'Too many requests.';

/** 公开只读 API 的固定速率限制：每 IP 每分钟 120 次。 */
const PUBLIC_RATE_LIMIT = { maxAttempts: 120, windowMs: 60_000 } as const;

export function registerApi(app: FastifyInstance, options: ApiOptions): void {
  const { catalog, probeDatabase } = options;
  const limiter = createFixedWindowLimiter({
    maxAttempts: PUBLIC_RATE_LIMIT.maxAttempts,
    windowMs: PUBLIC_RATE_LIMIT.windowMs,
    now: () => new Date(),
  });

  /** 返回 true 表示已写出 429，路由应直接 return。 */
  const isRateLimited = (
    request: { ip: string; id: string },
    reply: FastifyReply,
  ): boolean => {
    const decision = limiter.consume(request.ip);
    if (decision.allowed) return false;
    reply
      .code(429)
      .header('cache-control', NO_STORE_CACHE_CONTROL)
      .header('retry-after', String(decision.retryAfterSeconds))
      .send({
        code: RATE_LIMITED_CODE,
        message: RATE_LIMITED_MESSAGE,
        requestId: request.id,
      });
    return true;
  };

  app.get(
    '/api/v1/tools',
    {
      preHandler: async (request, reply) => {
        isRateLimited(request, reply);
      },
      schema: {
        response: {
          200: ToolListResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (catalog === undefined) {
        return sendCatalogUnavailable(reply, request.id);
      }

      try {
        const items = await catalog.listItems();
        return reply
          .header('cache-control', TOOLS_CACHE_CONTROL)
          .send({ data: items });
      } catch {
        return sendCatalogUnavailable(reply, request.id);
      }
    },
  );

  app.get<{ Params: { toolId: string } }>(
    '/api/v1/tools/:toolId',
    {
      preHandler: async (request, reply) => {
        isRateLimited(request, reply);
      },
      schema: {
        response: {
          200: ToolItemResponseSchema,
          404: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { toolId } = request.params;

      if (catalog === undefined) {
        return sendCatalogUnavailable(reply, request.id);
      }

      try {
        const item = await catalog.getItem(toolId);
        if (item === undefined) {
          return sendError(
            reply,
            404,
            TOOL_NOT_FOUND_CODE,
            TOOL_NOT_FOUND_MESSAGE,
            request.id,
          );
        }

        return reply.header('cache-control', NO_STORE_CACHE_CONTROL).send({
          data: item,
        });
      } catch {
        return sendCatalogUnavailable(reply, request.id);
      }
    },
  );

  app.get(
    '/api/v1/health/live',
    {
      preHandler: async (request, reply) => {
        isRateLimited(request, reply);
      },
      schema: { response: { 200: HealthSchema } },
    },
    async (_request, reply) =>
      reply.header('cache-control', NO_STORE_CACHE_CONTROL).send({
        status: 'ok',
        checks: { database: 'skipped' },
      }),
  );

  app.get(
    '/api/v1/health/ready',
    {
      preHandler: async (request, reply) => {
        isRateLimited(request, reply);
      },
      schema: { response: { 200: HealthSchema, 503: HealthSchema } },
    },
    async (_request, reply) => {
      const database = await probeHealth(probeDatabase);
      const degraded = database === 'unavailable';

      return reply
        .code(degraded ? 503 : 200)
        .header('cache-control', NO_STORE_CACHE_CONTROL)
        .send({
          status: degraded ? 'degraded' : 'ok',
          checks: { database },
        });
    },
  );
}

/** 探测函数缺失视为跳过；探测抛错视为不可用，不向上泄露异常细节。 */
async function probeHealth(
  probe: ApiOptions['probeDatabase'],
): Promise<DatabaseHealth> {
  if (probe === undefined) {
    return 'skipped';
  }

  try {
    return await probe();
  } catch {
    return 'unavailable';
  }
}

function sendCatalogUnavailable(
  reply: FastifyReply,
  requestId: string,
): FastifyReply {
  return sendError(
    reply,
    503,
    CATALOG_UNAVAILABLE_CODE,
    CATALOG_UNAVAILABLE_MESSAGE,
    requestId,
  );
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
): FastifyReply {
  return reply
    .code(statusCode)
    .header('cache-control', NO_STORE_CACHE_CONTROL)
    .send({
      code,
      message,
      requestId,
    });
}
