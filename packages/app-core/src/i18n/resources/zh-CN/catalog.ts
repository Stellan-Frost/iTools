export const catalog = {
  actions: {
    browseCategory: '浏览分类',
    openTool: '打开工具',
    startFromCategory: '从分类开始',
    browseOtherCategory: '浏览其他分类',
    backHome: '返回首页',
  },
  card: {
    toolCount: '{{total}} 个工具',
  },
  home: {
    eyebrow: 'iTools · 清晰、轻快的工具入口',
    title: '把日常小工具，放在一个清楚的地方。',
    intro:
      '浏览分类目录与统一的工具页面。所有内容都在浏览器本地完成，当前展示的是界面结构，不会处理文件或保存任务。',
    summaryLabel: '预览目录摘要',
    categoryCount: '{{total}} 个分类',
    toolCount: '{{total}} 个工具',
    realRuns: '0 次真实处理',
    artworkNote: 'LOCAL · PREVIEW',
    browseKicker: 'BROWSE',
    categoryTitle: '按分类浏览',
    categoryAction: '查看分类样本',
    featuredKicker: 'SAMPLE TOOLBOX',
    featuredTitle: '常用工具界面样本',
    featuredCaption: '预览数据 · 不代表真实目录',
    privacyTitle: '本地界面预览',
    privacyBody:
      '示例输入、任务和结果仅用于查看页面布局；没有数据库、真实工具处理或管理员认证。',
  },
  category: {
    eyebrow: '工具分类 · 界面预览',
    count: '{{total}} 个工具',
    notice: '以下内容用于展示目录浏览方式，工具处理尚未接入。',
    listLabel: '{{category}}工具',
    emptyTitle: '此分类暂时没有工具',
    emptyBody: '分类结构仍可查看；后续可以在此呈现已实现的工具。',
    notFoundTitle: '分类不存在',
    notFoundBody: '这个分类不在当前目录中。',
  },
  tool: {
    eyebrow: '{{category}} · 工具界面预览',
    previewBody: '该工具尚未实现，当前仅展示页面结构与示例布局。',
    previewInputHint: '输入区将在工具实现后启用。',
    previewTaskBody: '任务运行时将在工具实现后接入。',
    previewResultBody: '结果区将在工具实现后展示真实输出。',
    notFoundTitle: '工具不存在',
    notFoundBody: '该工具不存在或已停用。',
    input: {
      title: '输入',
    },
    workspace: {
      title: '主工作区',
      description: '展示工具主要内容的布局位置，不运行样本内容。',
      kicker: 'WORKSPACE SAMPLE',
      chip: '预览数据',
      ariaLabel: '{{name}}工作区样本',
      footnote: '这块区域用于说明工作区比例和信息层级，当前没有实际运行。',
    },
    task: {
      title: '任务状态',
    },
    result: {
      title: '结果',
      heading: '尚无处理结果',
    },
    attribution: {
      design: '设计语义参考 Material Design 3 · 组件来源由统一适配层管理。',
      stage: '本项目开放源码致谢样本 · 当前为界面预览。',
    },
  },
};
