/**
 * 资产领域的基础类型与限制，冻结文件：由根 Agent 维护，实施 Agent 不得修改。
 * 只放形状与常量，不放算法，避免领域层依赖具体存储。
 */
import type { AssetRole } from '@itools/contracts';

/** 单个资产文件名的最大长度（含扩展名）。 */
export const MAX_ASSET_NAME_LENGTH = 255;

/** MIME 提示的最大长度；过长的“伪 MIME”直接拒绝。 */
export const MAX_MIME_TYPE_LENGTH = 128;

/** 源文件默认保留 7 天；用户可在存储管理中调整。 */
export const DEFAULT_SOURCE_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

/** 待写入的资产描述（尚未落库）。 */
export interface AssetDraft {
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly role: AssetRole;
}

export type AssetValidationField = 'name' | 'mimeType' | 'sizeBytes' | 'role';

export type AssetValidationCode =
  | 'empty'
  | 'too-long'
  | 'control-character'
  | 'path-separator'
  | 'invalid-mime'
  | 'negative-size'
  | 'not-integer'
  | 'unknown-role';

export interface AssetValidationIssue {
  readonly field: AssetValidationField;
  readonly code: AssetValidationCode;
}

export interface ReferenceIntegrityInput {
  readonly assets: readonly {
    readonly assetId: string;
    readonly role: AssetRole;
  }[];
  readonly references: readonly {
    readonly assetId: string;
    readonly role: AssetRole;
    readonly taskId: string;
  }[];
}

export type ReferenceIssueCode =
  'dangling-reference' | 'role-mismatch' | 'empty-task-id';

export interface ReferenceIssue {
  readonly assetId: string;
  readonly code: ReferenceIssueCode;
}

export interface RetentionInput {
  readonly assets: readonly {
    readonly assetId: string;
    readonly role: AssetRole;
    readonly createdAt: string;
    readonly taskId?: string;
  }[];
  readonly references: readonly { readonly assetId: string }[];
  readonly now: Date;
  readonly retentionMs: number;
  readonly activeTaskIds: readonly string[];
}

export type CleanupSkipReason = 'referenced' | 'active-task' | 'not-source';

export interface CleanupSkip {
  readonly assetId: string;
  readonly reason: CleanupSkipReason;
}

export interface CleanupPlan {
  /** 应当保留的资产 ID。 */
  readonly keep: readonly string[];
  /** 可以安全删除的源文件 ID。 */
  readonly remove: readonly string[];
  /** 被跳过并说明原因的资产 ID。 */
  readonly skipped: readonly CleanupSkip[];
}
