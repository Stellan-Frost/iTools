import {
  ApiErrorSchema,
  HealthResponseSchema,
  ToolCatalogItemSchema,
  apiSuccessSchema,
} from '@itools/contracts';

/**
 * 列表响应：`{ data: ToolCatalogItem[] }`。
 * 数组包装是纯 JSON Schema——`typebox` 不是 apps/server 的直接依赖，
 * 条目本身仍复用 contracts 里的 TypeBox 定义。
 */
export const ToolListResponseSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: { type: 'array', items: ToolCatalogItemSchema },
  },
  additionalProperties: false,
} as const;

export const ToolItemResponseSchema = apiSuccessSchema(ToolCatalogItemSchema);

export const ErrorResponseSchema = ApiErrorSchema;

export const HealthSchema = HealthResponseSchema;

/** OpenAPI 文档自身没有稳定结构，只约束顶层标识字段。 */
export const OpenApiDocumentSchema = {
  type: 'object',
  required: ['openapi'],
  properties: { openapi: { type: 'string', minLength: 1 } },
  additionalProperties: true,
} as const;
