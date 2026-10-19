import type { SampleTask } from '../types.js';

const sampleTasks: readonly SampleTask[] = [
  {
    id: 'sample-1',
    toolId: 'image-inspector',
    status: { 'zh-CN': '结果样本', en: 'Sample result' },
    timeLabel: { 'zh-CN': '刚刚', en: 'Just now' },
  },
  {
    id: 'sample-2',
    toolId: 'markdown-preview',
    status: { 'zh-CN': '等待输入', en: 'Waiting for input' },
    timeLabel: { 'zh-CN': '今天 14:32', en: 'Today 2:32 PM' },
  },
  {
    id: 'sample-3',
    toolId: 'json-viewer',
    status: { 'zh-CN': '状态样本', en: 'Sample status' },
    timeLabel: { 'zh-CN': '昨天 18:07', en: 'Yesterday 6:07 PM' },
  },
];

export const SAMPLE_TASKS: readonly SampleTask[] = Object.freeze(sampleTasks);
