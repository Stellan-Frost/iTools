/**
 * 管理后台写接口（阶段 8）：元数据编辑、上下架、版本列表与回滚。
 * 只通过 `AdminWriteDeps` 访问仓储；认证/CSRF 由 `deps.guard` 统一处理。
 * 所有响应都带 `cache-control: no-store`，错误信封固定为 `{code,message,requestId}`。
 */
import {
  ADMIN_VERSION_RETENTION,
  AdminAvailabilityPatchSchema,
  AdminErrorCode,
  AdminMetadataPatchSchema,
  AdminRollbackRequestSchema,
  AdminVersionSchema,
  LOCALES,
} from '@itools/contracts';
import type {
  AdminAvailabilityPatch,
  AdminLocalizedPatch,
  AdminMetadataPatch,
  AdminRollbackRequest,
  CatalogOverride,
  LocalizationOverride,
  Locale,
  ToolCatalogItem,
} from '@itools/contracts';
import type { FastifyReply } from 'fastify';
import { sendAdminError } from '../http.js';
import type { RegisterAdminWriteRoutes } from '../types.js';
import { evaluateRollbackGuard } from './rollback-guard.js';

const NO_STORE = 'no-store';

interface ToolParams {
  readonly toolId: string;
}

interface LocalizedText {
  readonly name: string;
  readonly summary: string;
  readonly description: string;
}

interface MutableLocalization {
  locale: Locale;
  name?: string;
  summary?: string;
  description?: string;
}

export const registerAdminWriteRoutes: RegisterAdminWriteRoutes = (
  app,
  deps,
) => {
  app.patch<{ Params: ToolParams; Body: AdminMetadataPatch }>(
    '/api/v1/admin/tools/:toolId/metadata',
    {
      attachValidation: true,
      preHandler: deps.guard,
      schema: { body: AdminMetadataPatchSchema },
    },
    async (request, reply) => {
      if (request.validationError !== undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.invalidRequest);
      }

      const { toolId } = request.params;
      const item = deps.readRegistryItem(toolId);
      if (item === undefined) {
        return sendToolNotFound(reply, request.id);
      }

      const patch = request.body;
      const current = await deps.catalog.getOverride(toolId);
      const localizations = mergeLocalizations(current, patch.localizations);
      const updatedLocales = collectUpdatedLocales(patch.localizations);
      const displayOrder =
        patch.order === undefined
          ? (current?.displayOrder ?? null)
          : patch.order;

      await deps.catalog.upsertOverride({
        toolId,
        displayOrder,
        availabilityOverride: current?.availabilityOverride ?? null,
        localizations,
      });

      const createdAt = deps.now().toISOString();
      for (const locale of updatedLocales) {
        const override = findLocalization(localizations, locale);
        const text = effectiveText(item, locale, override);
        await deps.versions.append({ toolId, locale, createdAt, ...text });
        await deps.versions.trim(toolId, locale, ADMIN_VERSION_RETENTION);
      }

      return reply.header('cache-control', NO_STORE).send({
        data: {
          toolId,
          updatedLocales,
          order: displayOrder ?? item.order,
        },
      });
    },
  );

  app.patch<{ Params: ToolParams; Body: AdminAvailabilityPatch }>(
    '/api/v1/admin/tools/:toolId/availability',
    {
      attachValidation: true,
      preHandler: deps.guard,
      schema: { body: AdminAvailabilityPatchSchema },
    },
    async (request, reply) => {
      if (request.validationError !== undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.invalidRequest);
      }

      const { toolId } = request.params;
      const item = deps.readRegistryItem(toolId);
      if (item === undefined) {
        return sendToolNotFound(reply, request.id);
      }

      const current = await deps.catalog.getOverride(toolId);
      const disabled = request.body.override === 'disabled';
      /** 启停只动 `availabilityOverride`，排序与文案原样保留。 */
      await deps.catalog.upsertOverride({
        toolId,
        displayOrder: current?.displayOrder ?? null,
        availabilityOverride: disabled ? 'disabled' : null,
        localizations: current?.localizations ?? [],
      });

      return reply.header('cache-control', NO_STORE).send({
        data: {
          toolId,
          availability: disabled ? 'disabled' : item.availability,
        },
      });
    },
  );

  app.get<{ Params: ToolParams }>(
    '/api/v1/admin/tools/:toolId/versions',
    {
      preHandler: deps.guard,
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['data'],
            additionalProperties: false,
            properties: {
              data: { type: 'array', items: AdminVersionSchema },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { toolId } = request.params;
      if (deps.readRegistryItem(toolId) === undefined) {
        return sendToolNotFound(reply, request.id);
      }

      const records = await deps.versions.listByTool(toolId);
      /**
       * 仓储记录的形状与 `AdminVersionSchema` 逐字段一致（版本 ID、工具、语言、
       * 三条文案、时间）；响应 schema 复用契约以保证出站形状不漂移。
       * 契约中的 `AdminVersion.locale` 由 `Type.Union(LOCALES.map(...))` 推断为
       * never，无法用于变量标注，故以 `AdminVersionRecord` 为准。
       */
      const versions = [...records].sort(
        (left, right) => right.versionId - left.versionId,
      );

      return reply.header('cache-control', NO_STORE).send({ data: versions });
    },
  );

  app.post<{ Params: ToolParams; Body: AdminRollbackRequest }>(
    '/api/v1/admin/tools/:toolId/rollback',
    {
      attachValidation: true,
      preHandler: deps.guard,
      schema: { body: AdminRollbackRequestSchema },
    },
    async (request, reply) => {
      if (request.validationError !== undefined) {
        return sendAdminError(reply, request.id, AdminErrorCode.invalidRequest);
      }

      const { toolId } = request.params;
      if (deps.readRegistryItem(toolId) === undefined) {
        return sendToolNotFound(reply, request.id);
      }

      const { versionId, expectedVersionId } = request.body;
      const target = await deps.versions.findById(versionId);
      if (target === undefined || target.toolId !== toolId) {
        return sendVersionNotFound(reply, request.id);
      }

      const latest = await deps.versions.findLatest(toolId, target.locale);
      if (
        evaluateRollbackGuard(latest?.versionId, expectedVersionId) ===
        'conflict'
      ) {
        return sendAdminError(
          reply,
          request.id,
          AdminErrorCode.versionConflict,
        );
      }

      const current = await deps.catalog.getOverride(toolId);
      const localizations = replaceLocaleText(
        current?.localizations ?? [],
        target.locale,
        target,
      );
      /** 回滚只影响目标语言：排序与其它语言保持现状。 */
      await deps.catalog.upsertOverride({
        toolId,
        displayOrder: current?.displayOrder ?? null,
        availabilityOverride: current?.availabilityOverride ?? null,
        localizations,
      });

      const appended = await deps.versions.append({
        toolId,
        locale: target.locale,
        name: target.name,
        summary: target.summary,
        description: target.description,
        createdAt: deps.now().toISOString(),
      });
      await deps.versions.trim(toolId, target.locale, ADMIN_VERSION_RETENTION);

      return reply.header('cache-control', NO_STORE).send({
        data: { versionId: appended.versionId, toolId, locale: target.locale },
      });
    },
  );
};

function sendToolNotFound(
  reply: FastifyReply,
  requestId: string,
): FastifyReply {
  return sendAdminError(reply, requestId, AdminErrorCode.toolNotFound);
}

function sendVersionNotFound(
  reply: FastifyReply,
  requestId: string,
): FastifyReply {
  return sendAdminError(reply, requestId, AdminErrorCode.versionNotFound);
}

/**
 * 逐字段合并：优先补丁值，其次已有覆盖，最后交给快照阶段回落注册表。
 * 从未被覆盖的字段不会因为合并而凭空出现。
 */
function mergeLocalizations(
  current: CatalogOverride | undefined,
  patch: AdminMetadataPatch['localizations'],
): LocalizationOverride[] {
  const merged: LocalizationOverride[] = [];
  for (const locale of LOCALES) {
    const entry = mergeLocalization(
      locale,
      findLocalization(current?.localizations ?? [], locale),
      patch[locale],
    );
    if (entry !== undefined) merged.push(entry);
  }
  return merged;
}

function mergeLocalization(
  locale: Locale,
  base: LocalizationOverride | undefined,
  delta: AdminLocalizedPatch | undefined,
): LocalizationOverride | undefined {
  if (base === undefined && delta === undefined) return undefined;

  const name = delta?.name ?? base?.name;
  const summary = delta?.summary ?? base?.summary;
  const description = delta?.description ?? base?.description;
  if (
    name === undefined &&
    summary === undefined &&
    description === undefined
  ) {
    return undefined;
  }

  const merged: MutableLocalization = { locale };
  if (name !== undefined) merged.name = name;
  if (summary !== undefined) merged.summary = summary;
  if (description !== undefined) merged.description = description;
  return merged;
}

/** 只把补丁里真正带了字段的语言视为「本次被修改」。 */
function collectUpdatedLocales(
  patch: AdminMetadataPatch['localizations'],
): Locale[] {
  return LOCALES.filter((locale) => {
    const delta = patch[locale];
    if (delta === undefined) return false;
    return (
      delta.name !== undefined ||
      delta.summary !== undefined ||
      delta.description !== undefined
    );
  });
}

function findLocalization(
  localizations: readonly LocalizationOverride[],
  locale: Locale,
): LocalizationOverride | undefined {
  return localizations.find((entry) => entry.locale === locale);
}

/** 生效文案：覆盖值优先，缺失字段回落注册表原值。 */
function effectiveText(
  item: ToolCatalogItem,
  locale: Locale,
  override: LocalizationOverride | undefined,
): LocalizedText {
  return {
    name: override?.name ?? item.name[locale],
    summary: override?.summary ?? item.summary[locale],
    description: override?.description ?? item.description[locale],
  };
}

/** 回滚写入：用目标版本文案整体替换该语言，其它语言与顺序不变。 */
function replaceLocaleText(
  localizations: readonly LocalizationOverride[],
  locale: Locale,
  text: LocalizedText,
): LocalizationOverride[] {
  const next: LocalizationOverride[] = [];
  for (const entry of localizations) {
    if (entry.locale !== locale) next.push(entry);
  }
  next.push({
    locale,
    name: text.name,
    summary: text.summary,
    description: text.description,
  });
  return next.sort(
    (left, right) =>
      LOCALES.indexOf(left.locale) - LOCALES.indexOf(right.locale),
  );
}
