import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { OpenApiDocumentSchema } from './schemas.js';

const OPENAPI_PATH = '/api/v1/openapi.json';
const NO_STORE_CACHE_CONTROL = 'no-store';

/**
 * 注册 OpenAPI 文档生成器，并把文档只暴露在 `/api/v1` 下。
 * v9 不再内置 `/documentation/json` 路由，这里显式提供唯一入口。
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'iTools API', version: '1.0.0' },
    },
  });

  app.get(
    OPENAPI_PATH,
    { schema: { response: { 200: OpenApiDocumentSchema } } },
    async (_request, reply) =>
      reply.header('cache-control', NO_STORE_CACHE_CONTROL).send(app.swagger()),
  );
}
