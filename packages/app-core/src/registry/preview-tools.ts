import type { RegistryEntry } from '@itools/contracts';

/**
 * 阶段 4 默认注册表条目：由阶段 3 的 catalog 工具数据迁移而来。
 * 原 `enabled: true` 映射为 `preview`，`enabled: false` 映射为 `disabled`；
 * 用户可见文案保持逐字不变。
 */
const entries: readonly RegistryEntry[] = [
  {
    availability: 'preview',
    metadata: {
      id: 'image-inspector',
      category: 'image',
      icon: 'photo_camera',
      order: 10,
      name: { 'zh-CN': '图片信息检查', en: 'Image inspector' },
      summary: {
        'zh-CN':
          '读取图片的尺寸、格式与文件大小，快速确认素材是否符合使用要求。',
        en: 'Read image dimensions, format, and file size to confirm an asset fits its intended use.',
      },
      description: {
        'zh-CN':
          '检查本地图片的宽度、高度、色彩模式与文件大小，为后续处理提供可靠依据。',
        en: 'Inspect width, height, color mode, and file size of local images before further processing.',
      },
      preview: {
        inputLabel: {
          'zh-CN': '图片文件名（预览）',
          en: 'Image file name (preview)',
        },
        sampleInput: { 'zh-CN': 'sample-image.png', en: 'sample-image.png' },
        workspaceTitle: {
          'zh-CN': '图片工作区样本',
          en: 'Image workspace sample',
        },
        workspaceLines: Object.freeze([
          { label: { 'zh-CN': '宽度', en: 'Width' }, value: '1600 px' },
          { label: { 'zh-CN': '高度', en: 'Height' }, value: '900 px' },
          { label: { 'zh-CN': '格式', en: 'Format' }, value: 'PNG' },
          { label: { 'zh-CN': '文件大小', en: 'File size' }, value: '248 KB' },
        ]),
      },
    },
  },
  {
    availability: 'preview',
    metadata: {
      id: 'markdown-preview',
      category: 'text',
      icon: 'description',
      order: 20,
      name: { 'zh-CN': 'Markdown 预览', en: 'Markdown preview' },
      summary: {
        'zh-CN': '在编辑 Markdown 时同步查看排版效果与文档结构。',
        en: 'Review layout and document structure while editing Markdown.',
      },
      description: {
        'zh-CN':
          '实时预览 Markdown 标题、段落与链接结构，帮助在发布前发现排版问题。',
        en: 'Preview Markdown headings, paragraphs, and links to catch layout issues before publishing.',
      },
      preview: {
        inputLabel: {
          'zh-CN': 'Markdown 内容（预览）',
          en: 'Markdown content (preview)',
        },
        sampleInput: {
          'zh-CN': '# 一份示例文档\n\n这里展示内容输入区的布局。',
          en: '# Sample document\n\nThis shows the layout of the input area.',
        },
        workspaceTitle: {
          'zh-CN': '文档工作区样本',
          en: 'Document workspace sample',
        },
        workspaceLines: Object.freeze([
          { label: { 'zh-CN': '标题层级', en: 'Heading levels' }, value: '1' },
          { label: { 'zh-CN': '段落', en: 'Paragraphs' }, value: '1' },
          { label: { 'zh-CN': '链接', en: 'Links' }, value: '0' },
          { label: { 'zh-CN': '字符数', en: 'Characters' }, value: '42' },
        ]),
      },
    },
  },
  {
    availability: 'preview',
    metadata: {
      id: 'json-viewer',
      category: 'text',
      icon: 'data_object',
      order: 30,
      name: { 'zh-CN': 'JSON 查看器', en: 'JSON viewer' },
      summary: {
        'zh-CN': '折叠查看 JSON 结构与键值类型，快速定位嵌套数据。',
        en: 'Explore JSON structure and value types with collapsible nesting.',
      },
      description: {
        'zh-CN':
          '以树形结构查看 JSON 对象、数组与键值类型，快速核对接口返回的数据。',
        en: 'View JSON objects, arrays, and value types in a tree to verify API responses quickly.',
      },
      preview: {
        inputLabel: { 'zh-CN': 'JSON 文本（预览）', en: 'JSON text (preview)' },
        sampleInput: {
          'zh-CN': '{\n  "project": "iTools",\n  "preview": true\n}',
          en: '{\n  "project": "iTools",\n  "preview": true\n}',
        },
        workspaceTitle: {
          'zh-CN': '数据工作区样本',
          en: 'Data workspace sample',
        },
        workspaceLines: Object.freeze([
          { label: { 'zh-CN': '对象', en: 'Objects' }, value: '1' },
          { label: { 'zh-CN': '键值对', en: 'Key-value pairs' }, value: '2' },
          { label: { 'zh-CN': '数组', en: 'Arrays' }, value: '0' },
          { label: { 'zh-CN': '格式', en: 'Format' }, value: 'JSON' },
        ]),
      },
    },
  },
  {
    availability: 'preview',
    metadata: {
      id: 'regex-playground',
      category: 'text',
      icon: 'code_blocks',
      order: 40,
      name: { 'zh-CN': '正则表达式工作台', en: 'Regex playground' },
      summary: {
        'zh-CN': '编写正则表达式并在示例文本上查看匹配结果。',
        en: 'Write regular expressions and inspect matches against sample text.',
      },
      description: {
        'zh-CN': '输入表达式与测试文本，逐条查看匹配位置和捕获分组。',
        en: 'Test expressions against sample text and review match positions and capture groups.',
      },
      preview: {
        inputLabel: { 'zh-CN': '测试文本（预览）', en: 'Test text (preview)' },
        sampleInput: { 'zh-CN': 'name@example.com', en: 'name@example.com' },
        workspaceTitle: {
          'zh-CN': '开发工作区样本',
          en: 'Developer workspace sample',
        },
        workspaceLines: Object.freeze([
          {
            label: { 'zh-CN': '表达式', en: 'Pattern' },
            value: '/.+@.+\\..+/',
          },
          {
            label: { 'zh-CN': '测试文本', en: 'Test text' },
            value: 'name@example.com',
          },
          { label: { 'zh-CN': '匹配', en: 'Matches' }, value: '1' },
          { label: { 'zh-CN': '捕获分组', en: 'Capture groups' }, value: '0' },
        ]),
      },
    },
  },
  {
    availability: 'preview',
    metadata: {
      id: 'timestamp-converter',
      category: 'other',
      icon: 'schedule',
      order: 50,
      name: { 'zh-CN': '时间戳换算', en: 'Timestamp converter' },
      summary: {
        'zh-CN': '在 Unix 时间戳与本地日期时间之间互相换算。',
        en: 'Convert between Unix timestamps and local date and time.',
      },
      description: {
        'zh-CN':
          '输入秒级或毫秒级时间戳，查看对应的本地时间、UTC 时间与 ISO 表示。',
        en: 'Enter second or millisecond timestamps to see local time, UTC, and ISO representations.',
      },
      preview: {
        inputLabel: { 'zh-CN': '时间戳（预览）', en: 'Timestamp (preview)' },
        sampleInput: { 'zh-CN': '1767225600', en: '1767225600' },
        workspaceTitle: {
          'zh-CN': '换算工作区样本',
          en: 'Conversion workspace sample',
        },
        workspaceLines: Object.freeze([
          {
            label: { 'zh-CN': '输入格式', en: 'Input format' },
            value: 'Unix seconds',
          },
          { label: { 'zh-CN': '时区', en: 'Time zone' }, value: 'UTC+08:00' },
          {
            label: { 'zh-CN': '本地时间', en: 'Local time' },
            value: '2026-01-01 08:00',
          },
          {
            label: { 'zh-CN': 'ISO 8601', en: 'ISO 8601' },
            value: '2026-01-01T00:00:00Z',
          },
        ]),
      },
    },
  },
  {
    availability: 'preview',
    metadata: {
      id: 'text-diff',
      category: 'text',
      icon: 'difference',
      order: 60,
      name: { 'zh-CN': '文本差异比较', en: 'Text diff' },
      summary: {
        'zh-CN': '并排比较两份文本并突出显示增删内容。',
        en: 'Compare two texts side by side and highlight additions and removals.',
      },
      description: {
        'zh-CN': '逐行比较两份文本，标记新增、删除与修改，便于校对修订内容。',
        en: 'Compare texts line by line and mark additions, removals, and changes for review.',
      },
      preview: {
        inputLabel: {
          'zh-CN': '原始文本（预览）',
          en: 'Original text (preview)',
        },
        sampleInput: { 'zh-CN': '第一份示例文本', en: 'First sample text' },
        workspaceTitle: {
          'zh-CN': '比较工作区样本',
          en: 'Comparison workspace sample',
        },
        workspaceLines: Object.freeze([
          { label: { 'zh-CN': '原始行数', en: 'Original lines' }, value: '1' },
          {
            label: { 'zh-CN': '对照行数', en: 'Comparison lines' },
            value: '0',
          },
          { label: { 'zh-CN': '新增', en: 'Added' }, value: '0' },
          { label: { 'zh-CN': '删除', en: 'Removed' }, value: '0' },
        ]),
      },
    },
  },
  {
    availability: 'disabled',
    metadata: {
      id: 'csv-inspector',
      category: 'text',
      icon: 'table_view',
      order: 99,
      name: {
        'zh-CN': 'CSV 检查器（停用样本）',
        en: 'CSV inspector (disabled sample)',
      },
      summary: {
        'zh-CN': '查看 CSV 的表头、列数与分隔符（样本停用）。',
        en: 'Inspect CSV headers, column counts, and delimiters (disabled sample).',
      },
      description: {
        'zh-CN':
          '停用的示例工具，仅用于验证停用工具不会出现在目录与搜索结果中。',
        en: 'Disabled sample tool used to verify that disabled tools stay out of the catalog and search results.',
      },
      preview: {
        inputLabel: {
          'zh-CN': 'CSV 内容（预览）',
          en: 'CSV content (preview)',
        },
        sampleInput: {
          'zh-CN': 'name,size\nsample.png,248 KB',
          en: 'name,size\nsample.png,248 KB',
        },
        workspaceTitle: {
          'zh-CN': '表格工作区样本',
          en: 'Table workspace sample',
        },
        workspaceLines: Object.freeze([
          { label: { 'zh-CN': '列数', en: 'Columns' }, value: '2' },
          { label: { 'zh-CN': '行数', en: 'Rows' }, value: '2' },
          { label: { 'zh-CN': '分隔符', en: 'Delimiter' }, value: 'Comma' },
          { label: { 'zh-CN': '编码', en: 'Encoding' }, value: 'UTF-8' },
        ]),
      },
    },
  },
];

export const PREVIEW_TOOL_ENTRIES: readonly RegistryEntry[] =
  Object.freeze(entries);
