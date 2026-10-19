/**
 * 运行时内部使用的任务视图与提交形状。
 * 对外只暴露快照（不可变），调用方无法直接改状态。
 */
import type {
  TaskError,
  TaskProgress,
  TaskResourceRequest,
  TaskStatus,
} from '@itools/contracts';

export interface TaskSnapshot {
  readonly taskId: string;
  readonly toolId: string;
  readonly status: TaskStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resultAssetIds: readonly string[];
  readonly progress?: TaskProgress;
  readonly error?: TaskError;
}

export interface TaskSubmitInput {
  readonly toolId: string;
  readonly engine: string;
  readonly input: unknown;
  readonly resources: TaskResourceRequest;
}

export type TaskRuntimeEvent = {
  readonly type: 'task-updated';
  readonly task: TaskSnapshot;
};

export type TaskEventListener = (event: TaskRuntimeEvent) => void;
