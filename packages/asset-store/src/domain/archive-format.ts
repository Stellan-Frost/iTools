/**
 * 本地归档格式：纯编解码与校验，不做任何 I/O，也不访问网络。
 * base64 手写实现，避免浏览器 `btoa` 与 node `Buffer` 的行为差异。
 */
import {
  ASSET_ARCHIVE_FORMAT_VERSION,
  AssetArchiveSchema,
  type AssetArchive,
  type AssetArchiveEntry,
  type AssetRecord,
  type AssetReference,
  type TaskRecord,
} from '@itools/contracts';
import Value from 'typebox/value';

import { findReferenceIssues } from './reference-integrity.js';

export type ArchiveIssueCode =
  | 'invalid-json'
  | 'invalid-shape'
  | 'unsupported-version'
  | 'dangling-reference'
  | 'role-mismatch'
  | 'duplicate-asset-id'
  | 'duplicate-task-id'
  | 'invalid-base64';

export interface ArchiveIssue {
  readonly code: ArchiveIssueCode;
  readonly targetId?: string;
}

export class ArchiveValidationError extends Error {
  readonly code = 'invalid-archive' as const;
  readonly issues: readonly ArchiveIssue[];

  constructor(issues: readonly ArchiveIssue[]) {
    super('归档校验失败');
    this.name = 'ArchiveValidationError';
    this.issues = issues;
  }
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_LOOKUP: ReadonlyMap<string, number> = new Map(
  [...BASE64_ALPHABET].map((char, index) => [char, index] as const),
);

/** 将字节编码为标准 base64（带 `=` 填充）。 */
export function encodeBytesToBase64(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += BASE64_ALPHABET.charAt((triplet >> 18) & 0x3f);
    encoded += BASE64_ALPHABET.charAt((triplet >> 12) & 0x3f);
    encoded +=
      second === undefined
        ? '='
        : BASE64_ALPHABET.charAt((triplet >> 6) & 0x3f);
    encoded +=
      third === undefined ? '=' : BASE64_ALPHABET.charAt(triplet & 0x3f);
  }
  return encoded;
}

/** 解码标准 base64；任何非法输入都抛出 `invalid-base64`。 */
export function decodeBase64ToBytes(value: string): Uint8Array {
  if (value.length === 0) return new Uint8Array(0);
  if (value.length % 4 !== 0) throw invalidBase64();

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const dataLength = value.length - padding;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let buffer = 0;
  let bits = 0;
  let byteIndex = 0;

  for (let index = 0; index < dataLength; index += 1) {
    const digit = BASE64_LOOKUP.get(value.charAt(index));
    if (digit === undefined) throw invalidBase64();
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = (buffer >> bits) & 0xff;
      byteIndex += 1;
    }
  }
  return bytes;
}

export async function buildArchive(input: {
  readonly assets: readonly {
    readonly record: AssetRecord;
    readonly blob: Blob;
    readonly references: readonly AssetReference[];
  }[];
  readonly tasks: readonly TaskRecord[];
  readonly createdAt: string;
  readonly includeSourceData: boolean;
}): Promise<AssetArchive> {
  const entries: AssetArchiveEntry[] = [];
  for (const asset of input.assets) {
    const references = [...asset.references];
    if (!input.includeSourceData) {
      entries.push({ record: asset.record, references });
      continue;
    }
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    entries.push({
      record: asset.record,
      references,
      dataBase64: encodeBytesToBase64(bytes),
    });
  }

  return {
    formatVersion: ASSET_ARCHIVE_FORMAT_VERSION,
    createdAt: input.createdAt,
    assets: entries,
    tasks: [...input.tasks],
  };
}

/** 解析并校验归档结构、版本与 ID 唯一性。 */
export function parseArchive(json: string): AssetArchive {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ArchiveValidationError([{ code: 'invalid-json' }]);
  }

  if (!Value.Check(AssetArchiveSchema, parsed)) {
    throw new ArchiveValidationError([{ code: 'invalid-shape' }]);
  }

  const archive = parsed as AssetArchive;
  const issues: ArchiveIssue[] = [];
  if (archive.formatVersion !== ASSET_ARCHIVE_FORMAT_VERSION) {
    issues.push({ code: 'unsupported-version' });
  }

  const seenAssetIds = new Set<string>();
  for (const entry of archive.assets) {
    const { assetId } = entry.record;
    if (seenAssetIds.has(assetId)) {
      issues.push({ code: 'duplicate-asset-id', targetId: assetId });
    } else {
      seenAssetIds.add(assetId);
    }
  }

  const seenTaskIds = new Set<string>();
  for (const task of archive.tasks) {
    if (seenTaskIds.has(task.taskId)) {
      issues.push({ code: 'duplicate-task-id', targetId: task.taskId });
    } else {
      seenTaskIds.add(task.taskId);
    }
  }

  if (issues.length > 0) throw new ArchiveValidationError(issues);
  return archive;
}

/** 复用领域引用完整性规则，返回归档内部的一致性问题。 */
export function validateArchiveContent(
  archive: AssetArchive,
): readonly ArchiveIssue[] {
  const issues = findReferenceIssues({
    assets: archive.assets.map((entry) => ({
      assetId: entry.record.assetId,
      role: entry.record.role,
    })),
    references: archive.assets.flatMap((entry) =>
      entry.references.map((reference) => ({
        assetId: reference.assetId,
        role: reference.role,
        taskId: reference.taskId,
      })),
    ),
  });

  const result: ArchiveIssue[] = [];
  for (const issue of issues) {
    if (issue.code === 'dangling-reference' || issue.code === 'role-mismatch') {
      result.push({ code: issue.code, targetId: issue.assetId });
    }
  }
  return result;
}

function invalidBase64(): ArchiveValidationError {
  return new ArchiveValidationError([{ code: 'invalid-base64' }]);
}
