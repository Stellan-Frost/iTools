/**
 * 任务状态机：唯一的合法状态转换来源。
 * 只允许显式声明的转换；其余一律抛 TaskStateError（稳定错误码）。
 */
import type { TaskStatus } from '@itools/contracts';

/** 驱动状态变化的事件。取消分为“请求”与“确认”两步，避免已发出的工作静默消失。 */
export type TaskTransitionEvent =
  | 'prepare'
  | 'start'
  | 'complete'
  | 'fail'
  | 'request-cancel'
  | 'confirm-cancel';

export const TASK_TRANSITION_EVENTS: readonly TaskTransitionEvent[] = [
  'prepare',
  'start',
  'complete',
  'fail',
  'request-cancel',
  'confirm-cancel',
];

export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

/** 转换表：事件 → { 起始状态: 目标状态 }。未列出的组合即为非法转换。 */
const TRANSITIONS: Readonly<
  Record<TaskTransitionEvent, Partial<Record<TaskStatus, TaskStatus>>>
> = {
  prepare: { queued: 'preparing' },
  start: { preparing: 'running' },
  complete: { running: 'completed' },
  fail: {
    queued: 'failed',
    preparing: 'failed',
    running: 'failed',
    cancelling: 'failed',
  },
  'request-cancel': {
    queued: 'cancelled',
    preparing: 'cancelling',
    running: 'cancelling',
  },
  'confirm-cancel': { cancelling: 'cancelled' },
};

export class TaskStateError extends Error {
  readonly code = 'invalid-task-transition';
  readonly from: TaskStatus;
  readonly event: TaskTransitionEvent;

  constructor(from: TaskStatus, event: TaskTransitionEvent) {
    super(`非法任务状态转换：${from} --${event}-->`);
    this.name = 'TaskStateError';
    this.from = from;
    this.event = event;
  }
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

/** 返回目标状态；非法转换返回 undefined，便于调用方自行决定是否容忍。 */
export function nextStatus(
  from: TaskStatus,
  event: TaskTransitionEvent,
): TaskStatus | undefined {
  return TRANSITIONS[event][from];
}

/** 严格转换：非法时抛错，禁止调用方“猜”一个合理状态。 */
export function transitionStatus(
  from: TaskStatus,
  event: TaskTransitionEvent,
): TaskStatus {
  const next = nextStatus(from, event);
  if (next === undefined) throw new TaskStateError(from, event);
  return next;
}
