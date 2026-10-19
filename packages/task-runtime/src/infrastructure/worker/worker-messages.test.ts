import { describe, expect, it } from 'vitest';

import {
  WorkerProtocolError,
  decodeOutboundMessage,
} from './worker-messages.js';

describe('Worker 消息协议', () => {
  it('接受合法的进度消息', () => {
    const message = decodeOutboundMessage({
      type: 'progress',
      progress: { taskId: 'task-1', completed: 2, total: 10 },
    });
    expect(message.type).toBe('progress');
  });

  it('接受合法的完成、错误与取消确认', () => {
    expect(
      decodeOutboundMessage({
        type: 'complete',
        taskId: 'task-1',
        output: { bytes: 3 },
      }).type,
    ).toBe('complete');
    expect(
      decodeOutboundMessage({
        type: 'error',
        taskId: 'task-1',
        error: {
          code: 'execution-failed',
          messageKey: 'tasks:error.execution-failed',
          retryable: false,
        },
      }).type,
    ).toBe('error');
    expect(
      decodeOutboundMessage({ type: 'cancelled', taskId: 'task-1' }).type,
    ).toBe('cancelled');
  });

  it('拒绝未知消息类型', () => {
    expect(() => decodeOutboundMessage({ type: 'unknown' })).toThrow(
      WorkerProtocolError,
    );
  });

  it('拒绝缺少 taskId 的消息', () => {
    expect(() =>
      decodeOutboundMessage({ type: 'complete', output: null }),
    ).toThrow(WorkerProtocolError);
  });

  it('拒绝多余字段，防止协议漂移', () => {
    expect(() =>
      decodeOutboundMessage({
        type: 'cancelled',
        taskId: 'task-1',
        extra: true,
      }),
    ).toThrow(WorkerProtocolError);
  });

  it('拒绝非对象报文', () => {
    expect(() => decodeOutboundMessage('cancelled')).toThrow(
      WorkerProtocolError,
    );
    expect(() => decodeOutboundMessage(null)).toThrow(WorkerProtocolError);
  });

  it('协议错误的错误码稳定', () => {
    try {
      decodeOutboundMessage({ type: 'nope' });
      throw new Error('应当抛出 WorkerProtocolError');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkerProtocolError);
      expect((error as WorkerProtocolError).code).toBe('protocol-violation');
    }
  });
});
