import Type, { type Static, type TSchema } from 'typebox';

export const ApiErrorSchema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    requestId: Type.String({ minLength: 1 }),
    details: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export type ApiError = Static<typeof ApiErrorSchema>;

export function apiSuccessSchema<TData extends TSchema>(dataSchema: TData) {
  return Type.Object(
    {
      data: dataSchema,
      meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    },
    { additionalProperties: false },
  );
}
