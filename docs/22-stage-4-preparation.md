# 22 · 阶段 4 准备：工具注册表与统一工具页（待确认）

> 状态：2026-10-19 准备稿。用户已就三个问题作出决定，最终口径与实施结果见 [23 · 冻结](23-stage-4-freeze.md) 与 [24 · 验收](24-stage-4-acceptance.md)。本文保留问题分析与备选方案，供追溯。

## 1. 阶段 4 目标（来自 docs/14）

- 代码注册表、能力声明、输入/输出 Schema、执行适配器、错误映射与双语文案键。
- 工具页统一骨架：输入校验、参数区、任务区、结果区、开源致谢。
- 注册表、Seed、数据库一致性检查。
- 至少一个测试工具完整通过注册、路由、输入校验、执行、结果展示。
- 重复 ID、非法路由、不兼容能力声明会阻断检查。
- 工具页统一区块顺序与错误状态通过 E2E。

## 2. 现状与依赖冲突

| 阶段 4 要求 | 当前状态 | 冲突 |
| --- | --- | --- |
| 代码注册表 | `packages/contracts/src/tool.ts` 只有形状；无注册表实现 | 可直接实施 |
| 执行适配器 / 进度 / 取消 | `ToolAdapter` 已定义，`CancellationToken` 已有；无任务运行时 | 真正的队列、状态机、取消确认属于阶段 5 |
| 工具页输入校验与结果 | 页面仍是样本区，输入不校验、结果不产生 | 可直接实施（页面内同步执行） |
| Seed / 数据库一致性 | 没有数据库与 Seed | 属于阶段 7，必须按 D06 延后 |
| 重复 ID / 非法路由阻断 CI | 没有 CI | 阶段 11；现在只能做本地脚本 + 测试 |
| 工具页 E2E | 没有 Playwright | 阶段 11；现在用 Vitest + SSR HTTP 集成测试 |

结论：阶段 4 必须像阶段 3 一样拆分验收顺序，否则无法完成。

## 3. 三个待决问题

### Q1 首个真实工具选哪个？

| 选项 | 说明 | 代价 |
| --- | --- | --- |
| A. `json-formatter`（推荐） | 纯文本输入、TypeBox 校验、同步执行、结果可复制；无第三方依赖、无 Worker、无文件资产 | 最小，能覆盖注册/校验/执行/结果全链路 |
| B. `text-diff` | 纯文本，但需要 diff 算法或依赖，结果呈现更复杂 | 中等 |
| C. `markdown-preview` | 需要 Markdown 解析依赖与 HTML 安全策略 | 较大，会牵出 CSP/XSS 议题 |
| D. 本轮不做真实执行 | 只建注册表与契约测试 | 不满足阶段 4 的“执行/结果”验收，需要明确降级 |

推荐 A：`id: json-formatter`、`category: text`、`routeKey: json-formatter`，与 `contracts` 现有测试样例一致。

### Q2 其余 5 个样本工具如何处置？

阶段 3 的验收口径是“目录、搜索、Sitemap 只展示实现存在且启用的工具”。注册表落地后，没有实现的样本工具不能再显示为可用工具：

| 选项 | 说明 | 影响 |
| --- | --- | --- |
| A. 停用（推荐） | 其余样本 `enabled: false`，不进导航/搜索/Sitemap，直达 404 | 站点暂时只剩 1 个工具，但规则自洽 |
| B. 标记为“预览” | 新增 `implementationStatus: 'preview'`，仍展示但标注未实现 | 需要修改阶段 3 的可用性口径，并新增 UI 状态 |
| C. 全部实现 | 本轮补齐 6 个工具 | 工具清单未定，范围失控，不建议 |
| D. 继续保留样本可点击 | 不做区分 | 与阶段 3 验收和“数据库不得启用不存在工具”冲突 |

推荐 A；如果产品上不能接受空目录，选 B 需要你明确批准改口径。

### Q3 阶段 4 的验收顺序（延续 D06）

建议确认：

1. 现在验收：注册表结构、重复 ID/路由冲突/能力声明校验、`json-formatter` 的注册→路由→校验→执行→结果、工具页统一骨架与错误状态、SSR 集成测试。
2. 延后到阶段 7：Seed/数据库一致性、数据库启用状态校验。
3. 延后到阶段 11：CI 阻断、Playwright 浏览器 E2E。
4. 延后到阶段 5：任务队列、状态机、全局并发预算、取消确认、结果持久化。阶段 4 的 `json-formatter` 用页面内同步执行，明确标注“不经过任务运行时”。

## 4. 拟冻结接口（草案，确认后定稿）

### 4.1 工具包

```ts
// packages/tool-json-formatter/src/index.ts
import type { ToolDefinition } from '@itools/contracts';

export const jsonFormatterDefinition: ToolDefinition<
  typeof JsonFormatterInputSchema,
  typeof JsonFormatterOutputSchema
>;

export const jsonFormatterMetadata: {
  id: 'json-formatter';
  category: 'text';
  icon: string;
  order: number;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
};

export const jsonFormatterResources: {
  'zh-CN': { 'tools/json-formatter': Record<string, string> };
  en: { 'tools/json-formatter': Record<string, string> };
};
```

### 4.2 注册表聚合包

```ts
// packages/tool-registry/src/index.ts
export interface RegisteredTool {
  readonly definition: ToolDefinition<TSchema, TSchema>;
  readonly metadata: ToolMetadata;       // 展示元数据，替代 app-core 中对应条目
  readonly resources: ToolResources;     // tools/<id> 命名空间
}
export const TOOL_REGISTRY: readonly RegisteredTool[];
export function findRegisteredTool(toolId: string): RegisteredTool | undefined;
export function validateToolRegistry(tools: readonly RegisteredTool[]): RegistryIssue[];
export function listToolNamespaces(): Record<Locale, Record<string, unknown>>;
```

`RegistryIssue` 至少包含：`duplicate-id`、`duplicate-route-key`、`category-mismatch`、`missing-translation`、`invalid-contract-version`、`empty-input-schema`。

### 4.3 目录与注册表的关系

- 注册表是“工具是否存在、是否可执行”的唯一来源。
- 工具展示元数据（名称/简介/描述/图标/排序）跟随工具包，不再由 `app-core/catalog` 复制一份。
- `app-core/catalog` 只保留分类、排序与样本任务；工具列表改为由注册表派生（web 侧组合）。
- 未实现工具不再进入注册表，因此不会出现在导航、搜索或 Sitemap。

这是阶段 4 最大的重构点，也是消除“目录与实现漂移”的唯一干净方案。若选择保留样本预览，则注册表需要额外的 `preview` 状态，属于口径变更。

### 4.4 i18n 资源合并

`@itools/app-core` 的 `createI18n(locale)` 增加可选的额外资源参数（向后兼容），web 在创建实例时合并 `listToolNamespaces()`；工具文案使用 `tools/<tool-id>` 命名空间，符合 `docs/02`。

## 5. 文件所有权草案（确认后细化）

| 范围 | 归属 |
| --- | --- |
| `packages/tool-json-formatter/**` | Agent T1 |
| `packages/tool-registry/**` + `scripts/check-tool-registry.mjs` + 根脚本 | Agent T2 |
| `packages/contracts`（注册表类型/校验错误码） | 根 Agent |
| `apps/web` 工具页输入/结果/错误状态 + 路由/目录派生 | Agent T3 |
| `packages/app-core` 目录裁剪与 i18n 合并参数 | Agent T4（与 T2 边界需冻结） |
| 文档与验收 | 根 Agent |

## 6. 验收矩阵草案

| 项 | 现在可验证 | 延后 |
| --- | --- | --- |
| 注册表存在且结构合法 | ✅ 单测 + `check:tools` | — |
| 重复 ID / routeKey / 分类不一致 / 缺翻译 | ✅ 负向测试 | CI 阻断（阶段 11） |
| `json-formatter` 注册→路由→校验→执行→结果 | ✅ 组件测试 + SSR HTTP | 浏览器 E2E（阶段 11） |
| 工具页统一区块顺序与错误状态 | ✅ 组件测试 | Playwright（阶段 11） |
| 未注册/停用工具 404 且不进 Sitemap | ✅ HTTP | 数据库状态（阶段 7） |
| 任务排队/取消/持久化 | — | 阶段 5 |
| Seed / 数据库一致性 | — | 阶段 7 |

## 7. 风险

- 若选择 Q2-B（预览状态），需要修改阶段 3 的“只展示已实现工具”口径，并增加 UI 文案与状态，影响 Sitemap/搜索规则。
- 工具元数据迁移到工具包后，`app-core/catalog` 的查询函数签名会变化，web 的 `route.ts`、Sitemap、页面测试都要同步改。
- 注册表校验脚本目前只能本地运行；没有 CI 前，“阻断合并”无法真正实现。
- `json-formatter` 的结果区与阶段 5 的任务状态区可能重复；阶段 4 页面需明确“同步执行、无任务队列”的标注，避免把样本任务状态当作真实运行。

## 8. 等什么

需要你确认：Q1 工具选择、Q2 样本处置、Q3 验收顺序。确认后我会输出 `docs/23-stage-4-freeze.md`（冻结接口、文件所有权、派发计划），再开始实施。
