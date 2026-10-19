/**
 * Worker 消息协议的唯一解码入口。
 * 协议形状定义在 @itools/contracts，这里只做运行时校验，不重复声明字段。
 */
import Value from 'typebox/value';
import {
  WorkerOutboundMessageSchema,
  type WorkerOutboundMessage,
} from '@itools/contracts';

import { TASK_ERROR_CODES } from '../../domain/task-error.js';

export class WorkerProtocolError extends Error {
  readonly code = TASK_ERROR_CODES.protocolViolation;

  constructor(detail: string) {
    super(`Worker 消息不符合协议：${detail}`);
    this.name = 'WorkerProtocolError';
  }
}

/** 校验并返回 Worker → 主线程消息；不合法时抛出稳定错误。 */
export function decodeOutboundMessage(raw: unknown): WorkerOutboundMessage {
  if (!Value.Check(WorkerOutboundMessageSchema, raw)) {
    throw new WorkerProtocolError('outbound');
  }
  return raw;
}
