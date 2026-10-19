import Type, { type Static } from 'typebox';

export const TaskStatusSchema = Type.Union([
  Type.Literal('queued'),
  Type.Literal('preparing'),
  Type.Literal('running'),
  Type.Literal('cancelling'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
]);

export const TaskProgressSchema = Type.Object(
  {
    taskId: Type.String({ minLength: 1 }),
    completed: Type.Number({ minimum: 0 }),
    total: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    messageKey: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const TaskRecordSchema = Type.Object(
  {
    taskId: Type.String({ minLength: 1 }),
    toolId: Type.String({ minLength: 1 }),
    status: TaskStatusSchema,
    createdAt: Type.String({ minLength: 1 }),
    updatedAt: Type.String({ minLength: 1 }),
    resultAssetIds: Type.Array(Type.String({ minLength: 1 })),
    errorCode: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export type TaskStatus = Static<typeof TaskStatusSchema>;
export type TaskProgress = Static<typeof TaskProgressSchema>;
export type TaskRecord = Static<typeof TaskRecordSchema>;
