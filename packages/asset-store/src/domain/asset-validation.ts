/**
 * 资产草稿的纯校验：只报告问题，不做修剪，也不写入任何状态。
 * 逐字段收集全部命中项，让界面能一次性展示全部错误，而不是逐个试错。
 */
import type {
  AssetDraft,
  AssetValidationCode,
  AssetValidationField,
  AssetValidationIssue,
} from './asset-types.js';
import { MAX_ASSET_NAME_LENGTH, MAX_MIME_TYPE_LENGTH } from './asset-types.js';

/** 控件字符会让文件名在主流文件系统上不可用或不可见。 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }

  return false;
}

/** MIME 只接受 `type/subtype` 形状，避免把任意字符串塞进 Content-Type。 */
const MIME_SHAPE = /^[-\w.]+\/[-\w.+]+$/;

const KNOWN_ROLES: readonly string[] = ['source', 'intermediate', 'result'];

function issue(
  field: AssetValidationField,
  code: AssetValidationCode,
): AssetValidationIssue {
  return { field, code };
}

function checkName(name: string): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    issues.push(issue('name', 'empty'));
  }
  // 长度限制针对原始值：修剪后变短的名字写进存储后仍可能超限。
  if (name.length > MAX_ASSET_NAME_LENGTH) {
    issues.push(issue('name', 'too-long'));
  }
  if (name.includes('/') || name.includes('\\')) {
    issues.push(issue('name', 'path-separator'));
  }
  if (hasControlCharacter(name)) {
    issues.push(issue('name', 'control-character'));
  }

  return issues;
}

function checkMimeType(mimeType: string): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];
  const trimmed = mimeType.trim();

  if (trimmed.length === 0) {
    issues.push(issue('mimeType', 'empty'));
  }
  if (mimeType.length > MAX_MIME_TYPE_LENGTH) {
    issues.push(issue('mimeType', 'too-long'));
  }
  // 空值已经由 empty 说明，再报 invalid-mime 只是噪音。
  if (trimmed.length > 0 && !MIME_SHAPE.test(mimeType)) {
    issues.push(issue('mimeType', 'invalid-mime'));
  }

  return issues;
}

function checkSize(sizeBytes: number): AssetValidationIssue[] {
  // NaN、Infinity 与小数都无法映射到字节长度，统一按非整数处理。
  if (!Number.isInteger(sizeBytes)) {
    return [issue('sizeBytes', 'not-integer')];
  }
  if (sizeBytes < 0) {
    return [issue('sizeBytes', 'negative-size')];
  }

  return [];
}

/** 角色在类型层是封闭联合，运行时仍可能来自反序列化数据，需要兜底。 */
function checkRole(role: string): AssetValidationIssue[] {
  return KNOWN_ROLES.includes(role) ? [] : [issue('role', 'unknown-role')];
}

export function validateAssetDraft(
  draft: AssetDraft,
): readonly AssetValidationIssue[] {
  const role: string = draft.role as string;

  return [
    ...checkName(draft.name),
    ...checkMimeType(draft.mimeType),
    ...checkSize(draft.sizeBytes),
    ...checkRole(role),
  ];
}

function summarize(issues: readonly AssetValidationIssue[]): string {
  return issues.map((entry) => `${entry.field}:${entry.code}`).join(', ');
}

export class AssetValidationError extends Error {
  readonly code = 'invalid-asset-draft' as const;
  readonly issues: readonly AssetValidationIssue[];

  constructor(issues: readonly AssetValidationIssue[]) {
    super(`资产草稿不合法：${summarize(issues)}`);
    this.name = 'AssetValidationError';
    this.issues = issues;
  }
}

export function assertValidAssetDraft(draft: AssetDraft): void {
  const issues = validateAssetDraft(draft);

  if (issues.length > 0) {
    throw new AssetValidationError(issues);
  }
}
