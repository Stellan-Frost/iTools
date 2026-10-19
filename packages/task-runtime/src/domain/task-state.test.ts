import { describe, expect, it } from 'vitest';
import type { TaskStatus } from '@itools/contracts';

import {
  TASK_TRANSITION_EVENTS,
  TERMINAL_TASK_STATUSES,
  TaskStateError,
  isTerminalStatus,
  nextStatus,
  transitionStatus,
} from './task-state.js';

const ALL_STATUSES: readonly TaskStatus[] = [
  'queued',
  'preparing',
  'running',
  'cancelling',
  'completed',
  'failed',
  'cancelled',
];

describe('任务状态机', () => {
  it('允许从 queued 依次进入 preparing、running、completed', () => {
    expect(transitionStatus('queued', 'prepare')).toBe('preparing');
    expect(transitionStatus('preparing', 'start')).toBe('running');
    expect(transitionStatus('running', 'complete')).toBe('completed');
  });

  it('排队任务取消后直接进入 cancelled', () => {
    expect(transitionStatus('queued', 'request-cancel')).toBe('cancelled');
  });

  it('运行中取消先进入 cancelling，再确认 cancelled', () => {
    expect(transitionStatus('running', 'request-cancel')).toBe('cancelling');
    expect(transitionStatus('cancelling', 'confirm-cancel')).toBe('cancelled');
  });

  it('准备中取消同样经过 cancelling', () => {
    expect(transitionStatus('preparing', 'request-cancel')).toBe('cancelling');
  });

  it('执行中的任务在任意非终态都可以失败', () => {
    expect(transitionStatus('queued', 'fail')).toBe('failed');
    expect(transitionStatus('preparing', 'fail')).toBe('failed');
    expect(transitionStatus('running', 'fail')).toBe('failed');
    expect(transitionStatus('cancelling', 'fail')).toBe('failed');
  });

  it('禁止跳过准备阶段直接运行', () => {
    expect(nextStatus('queued', 'start')).toBeUndefined();
    expect(() => transitionStatus('queued', 'start')).toThrow(TaskStateError);
  });

  it('禁止未完成就标记完成', () => {
    expect(() => transitionStatus('preparing', 'complete')).toThrow(
      TaskStateError,
    );
    expect(() => transitionStatus('queued', 'complete')).toThrow(
      TaskStateError,
    );
  });

  it('终态不允许任何后续转换', () => {
    for (const status of TERMINAL_TASK_STATUSES) {
      for (const event of TASK_TRANSITION_EVENTS) {
        expect(nextStatus(status, event)).toBeUndefined();
      }
    }
  });

  it('非法转换抛出带稳定错误码的异常', () => {
    try {
      transitionStatus('completed', 'start');
      throw new Error('应当抛出 TaskStateError');
    } catch (error) {
      expect(error).toBeInstanceOf(TaskStateError);
      const stateError = error as TaskStateError;
      expect(stateError.code).toBe('invalid-task-transition');
      expect(stateError.from).toBe('completed');
      expect(stateError.event).toBe('start');
    }
  });

  it('终态判定与状态清单一致', () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalStatus(status)).toBe(
        TERMINAL_TASK_STATUSES.includes(status),
      );
    }
  });
});
