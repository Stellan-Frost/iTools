import { describe, expect, it } from 'vitest';
import Value from 'typebox/value';
import {
  ApiErrorSchema,
  DEFAULT_LOCALE,
  LOCALES,
  ServerEnvironmentSchema,
  TaskErrorSchema,
  TaskResourceRequestSchema,
  TaskSchedulerBudgetSchema,
  TaskStatusSchema,
  ToolManifestSchema,
  TOOL_AVAILABILITIES,
  WorkerInboundMessageSchema,
  WorkerOutboundMessageSchema,
  apiSuccessSchema,
  isLocale,
  parseServerEnvironment,
} from './index.js';
import Type from 'typebox';

describe('shared contracts', () => {
  it('rejects an unknown task status', () => {
    expect(Value.Check(TaskStatusSchema, 'queued')).toBe(true);
    expect(Value.Check(TaskStatusSchema, 'paused')).toBe(false);
  });

  it('rejects an invalid or unsupported tool manifest', () => {
    const manifest = {
      contractVersion: 1,
      id: 'json-formatter',
      routeKey: 'json-formatter',
      category: 'text',
      icon: 'data_object',
      implementationVersion: '1.0.0',
      translationNamespace: 'tools/json-formatter',
      dependencies: [],
      requiredBrowserApis: [],
      supportedFormats: ['application/json'],
      maxInputBytes: 1024,
      estimatedMemoryBytes: 4096,
      computeClass: 'light',
      resultTypes: ['text'],
    };
    expect(Value.Check(ToolManifestSchema, manifest)).toBe(true);
    expect(
      Value.Check(ToolManifestSchema, { ...manifest, contractVersion: 2 }),
    ).toBe(false);
    expect(Value.Check(ToolManifestSchema, { ...manifest, id: 'Bad ID' })).toBe(
      false,
    );
    expect(
      Value.Check(ToolManifestSchema, { ...manifest, maxInputBytes: 0 }),
    ).toBe(false);
  });

  it('requires a request ID on API errors and validates success data', () => {
    expect(
      Value.Check(ApiErrorSchema, {
        code: 'INVALID_INPUT',
        message: 'Invalid',
        requestId: 'req-1',
      }),
    ).toBe(true);
    expect(
      Value.Check(ApiErrorSchema, {
        code: 'INVALID_INPUT',
        message: 'Invalid',
      }),
    ).toBe(false);
    const response = apiSuccessSchema(Type.Object({ count: Type.Integer() }));
    expect(Value.Check(response, { data: { count: 1 } })).toBe(true);
    expect(Value.Check(response, { data: { count: '1' } })).toBe(false);
  });

  it('requires valid server configuration values', () => {
    const environment = {
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3000,
      DATABASE_URL: 'postgresql://localhost/itools',
    };
    expect(Value.Check(ServerEnvironmentSchema, environment)).toBe(true);
    expect(
      Value.Check(ServerEnvironmentSchema, { ...environment, PORT: 0 }),
    ).toBe(false);
    expect(
      Value.Check(ServerEnvironmentSchema, {
        ...environment,
        DATABASE_URL: 'secret',
      }),
    ).toBe(false);
    expect(parseServerEnvironment({ ...environment, PORT: '3000' })).toEqual(
      environment,
    );
    expect(() => parseServerEnvironment({ ...environment, PORT: '0' })).toThrow(
      'Invalid server environment configuration',
    );
  });

  it('freezes the supported locale set and default locale', () => {
    expect(LOCALES).toEqual(['zh-CN', 'en']);
    expect(DEFAULT_LOCALE).toBe('zh-CN');
    expect(isLocale('zh-CN')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('zh-cn')).toBe(false);
    expect(isLocale('fr')).toBe(false);
  });

  it('freezes the tool availability states', () => {
    expect(TOOL_AVAILABILITIES).toEqual(['preview', 'implemented', 'disabled']);
  });

  it('validates worker protocol messages in both directions', () => {
    expect(
      Value.Check(WorkerInboundMessageSchema, {
        type: 'start',
        taskId: 'task-1',
        input: { text: '{}' },
      }),
    ).toBe(true);
    expect(
      Value.Check(WorkerInboundMessageSchema, {
        type: 'start',
        taskId: 'task-1',
      }),
    ).toBe(false);
    expect(
      Value.Check(WorkerOutboundMessageSchema, {
        type: 'cancelled',
        taskId: 'task-1',
      }),
    ).toBe(true);
    // 入站指令不得出现在出站协议里，反之亦然。
    expect(
      Value.Check(WorkerOutboundMessageSchema, {
        type: 'cancel',
        taskId: 'task-1',
      }),
    ).toBe(false);
    expect(
      Value.Check(WorkerOutboundMessageSchema, {
        type: 'complete',
        taskId: 'task-1',
        output: null,
        extra: true,
      }),
    ).toBe(false);
  });

  it('validates task resource requests, errors and scheduler budget', () => {
    expect(
      Value.Check(TaskResourceRequestSchema, {
        estimatedMemoryBytes: 1024,
        computeClass: 'medium',
      }),
    ).toBe(true);
    expect(
      Value.Check(TaskResourceRequestSchema, {
        estimatedMemoryBytes: 1.5,
        computeClass: 'light',
      }),
    ).toBe(false);
    expect(
      Value.Check(TaskResourceRequestSchema, {
        estimatedMemoryBytes: 1024,
        computeClass: 'extreme',
      }),
    ).toBe(false);
    expect(
      Value.Check(TaskErrorSchema, {
        code: 'execution-failed',
        messageKey: 'tasks:error.execution-failed',
        retryable: false,
      }),
    ).toBe(true);
    expect(
      Value.Check(TaskSchedulerBudgetSchema, {
        maxConcurrentTasks: 0,
        maxTotalMemoryBytes: 1024,
        perToolConcurrency: 1,
      }),
    ).toBe(false);
  });
});
