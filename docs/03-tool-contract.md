# 03 · 工具注册契约与统一页面

> 状态：**契约、三态注册表、统一页面骨架已实现；没有任何可执行工具（`implemented = 0`）**。
> 代码入口：`packages/contracts/src/{tool.ts,tool-registry.ts}`、`packages/app-core/src/registry/**`、`apps/web/src/pages/tool/**`。
> 阶段 5 已交付任务运行时（04），但**尚未接线**：没有工具执行入口，工具页任务区仍是预览说明。

## 1. 工具契约（`contracts/tool.ts`，版本 1）

每个工具必须声明 `ToolManifest`：

| 字段 | 说明 |
| --- | --- |
| `contractVersion` | 当前固定 `1`；变更需版本与兼容性测试 |
| `id` / `routeKey` | 稳定 kebab-case；`routeKey` 必须与 `id` 一致 |
| `category` | `audio \| image \| video \| text \| other` |
| `icon` | Material Symbols 名 |
| `implementationVersion` | 工具实现版本 |
| `translationNamespace` | `tools/<id>`，资源必须存在 |
| `dependencies` | 工具专属依赖说明 |
| `requiredBrowserApis` | 例：`FileReader`、`Canvas`、`WebAssembly` |
| `supportedFormats` | 输入格式 |
| `maxInputBytes` | 单文件/单输入上限 |
| `estimatedMemoryBytes` | 内存预算 |
| `computeClass` | `light \| medium \| heavy` |
| `resultTypes` | 结果类型 |

执行契约：

```ts
interface ToolAdapter<TInput, TOutput> {
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}
interface ToolExecutionContext {
  taskId: string;
  cancellation: CancellationSignal;
  reportProgress(progress: TaskProgress): void;
}
interface ToolDefinition<TInputSchema, TOutputSchema> {
  manifest: ToolManifest;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  adapter: ToolAdapter<Static<TInputSchema>, Static<TOutputSchema>>;
}
```

阶段 4 没有任务运行时，`adapter` 的执行契约通过测试 fixture 验证（TypeBox 校验输入 → 执行 → 校验输出），不进入产品注册表。

## 2. 三态注册表（`contracts/tool-registry.ts` + `app-core/registry`）

```ts
type ToolAvailability = 'preview' | 'implemented' | 'disabled';

interface ToolCatalogMetadata {
  id: string;              // 同时作为 routeKey
  category: ToolCategory;
  icon: string;
  order: number;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;  // SEO
  preview: {
    inputLabel: LocalizedText;
    sampleInput: LocalizedText;
    workspaceTitle: LocalizedText;
    workspaceLines: { label: LocalizedText; value: string }[];
  };
}

type RegistryEntry =
  | { availability: 'preview'; metadata }
  | { availability: 'implemented'; metadata; definition; resources }
  | { availability: 'disabled'; metadata };
```

规则：

- **唯一来源**：工具身份、分类、可用性、展示元数据只存在于 `app-core/registry`；`app-core/catalog` 只保留分类与样本任务。
- `preview`：可见、只读、200 + `noindex`、不进 Sitemap、不可执行。
- `implemented`：可执行、可索引、进 Sitemap。当前没有实例。
- `disabled`：不可直达，返回 404，不进导航/搜索/Sitemap。
- 默认注册表（`toolRegistry`）：6 个 preview + 1 个 disabled（`csv-inspector`），`implemented` 为空。
- 数据库只能**降级**：阶段 7 起 `tools.availability_override` 仅允许 `'disabled'`，用于运营下架；数据库无法把工具改成 `implemented`（D27）。
- 排序：`metadata.order` 升序，同序按 id。
- 查询 API：`listTools`、`listVisibleTools`、`listImplementedTools`、`findTool`、`findVisibleTool`、`listVisibleByCategory`、`searchVisibleTools`、`listSitemapPaths`。
- 注入：`createToolRegistry(implementedEntries)` 用于组合工具包；默认注册表不包含任何工具包。

## 3. 注册表校验

`validateToolRegistry(entries, sampleTasks)` 返回 issue 列表；`pnpm check:tools` 使用默认注册表与样本任务执行，存在 issue 时非零退出。

| code | 含义 |
| --- | --- |
| `duplicate-id` | 工具 id 重复 |
| `duplicate-route-key` | routeKey 重复 |
| `invalid-category` | 分类不在冻结集合 |
| `missing-translation` | 中英缺失/空值，或英文含中文 |
| `preview-with-definition` | 预览条目携带 `definition` |
| `implemented-without-definition` | 已实现条目缺 `definition` |
| `implemented-without-namespace` | `translationNamespace` 资源缺失 |
| `invalid-contract-version` | `contractVersion !== 1` |
| `sample-task-missing-tool` | 样本任务引用不存在的工具 |
| `sample-task-disabled-tool` | 样本任务引用停用工具 |

前置：`pnpm build`（或 `pnpm --filter @itools/app-core build`）。该检查**未接入 lint 与 CI**，阶段 11 接入。

## 4. 统一工具页面

固定区块顺序：

1. 标题与简介（含预览徽标）。
2. 输入区：预览态为禁用只读 `TextField`，显示示例输入与“输入区将在工具实现后启用”。
3. 主工作区：预览态只读展示注册表中的示例行。
4. 任务区：预览态仅说明“任务运行时将在工具实现后接入”。
5. 结果区：预览态仅说明“结果区将在工具实现后展示真实输出”。
6. 规范/开源致谢。

禁止：伪造进度、伪造“校验通过”、伪造结果、把预览样本描述成真实执行。

## 5. 新增一个真实工具（流程）

当前默认注册表没有注入点，新增首个工具时需要一次小重构，步骤：

1. 新建 `packages/tool-<id>`（包名 `@itools/tool-<id>`），依赖 `@itools/contracts`；实现 manifest、TypeBox 输入/输出 Schema、adapter、双语元数据与 `tools/<id>` 资源。
2. 导出 `ImplementedRegistryEntry`（`availability: 'implemented'`）。
3. 在 `apps/web` 新建 `src/app/registry.ts`：`export const toolRegistry = createToolRegistry([entry])`，并把 `app/route.ts`、页面、`entry-server.tsx` 从 `@itools/app-core` 的便捷导出改为使用该实例；`createI18n(locale, entry.resources)` 合并工具文案。
4. 路由、Sitemap、搜索会自动把该工具视为 implemented（前提是查询走同一注册表实例）。
5. 补充：契约测试、页面组件测试、SSR HTTP 测试、`check:tools` 负向用例。
6. 更新 `pnpm-workspace.yaml` 边界白名单（`@itools/tool-*` 已允许依赖 contracts/app-core/adapter）。

阶段 5 引入任务运行时后，`adapter.execute` 必须通过 `@itools/task-runtime` 的调度器执行，不得在页面直接调用。运行时的 `TaskStartRequest` 只携带 `taskId`、`toolId`、`engine`、`input`，工具包需要提供同引擎的 Worker 入口或 `TaskRunner` 实现。

## 6. 验收要求（新增工具时）

- 输入经 TypeBox 校验，非法输入有就地错误提示，不进入 adapter。
- 输出经 `outputSchema` 校验；校验失败视为任务失败，不能展示为成功。
- 资源预算、浏览器能力缺失时有明确禁用说明；不得自动上传文件。
- 工具之间无直接依赖；共享逻辑放入 app-core 或独立共享包。
- 工具页区块顺序与错误状态有组件测试；SSR 下工具页 200 且可索引。
