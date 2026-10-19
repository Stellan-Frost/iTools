import { TOOL_CONTRACT_VERSION } from '@itools/contracts';
import type { Locale, LocalizedText, RegistryEntry } from '@itools/contracts';

import { isCategoryId } from '../catalog/index.js';
import type { SampleTask } from '../catalog/index.js';

export type RegistryIssueCode =
  | 'duplicate-id'
  | 'duplicate-route-key'
  | 'invalid-category'
  | 'missing-translation'
  | 'preview-with-definition'
  | 'implemented-without-definition'
  | 'implemented-without-namespace'
  | 'invalid-contract-version'
  | 'sample-task-missing-tool'
  | 'sample-task-disabled-tool';

export interface RegistryIssue {
  code: RegistryIssueCode;
  toolId?: string;
  detail: string;
}

const LOCALES: readonly Locale[] = ['zh-CN', 'en'];
const CHINESE_PATTERN = /[\u3400-\u9fff]/;

/**
 * 注册表可能由外部工具包以纯 JS 注入，运行时按字段读取以覆盖非法形状，
 * 不依赖 TypeScript 联合类型保证。
 */
function readField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function localizedFields(
  entry: RegistryEntry,
): readonly (readonly [string, LocalizedText])[] {
  return [
    ['name', entry.metadata.name],
    ['summary', entry.metadata.summary],
    ['description', entry.metadata.description],
    ['preview.inputLabel', entry.metadata.preview.inputLabel],
    ['preview.sampleInput', entry.metadata.preview.sampleInput],
    ['preview.workspaceTitle', entry.metadata.preview.workspaceTitle],
  ];
}

function validateMetadata(entry: RegistryEntry, issues: RegistryIssue[]): void {
  const toolId = entry.metadata.id;

  if (!isCategoryId(entry.metadata.category)) {
    issues.push({
      code: 'invalid-category',
      toolId,
      detail: `分类 ${String(entry.metadata.category)} 不在 CATEGORY_IDS 中`,
    });
  }

  for (const [field, text] of localizedFields(entry)) {
    for (const locale of LOCALES) {
      if (text[locale].trim().length === 0) {
        issues.push({
          code: 'missing-translation',
          toolId,
          detail: `${field} 缺少 ${locale} 文案`,
        });
      }
    }

    if (CHINESE_PATTERN.test(text.en)) {
      issues.push({
        code: 'missing-translation',
        toolId,
        detail: `${field} 的英文包含 CJK 字符`,
      });
    }
  }
}

function validateDefinition(
  entry: RegistryEntry,
  issues: RegistryIssue[],
): string | undefined {
  const toolId = entry.metadata.id;
  const definition = readField(entry, 'definition');

  if (definition === undefined) {
    issues.push({
      code: 'implemented-without-definition',
      toolId,
      detail: '可用性为 implemented 的条目缺少 definition',
    });
    return undefined;
  }

  const manifest = readField(definition, 'manifest');
  const contractVersion = readField(manifest, 'contractVersion');

  if (contractVersion !== TOOL_CONTRACT_VERSION) {
    issues.push({
      code: 'invalid-contract-version',
      toolId,
      detail: `contractVersion 为 ${String(contractVersion)}，期望 ${TOOL_CONTRACT_VERSION}`,
    });
  }

  const namespace = readField(manifest, 'translationNamespace');
  const resources = readField(entry, 'resources');
  const hasNamespace = LOCALES.every((locale) => {
    if (typeof namespace !== 'string' || namespace.length === 0) {
      return false;
    }

    return readField(readField(resources, locale), namespace) !== undefined;
  });

  if (!hasNamespace) {
    issues.push({
      code: 'implemented-without-namespace',
      toolId,
      detail: `translationNamespace ${String(namespace)} 未在 zh-CN 与 en 资源中同时提供`,
    });
  }

  const routeKey = readField(manifest, 'routeKey');
  return typeof routeKey === 'string' && routeKey.length > 0
    ? routeKey
    : undefined;
}

/**
 * 对任意条目数组与样本任务做结构校验；不读取默认注册表。
 */
export function validateToolRegistry(
  entries: readonly RegistryEntry[],
  sampleTasks: readonly SampleTask[],
): readonly RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const seenIds = new Set<string>();
  const routeKeys = new Map<string, string>();

  for (const entry of entries) {
    const toolId = entry.metadata.id;

    if (seenIds.has(toolId)) {
      issues.push({
        code: 'duplicate-id',
        toolId,
        detail: `工具 id ${toolId} 重复`,
      });
    }
    seenIds.add(toolId);

    validateMetadata(entry, issues);

    const hasDefinition = Object.hasOwn(entry, 'definition');

    if (entry.availability === 'implemented') {
      const declaredRouteKey = validateDefinition(entry, issues);
      const routeKey = declaredRouteKey ?? toolId;

      if (declaredRouteKey !== undefined && declaredRouteKey !== toolId) {
        issues.push({
          code: 'duplicate-route-key',
          toolId,
          detail: `routeKey ${declaredRouteKey} 与 metadata.id ${toolId} 不一致`,
        });
      }

      const existing = routeKeys.get(routeKey);
      if (existing !== undefined) {
        issues.push({
          code: 'duplicate-route-key',
          toolId,
          detail: `routeKey ${routeKey} 已被 ${existing} 使用`,
        });
      } else {
        routeKeys.set(routeKey, toolId);
      }
      continue;
    }

    if (hasDefinition) {
      issues.push({
        code: 'preview-with-definition',
        toolId,
        detail: `可用性为 ${entry.availability} 的条目不得携带 definition`,
      });
    }

    const existing = routeKeys.get(toolId);
    if (existing !== undefined) {
      issues.push({
        code: 'duplicate-route-key',
        toolId,
        detail: `routeKey ${toolId} 已被 ${existing} 使用`,
      });
    } else {
      routeKeys.set(toolId, toolId);
    }
  }

  const entriesById = new Map<string, RegistryEntry>(
    entries.map((entry): [string, RegistryEntry] => [entry.metadata.id, entry]),
  );

  for (const task of sampleTasks) {
    const referenced = entriesById.get(task.toolId);

    if (referenced === undefined) {
      issues.push({
        code: 'sample-task-missing-tool',
        toolId: task.toolId,
        detail: `样本任务 ${task.id} 引用了不存在的工具 ${task.toolId}`,
      });
      continue;
    }

    if (referenced.availability === 'disabled') {
      issues.push({
        code: 'sample-task-disabled-tool',
        toolId: task.toolId,
        detail: `样本任务 ${task.id} 引用了已停用工具 ${task.toolId}`,
      });
    }
  }

  return Object.freeze(issues);
}
