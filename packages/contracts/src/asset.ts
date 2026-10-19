import Type, { type Static } from 'typebox';

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

export type AssetRole = Static<typeof AssetRoleSchema>;
export type AssetReference = Static<typeof AssetReferenceSchema>;
