import Type, { type Static } from 'typebox';

import { TaskRecordSchema } from './task.js';

export const AssetRoleSchema = Type.Union([
  Type.Literal('source'),
  Type.Literal('intermediate'),
  Type.Literal('result'),
]);

export const AssetReferenceSchema = Type.Object(
  {
    assetId: Type.String({ minLength: 1 }),
    role: AssetRoleSchema,
    taskId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

/**
 * 资产元数据：只描述“这是什么”，不携带内容。
 * 内容（Blob）由仓储在同一事务内与元数据、引用一起写入。
 */
export const AssetRecordSchema = Type.Object(
  {
    assetId: Type.String({ minLength: 1 }),
    role: AssetRoleSchema,
    name: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    sizeBytes: Type.Integer({ minimum: 0 }),
    createdAt: Type.String({ minLength: 1 }),
    taskId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

/** 本地归档格式版本；不兼容变化必须提升版本号。 */
export const ASSET_ARCHIVE_FORMAT_VERSION = 1;

/** 归档中的单个资产；`dataBase64` 缺省表示“只导出元数据，不含内容”。 */
export const AssetArchiveEntrySchema = Type.Object(
  {
    record: AssetRecordSchema,
    references: Type.Array(AssetReferenceSchema),
    dataBase64: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AssetArchiveSchema = Type.Object(
  {
    formatVersion: Type.Integer({ minimum: 1 }),
    createdAt: Type.String({ minLength: 1 }),
    assets: Type.Array(AssetArchiveEntrySchema),
    tasks: Type.Array(TaskRecordSchema),
  },
  { additionalProperties: false },
);

export type AssetRole = Static<typeof AssetRoleSchema>;
export type AssetReference = Static<typeof AssetReferenceSchema>;
export type AssetRecord = Static<typeof AssetRecordSchema>;
export type AssetArchiveEntry = Static<typeof AssetArchiveEntrySchema>;
export type AssetArchive = Static<typeof AssetArchiveSchema>;
