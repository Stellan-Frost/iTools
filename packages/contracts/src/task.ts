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

export const TaskComputeClassSchema = Type.Union([
  Type.Literal('light'),
  Type.Literal('medium'),
  Type.Literal('heavy'),
]);

/** 任务提交时声明的资源需求；调度器据此做准入判断。 */
export const TaskResourceRequestSchema = Type.Object(
  {
    estimatedMemoryBytes: Type.Integer({ minimum: 1 }),
    computeClass: TaskComputeClassSchema,
  },
  { additionalProperties: false },
);

/** 面向用户的稳定错误；不得携带堆栈、路径或用户数据。 */
export const TaskErrorSchema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    messageKey: Type.String({ minLength: 1 }),
    retryable: Type.Boolean(),
    detail: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

/** 集中配置的调度预算；工具不得自行覆盖。 */
export const TaskSchedulerBudgetSchema = Type.Object(
  {
    maxConcurrentTasks: Type.Integer({ minimum: 1 }),
    maxTotalMemoryBytes: Type.Integer({ minimum: 1 }),
    perToolConcurrency: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

/** 主线程 → Worker：只有开始与取消两种指令。 */
export const WorkerInboundMessageSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('start'),
      taskId: Type.String({ minLength: 1 }),
      input: Type.Unknown(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('cancel'),
      taskId: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
]);

/** Worker → 主线程：进度、完成、错误、取消确认。 */
export const WorkerOutboundMessageSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('progress'),
      progress: TaskProgressSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('complete'),
      taskId: Type.String({ minLength: 1 }),
      output: Type.Unknown(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('error'),
      taskId: Type.String({ minLength: 1 }),
      error: TaskErrorSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('cancelled'),
      taskId: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
]);

export type TaskStatus = Static<typeof TaskStatusSchema>;
export type TaskProgress = Static<typeof TaskProgressSchema>;
export type TaskRecord = Static<typeof TaskRecordSchema>;
export type TaskComputeClass = Static<typeof TaskComputeClassSchema>;
export type TaskResourceRequest = Static<typeof TaskResourceRequestSchema>;
export type TaskError = Static<typeof TaskErrorSchema>;
export type TaskSchedulerBudget = Static<typeof TaskSchedulerBudgetSchema>;
export type WorkerInboundMessage = Static<typeof WorkerInboundMessageSchema>;
export type WorkerOutboundMessage = Static<typeof WorkerOutboundMessageSchema>;
