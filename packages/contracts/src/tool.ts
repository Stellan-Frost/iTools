import Type, { type Static, type TSchema } from 'typebox';
import type { TaskProgress } from './task.js';

export const TOOL_CONTRACT_VERSION = 1 as const;

const ToolIdSchema = Type.String({
  pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
});

export const ToolCategorySchema = Type.Union([
  Type.Literal('audio'),
  Type.Literal('image'),
  Type.Literal('video'),
  Type.Literal('text'),
  Type.Literal('other'),
]);

export const ToolManifestSchema = Type.Object(
  {
    contractVersion: Type.Literal(TOOL_CONTRACT_VERSION),
    id: ToolIdSchema,
    routeKey: ToolIdSchema,
    category: ToolCategorySchema,
    icon: Type.String({ minLength: 1 }),
    implementationVersion: Type.String({ minLength: 1 }),
    translationNamespace: Type.String({ minLength: 1 }),
    dependencies: Type.Array(Type.String({ minLength: 1 }), {
      uniqueItems: true,
    }),
    requiredBrowserApis: Type.Array(Type.String({ minLength: 1 }), {
      uniqueItems: true,
    }),
    supportedFormats: Type.Array(Type.String({ minLength: 1 }), {
      uniqueItems: true,
    }),
    maxInputBytes: Type.Integer({ minimum: 1 }),
    estimatedMemoryBytes: Type.Integer({ minimum: 1 }),
    computeClass: Type.Union([
      Type.Literal('light'),
      Type.Literal('medium'),
      Type.Literal('heavy'),
    ]),
    resultTypes: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export type ToolManifest = Static<typeof ToolManifestSchema>;
export type ToolCategory = Static<typeof ToolCategorySchema>;

export interface CancellationSignal {
  readonly isCancellationRequested: boolean;
  throwIfCancellationRequested(): void;
}

export interface ToolExecutionContext {
  readonly taskId: string;
  readonly cancellation: CancellationSignal;
  reportProgress(progress: TaskProgress): void;
}

export interface ToolAdapter<TInput, TOutput> {
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}

export interface ToolDefinition<
  TInputSchema extends TSchema,
  TOutputSchema extends TSchema,
> {
  readonly manifest: ToolManifest;
  readonly inputSchema: TInputSchema;
  readonly outputSchema: TOutputSchema;
  readonly adapter: ToolAdapter<Static<TInputSchema>, Static<TOutputSchema>>;
}
