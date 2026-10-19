export interface ToolCategory {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
}

export interface ToolDefinition {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  icon: string;
  inputLabel: string;
  sampleInput: string;
  workspaceTitle: string;
  workspaceLines: string[];
}

export interface SampleTask {
  id: string;
  toolId: string;
  title: string;
  category: string;
  status: string;
  timeLabel: string;
}

export const categories: ToolCategory[] = [
  {
    id: 'image',
    name: '图像与设计',
    shortName: '图像',
    description: '图片整理、尺寸检查与视觉素材预览。',
    icon: 'image',
  },
  {
    id: 'documents',
    name: '文档与文字',
    shortName: '文档',
    description: '文本、文档和内容检查工具。',
    icon: 'article',
  },
  {
    id: 'data',
    name: '数据与转换',
    shortName: '数据',
    description: '结构化数据查看和格式转换。',
    icon: 'table_chart',
  },
  {
    id: 'developer',
    name: '开发辅助',
    shortName: '开发',
    description: '面向日常开发的小型辅助工具。',
    icon: 'code',
  },
  {
    id: 'utilities',
    name: '实用工具',
    shortName: '实用',
    description: '时间、标识和常见信息换算。',
    icon: 'widgets',
  },
];

export const tools: ToolDefinition[] = [
  {
    id: 'image-inspector',
    categoryId: 'image',
    title: '图片信息检查',
    summary: '检查图片文件的基础信息，并预览适合的后续处理方式。',
    icon: 'photo_camera',
    inputLabel: '图片文件名（预览）',
    sampleInput: 'sample-image.png',
    workspaceTitle: '图片工作区样本',
    workspaceLines: [
      'sample-image.png',
      '宽度       1600 px',
      '高度        900 px',
      '格式       PNG',
    ],
  },
  {
    id: 'markdown-preview',
    categoryId: 'documents',
    title: 'Markdown 预览',
    summary: '在编辑内容时查看排版预览和文档结构。',
    icon: 'description',
    inputLabel: 'Markdown 内容（预览）',
    sampleInput: '# 一份示例文档\n\n这里展示内容输入区的布局。',
    workspaceTitle: '文档工作区样本',
    workspaceLines: [
      '标题层级     1 个',
      '段落           1 个',
      '链接           0 个',
      '预览状态     待处理',
    ],
  },
  {
    id: 'json-viewer',
    categoryId: 'data',
    title: 'JSON 查看器',
    summary: '查看 JSON 数据区域、格式提示和后续结果的位置。',
    icon: 'data_object',
    inputLabel: 'JSON 文本（预览）',
    sampleInput: '{\n  "project": "iTools",\n  "preview": true\n}',
    workspaceTitle: '数据工作区样本',
    workspaceLines: [
      '对象           1 个',
      '键值对        2 组',
      '格式           JSON',
      '检查状态     仅布局预览',
    ],
  },
  {
    id: 'regex-playground',
    categoryId: 'developer',
    title: '正则表达式工作台',
    summary: '组织表达式、测试文本和匹配结果的工作区布局。',
    icon: 'code_blocks',
    inputLabel: '测试文本（预览）',
    sampleInput: 'name@example.com',
    workspaceTitle: '开发工作区样本',
    workspaceLines: [
      '表达式         /.+@.+\\..+/',
      '测试文本     name@example.com',
      '匹配状态     未执行',
    ],
  },
  {
    id: 'timestamp-converter',
    categoryId: 'utilities',
    title: '时间戳换算',
    summary: '为时间输入、时区选择与换算结果预留清楚的页面结构。',
    icon: 'schedule',
    inputLabel: '时间戳（预览）',
    sampleInput: '1792444800',
    workspaceTitle: '换算工作区样本',
    workspaceLines: [
      '输入格式     Unix 秒',
      '时区           本地时区',
      '结果区域     等待输入',
    ],
  },
  {
    id: 'text-diff',
    categoryId: 'documents',
    title: '文本差异比较',
    summary: '并排组织两份文本和差异摘要。',
    icon: 'difference',
    inputLabel: '原始文本（预览）',
    sampleInput: '第一份示例文本',
    workspaceTitle: '比较工作区样本',
    workspaceLines: [
      '原始文本       已准备样本',
      '对照文本       等待输入',
      '差异摘要       尚未比较',
    ],
  },
];

export const sampleTasks: SampleTask[] = [
  {
    id: 'sample-1',
    toolId: 'image-inspector',
    title: '图片信息检查',
    category: '图像与设计',
    status: '结果样本',
    timeLabel: '刚刚',
  },
  {
    id: 'sample-2',
    toolId: 'markdown-preview',
    title: 'Markdown 预览',
    category: '文档与文字',
    status: '等待输入',
    timeLabel: '今天 14:32',
  },
  {
    id: 'sample-3',
    toolId: 'json-viewer',
    title: 'JSON 查看器',
    category: '数据与转换',
    status: '状态样本',
    timeLabel: '昨天 18:07',
  },
];

export function getCategory(categoryId: string) {
  return categories.find((category) => category.id === categoryId);
}

export function getTool(toolId: string) {
  return tools.find((tool) => tool.id === toolId);
}

export function getToolsForCategory(categoryId: string) {
  return tools.filter((tool) => tool.categoryId === categoryId);
}
