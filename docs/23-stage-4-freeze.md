# 23 · 阶段 4 冻结：全局框架、注册表与预览状态

> 状态：2026-10-19 已获用户四项决定并完成实施，验收记录见 [24](24-stage-4-acceptance.md)。本文保留为阶段 4 的接口与口径依据。

## 1. 用户决定（2026-10-19）

| 问题 | 决定 | 影响 |
| --- | --- | --- |
| 首个真实工具 | **先建立网站全局框架，再设计具体工具** | 阶段 4 不发布任何可执行工具；执行契约用测试专用 fixture 验证 |
| 其余样本工具 | **标记为预览（preview）** | 需要扩展阶段 3 的可用性口径：预览页 200 且标注未实现，但 `noindex`、不进 Sitemap |
| 阶段 4 验收顺序 | 采纳拆分：现在 / 阶段 5 / 阶段 7 / 阶段 11 | 队列留阶段 5，Seed/DB 留阶段 7，CI/Playwright 留阶段 11 |
| 工具元数据来源 | **注册表唯一来源** | 工具名称/简介/描述/图标/排序从 `app-core/catalog` 迁入注册表；目录查询由注册表派生 |

## 2. 阶段 4 范围（框架优先）

交付：

1. **工具注册表**：预览与已实现两类条目、唯一 ID、routeKey、分类、双语元数据、可用性；默认注册表只含预览条目。
2. **预览状态**：导航、首页、分类页、搜索、工具页统一显示“预览”标识；工具页 200 + `noindex`；不可执行。
3. **统一工具页骨架**：标题/简介 → 输入区 → 主工作区 → 任务区 → 结果区 → 规范/致谢；预览态给出明确说明，不伪造执行结果。
4. **目录派生**：分类、工具列表、搜索、Sitemap、路由全部由注册表 + 分类定义派生，删除 `app-core/catalog` 中的工具重复数据。
5. **注册表校验**：重复 ID、routeKey 冲突、非法分类、缺双语、预览条目携带 adapter、已实现条目缺 manifest/Schema/文案命名空间、样本任务引用不存在工具，均产生 issue。提供 `pnpm check:tools` 本地阻断。
6. **执行契约测试**：测试专用 fixture（不进入产品注册表）走通“注册 → 输入校验（TypeBox）→ 适配器执行 → 输出校验”，证明框架可承载未来工具。
7. **i18n 工具命名空间**：`createI18n(locale, extraResources?)` 支持合并 `tools/<id>` 资源，为未来工具包自包含文案预留通道。

不在阶段 4 交付：具体工具的算法与 UI 执行态、任务队列/取消/持久化（阶段 5）、数据库与 Seed 一致性（阶段 7）、CI 阻断与浏览器 E2E（阶段 11）。

## 3. 口径变更与决策

| 编号 | 决定 | 理由 |
| --- | --- | --- |
| D19 | 工具可用性改为三态：`preview`（可见、不可执行、标注未实现）、`implemented`（可执行）、`disabled`（不可直达，404）。取代当前 `enabled: boolean`。 | 用户选择“标记为预览”；需要保留样本展示同时不谎称可用。 |
| D20 | 预览页返回 200，但输出 `robots noindex` 且不进入 Sitemap；`disabled` 仍返回 404。 | 保证 Sitemap 只含可索引的真实页面；预览页可被产品内部导航访问。 |
| D21 | 导航、首页、分类页、搜索结果可以展示预览工具，但必须显示“预览”标识；搜索结果与卡片不得把预览工具描述成可执行。 | 用户选择预览语义；避免与阶段 3“只展示已实现工具”口径冲突，按新口径显式覆盖。 |
| D22 | 注册表是工具存在性、分类、展示元数据、可用性的唯一来源；`app-core` 保留分类定义、样本任务与 i18n。未来 `packages/tool-*` 通过 `createToolRegistry(implementedTools)` 注入，工具包不进入默认注册表。 | 用户选择“注册表唯一来源”；避免目录与实现漂移，同时保持 `tool-* → app-core` 的依赖方向。 |
| D23 | 阶段 4 不发布真实工具；执行契约由测试 fixture 覆盖，执行 UI 在首个真实工具设计时落地。 | 用户要求“先框架后工具”；避免为不存在的能力编写推测性 UI。 |

## 4. 冻结接口

### 4.1 共享类型（`packages/contracts/src/tool-registry.ts`）

```ts
import type { ToolCategory, ToolDefinition } from './tool.js';
import type { TSchema } from 'typebox';

export const TOOL_AVAILABILITIES = ['preview', 'implemented', 'disabled'] as const;
export type ToolAvailability = (typeof TOOL_AVAILABILITIES)[number];

export interface LocalizedText {
  'zh-CN': string;
  en: string;
}

export interface ToolPreviewContent {
  inputLabel: LocalizedText;
  sampleInput: LocalizedText;
  workspaceTitle: LocalizedText;
  workspaceLines: readonly { label: LocalizedText; value: string }[];
}

export interface ToolCatalogMetadata {
  id: string;                 // 稳定 kebab-case，同时作为 routeKey
  category: ToolCategory;
  icon: string;
  order: number;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText; // SEO
  preview: ToolPreviewContent;
}

export interface PreviewRegistryEntry {
  availability: 'preview';
  metadata: ToolCatalogMetadata;
}

export interface ImplementedRegistryEntry {
  availability: 'implemented';
  metadata: ToolCatalogMetadata;
  definition: ToolDefinition<TSchema, TSchema>;
  resources: Partial<Record<'zh-CN' | 'en', Record<string, Record<string, string>>>>;
}

export interface DisabledRegistryEntry {
  availability: 'disabled';
  metadata: ToolCatalogMetadata;
}

export type RegistryEntry =
  | PreviewRegistryEntry
  | ImplementedRegistryEntry
  | DisabledRegistryEntry;
```

`ToolDefinition` 仍来自 `tool.ts`；本阶段不修改其形状，`TOOL_CONTRACT_VERSION` 保持 1。

### 4.2 注册表（`packages/app-core/src/registry/**`）

```ts
export interface ToolRegistry {
  readonly entries: readonly RegistryEntry[];
  listTools(): readonly RegistryEntry[];
  listVisibleTools(): readonly RegistryEntry[];      // preview + implemented
  listImplementedTools(): readonly ImplementedRegistryEntry[];
  findTool(toolId: string): RegistryEntry | undefined;
  findVisibleTool(toolId: string): RegistryEntry | undefined;
  listVisibleByCategory(categoryId: CategoryId): readonly RegistryEntry[];
  searchVisible(query: string, locale: Locale): readonly RegistryEntry[];
  listSitemapPaths(locale: Locale): readonly string[]; // 首页 + 分类 + implemented 工具
}

export function createToolRegistry(
  implemented: readonly ImplementedRegistryEntry[],
): ToolRegistry;

/** 默认注册表：仅预览条目，无 implemented。 */
export const toolRegistry: ToolRegistry;

// 兼容现有调用点的便捷导出，均委托默认注册表
export function listTools(): readonly RegistryEntry[];
export function listVisibleTools(): readonly RegistryEntry[];
export function findTool(toolId: string): RegistryEntry | undefined;
export function findVisibleTool(toolId: string): RegistryEntry | undefined;
export function listVisibleByCategory(categoryId: CategoryId): readonly RegistryEntry[];
export function searchVisibleTools(query: string, locale: Locale): readonly RegistryEntry[];
export function listSitemapPaths(locale: Locale): readonly string[];
export function isPreviewEntry(entry: RegistryEntry): entry is PreviewRegistryEntry;
```

`SAMPLE_TASKS` 保留在 app-core，`toolId` 必须能在默认注册表找到且不是 `disabled`；由校验函数检查。

### 4.3 校验

```ts
export type RegistryIssueCode =
  | 'duplicate-id'
  | 'duplicate-route-key'
  | 'invalid-category'
  | 'missing-translation'
  | 'preview-with-definition'
  | 'implemented-without-definition'
  | 'implemented-without-namespace'
  | 'invalid-contract-version'
  | 'sample-task-missing-tool'
  | 'sample-task-disabled-tool';

export interface RegistryIssue {
  code: RegistryIssueCode;
  toolId?: string;
  detail: string;
}

export function validateToolRegistry(
  entries: readonly RegistryEntry[],
  sampleTasks: readonly SampleTask[],
): readonly RegistryIssue[];
```

`pnpm check:tools` 执行 `scripts/check-tool-registry.mjs`：加载 `@itools/app-core` 构建产物，校验默认注册表与样本任务，存在 issue 时非零退出。它**不纳入 `pnpm lint`**：脚本依赖 `dist`，而 lint 不保证先构建；请先 `pnpm build` 或 `pnpm --filter @itools/app-core build`，再运行 `pnpm check:tools`。CI 接入（阶段 11）时应在构建之后执行。

### 4.4 页面与路由规则

| 可用性 | 路由解析 | HTTP | Sitemap | 导航/搜索 | 页面行为 |
| --- | --- | --- | --- | --- | --- |
| `implemented` | tool 路由 | 200 | 包含 | 展示 | 可执行（本阶段无实例） |
| `preview` | tool 路由 | 200 | 排除 | 展示 + “预览”标识 | 只读样本，输入禁用，任务/结果区说明未实现 |
| `disabled` | not-found | 404 | 排除 | 不展示 | 404 页面 |

SEO：`preview` 页追加 `robots noindex`；canonical/hreflang 仍生成。`buildAppPath` 不再为 `disabled` 工具生成路径。

### 4.5 i18n

- 新增通用键：`common:availability.preview`（“预览”/“Preview”）、`common:availability.unavailable`（“暂不可用”/“Unavailable”）。
- `createI18n(locale, extraResources?)`：可选参数，浅合并到内置资源；现有调用不需要修改。
- 预览工具页文案放在 `catalog` 命名空间（属于站点框架，不属于工具实现）。

## 5. 文件所有权草案（确认后派发）

| 范围 | 归属 |
| --- | --- |
| `packages/contracts/src/tool-registry.ts`、`contracts.test.ts` 补充 | 根 Agent |
| `packages/app-core/src/registry/**`（含预览条目迁移、校验、查询、测试） | Agent R1 |
| `packages/app-core/src/catalog/**` 移除工具数据，仅保留分类；`index.ts` 调整 | Agent R2（与 R1 边界冻结） |
| `packages/app-core/src/i18n/**` 预览键 + `extraResources` | Agent R2 |
| `apps/web` 路由/Sitemap/SEO/导航/卡片/工具页/测试 | Agent W1、W2（按页面与壳层拆分，零重叠） |
| `scripts/check-tool-registry.mjs`、根 `package.json` | 根 Agent |
| 文档与验收 | 根 Agent |

## 6. 验收矩阵

| 项 | 现在 | 延后 |
| --- | --- | --- |
| 注册表结构、三态可用性、唯一 ID/routeKey | ✅ 单测 + `check:tools` | CI 阻断（阶段 11） |
| 预览工具在导航/搜索/分类/首页可见且带标识 | ✅ 组件测试 | — |
| 预览工具页 200 + noindex + 不可执行 | ✅ SSR HTTP + 组件测试 | — |
| 停用工具 404、不进 Sitemap | ✅ | 数据库状态（阶段 7） |
| Sitemap/搜索/分类只含可见工具，Sitemap 只含 implemented | ✅ | — |
| 注册表校验负向用例（重复 ID 等） | ✅ | CI（阶段 11） |
| 执行契约（校验→执行→输出校验） | ✅ 测试 fixture | 真实工具（下一轮） |
| 统一工具页区块顺序与预览错误状态 | ✅ 组件测试 | Playwright（阶段 11） |
| SEO：预览页 noindex、canonical 保留 | ✅ `seo.test.ts` + HTTP | — |
| 任务队列/取消/持久化 | — | 阶段 5 |
| Seed/数据库一致性 | — | 阶段 7 |

## 7. 风险

- 预览工具从“可点击样本”变成“带预览标识的只读页”，视觉与文案需要同步调整；旧截图与测试断言会失效。
- `enabled` → `availability` 是跨包字段变更，web 约 20 个文件需要同步；必须一次性完成，避免半迁移状态。
- Sitemap 会暂时只剩首页与 5 个分类（没有 implemented 工具），属于预期结果，不是回归。
- `createI18n` 的可选参数必须保持向后兼容；不得改变现有资源结构。
- 校验脚本在 CI 之前只能本地阻断，不能声称“已接入 CI”。

## 8. 等什么

请确认开始实施。确认后按第 5 节派发 Agent，实施完成后输出 `docs/24-stage-4-acceptance.md` 并更新 README、docs/14、docs/19。
