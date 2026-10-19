import type { DatabaseHealth } from '@itools/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
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

export function registerApi(app: FastifyInstance, options: ApiOptions): void {
  const { catalog, probeDatabase } = options;

  app.get(
    '/api/v1/tools',
    {
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
    { schema: { response: { 200: HealthSchema } } },
    async (_request, reply) =>
      reply.header('cache-control', NO_STORE_CACHE_CONTROL).send({
        status: 'ok',
        checks: { database: 'skipped' },
      }),
  );

  app.get(
    '/api/v1/health/ready',
    { schema: { response: { 200: HealthSchema, 503: HealthSchema } } },
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
