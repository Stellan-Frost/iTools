# 03 · 工具注册契约与工具页

> 定位：把「工具如何登记、如何生成 URL、页面展示什么、SEO 如何判定」收敛为一份可执行契约。
> 状态：部分实现（阶段 4 完成契约、三态注册表、路由/SEO、预览页骨架与校验；`implemented = 0`，缺首个真实工具、注册表注入点、已实现页分支与执行 UI）。
> 代码入口：`packages/contracts/src/tool.ts`、`packages/contracts/src/tool-registry.ts`、`packages/app-core/src/registry/registry.ts`、`packages/app-core/src/registry/validate.ts`、`apps/web/src/app/route.ts`、`apps/web/src/pages/tool/ToolPage.tsx`、`scripts/check-tool-registry.mjs`。

## 1. 当前事实

| 项 | 当前事实 |
| --- | --- |
| 注册表规模 | 7 条：`preview` 6 条、`implemented` 0 条、`disabled` 1 条（`csv-inspector`）；样本任务 3 条 |
| 默认注册表 | `app-core/src/registry/registry.ts` 导出 `toolRegistry = createToolRegistry([])`，不含任何工具包 |
| 可执行工具 | **0 个**。仓库内没有任何生产代码调用 `definition.adapter.execute`；唯一调用在 `packages/app-core/src/registry/registry.test.ts` 的 fixture |
| Web 注入点 | **不存在**。页面、`route.ts`、`seo.ts`、`entry-server.tsx` 全部直接调用 `@itools/app-core` 的便捷导出（默认注册表） |
| 页面分支 | `ToolPage` 只有预览渲染路径：无论 `availability` 为何，都会渲染 `PreviewNotice`、`PreviewTaskSection`、`PreviewResultSection` |
| 校验入口 | `pnpm check:tools` 只读取 `@itools/app-core` 构建产物里的默认 `toolRegistry`，不读取未来 Web 注入的实例 |
| 构建前置 | `check:tools`、`check:i18n` 都读取 `packages/app-core/dist`；未先 `pnpm build` 会直接失败 |

**注册表条目形状**（`contracts/tool-registry.ts`）：

| `availability` | 必填字段 | 额外约束 |
| --- | --- | --- |
| `preview` | `metadata` | 不得携带 `definition`；可见、只读、200 + noindex |
| `implemented` | `metadata`、`definition`、`resources` | `definition.manifest.contractVersion = 1`；`resources` 必须在两种语言下都有 `translationNamespace` |
| `disabled` | `metadata` | 不得携带 `definition`；不可见、直达 404 |

`metadata`（`ToolCatalogMetadata`）固定包含：`id`、`category`、`icon`、`order`、`name`、`summary`、`description`、`preview`。`name/summary/description` 与 `preview.inputLabel/sampleInput/workspaceTitle` 都是 `LocalizedText = Record<Locale, string>`；`preview.workspaceLines` 是 `{ label: LocalizedText; value: string }[]`。`metadata.preview` 对三态都必填，implemented/disabled 也不能省略。排序固定为 `metadata.order` 升序、同序按 `metadata.id`，`createToolRegistry` 返回冻结数组。

**`ToolManifest` 字段**（`contracts/tool.ts`）：

| 字段 | 取值/类型 | 说明 |
| --- | --- | --- |
| `contractVersion` | 字面量 `1` | 当前唯一支持版本 |
| `id` / `routeKey` | kebab-case，正则 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` | 两者必须一致 |
| `category` | `audio / image / video / text / other` | 同时决定 URL 中的分类段 |
| `icon` | 非空字符串 | Material Symbols 名 |
| `implementationVersion` | 非空字符串 | 工具实现版本 |
| `translationNamespace` | 非空字符串 | 约定为 `tools/<id>` |
| `dependencies` / `requiredBrowserApis` / `supportedFormats` / `resultTypes` | 去重字符串数组 | 声明性字段，当前执行链路尚未消费 |
| `maxInputBytes` / `estimatedMemoryBytes` | 正整数 | 后者用于任务资源预算 |
| `computeClass` | `light / medium / heavy` | 调度声明，当前不参与准入 |

执行契约：`ToolDefinition` = `manifest + inputSchema + outputSchema + adapter`；`ToolAdapter.execute(input, context)` 返回 `Promise<TOutput>`；`context` 提供 `taskId`、`cancellation.throwIfCancellationRequested()`、`reportProgress(progress)`。当前 `adapter.execute` 只在 registry fixture 测试中被调用，生产执行链路尚未接线。

**三态的 HTTP / SEO 行为**：

| `availability` | 可见性 | HTTP | robots | Sitemap |
| --- | --- | --- | --- | --- |
| `preview` | 目录、搜索、卡片可见，必须带“预览”徽标 | 200 | `noindex` | 排除 |
| `implemented` | 可见 | 200 | 可索引 | 包含（当前无实例，页面 implemented 分支未实现） |
| `disabled` | 目录/搜索/导航不可见 | 404 | 错误页 `noindex` | 排除 |

HTML 200 的 `cache-control` 为 `public, max-age=0, must-revalidate`；404 为 `no-store`；Sitemap/robots 为 `public, max-age=300`（D14）。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `packages/contracts/src/tool.ts` | `ToolManifest`、`ToolDefinition`、`ToolAdapter`、`ToolExecutionContext`、`CancellationSignal`、`TOOL_CONTRACT_VERSION = 1` |
| `packages/contracts/src/tool-registry.ts` | `ToolAvailability`、`RegistryEntry` 三态联合、`ToolCatalogMetadata`、`isPreviewEntry`、`isImplementedEntry` |
| `packages/app-core/src/registry/preview-tools.ts` | 6 条 preview + 1 条 disabled 的默认条目；用户可见文案与 preview 样本 |
| `packages/app-core/src/registry/registry.ts` | `createToolRegistry(implemented)`、排序/冻结、查询、搜索、Sitemap 路径、默认 `toolRegistry` |
| `packages/app-core/src/registry/validate.ts` | `validateToolRegistry(entries, sampleTasks)` 与 10 个 issue code |
| `packages/app-core/src/catalog/**` | 固定分类 `audio/image/video/text/other` 与 `SAMPLE_TASKS`，不再承载工具身份 |
| `apps/web/src/app/route.ts` | `parseAppPath` 解析 URL、`buildAppPath` 生成规范路径；404 判定 |
| `apps/web/src/app/seo.ts` | title/description/canonical/hreflang/noindex；preview 与 implemented 的索引差异 |
| `apps/web/src/pages/tool/ToolPage.tsx` | 工具页六段骨架与预览分支 |
| `apps/web/src/pages/tool/ToolInputSection.tsx` | 只读禁用输入框，展示 `metadata.preview.sampleInput` |
| `apps/web/src/pages/tool/ToolPreviewSections.tsx` | 主工作区样本、任务区“尚未实现”、结果区“尚未实现” |
| `scripts/check-tool-registry.mjs` | 构建后校验默认注册表与样本任务；输出三态计数 |
| `scripts/verify-stage-4.mjs` | 28 项 HTTP 验收：200/404、noindex、Sitemap、robots、缓存头 |

## 3. 必须遵守的规则

| # | 规则 | 可检查点 |
| --- | --- | --- |
| 1 | 工具身份、分类、可用性、展示元数据只能写在 `app-core/src/registry/**` 或注入的 `ImplementedRegistryEntry`；不得在页面、数据库 Seed、i18n 资源里另建副本 | `validate.ts` 的 `duplicate-id` / `duplicate-route-key`；`check-boundaries.mjs` + `check-import-boundaries.mjs` 禁止越界依赖 |
| 2 | `availability` 只能是 `preview`、`implemented`、`disabled`；`disabled` 不属于可见集合 | `contracts/tool-registry.ts` 的 `TOOL_AVAILABILITIES`；`registry.ts:47-49` 过滤 `disabled` |
| 3 | `implemented` 条目必须同时携带 `definition` 与 `resources`，且 `translationNamespace` 在 `zh-CN`、`en` 两套资源中都存在 | `validate.ts:85-128`；`check:tools` 的 `implemented-without-definition` / `implemented-without-namespace` |
| 4 | `manifest.contractVersion` 必须等于 `TOOL_CONTRACT_VERSION`（当前 1）；`manifest.routeKey` 必须等于 `metadata.id` | `validate.ts:104-110`、`validate.ts:167-173` |
| 5 | 所有工具 URL 必须经 `buildAppPath` 生成、经 `parseAppPath` 解析；不得手写 `/{locale}/{category}/{toolId}` 字符串 | `apps/web/src/app/route.ts`；`route.test.ts` 覆盖路径与 404 |
| 6 | 工具路径必须包含分类；分类不匹配、分类不存在、工具不存在、工具停用、语言非法、路径段数不为 1 或 2，一律真实 404，不做重定向 | `parseAppPath` 的 `NOT_FOUND_ROUTE` 分支；`verify-stage-4.mjs` 的 404 检查 |
| 7 | `preview` 页返回 200 且 `noindex`，不进 Sitemap；`implemented` 页可索引并进 Sitemap；`disabled` 页 404 且 `no-store` | `seo.ts:58-67`；`registry.ts:104-117`；`app.ts` 的缓存头；`verify-stage-4.mjs` |
| 8 | 工具页固定六段顺序；预览态输入只读、任务区与结果区只能说明“尚未实现”，不得伪造进度或结果 | `ToolPage.tsx`、`ToolInputSection.tsx`、`ToolPreviewSections.tsx`；`verify-stage-4.mjs` 检查“预览”“尚未实现” |
| 9 | `adapter.execute` 只能由 `@itools/task-runtime` 的执行链路调用；页面/组件不得直接调用，也不得自行 `new Worker` | 全仓 grep `adapter.execute` 只应命中测试 fixture；`check:imports` 禁止 web 越界导入 |
| 10 | 所有用户可见文案必须中英双语、非空，英文中不得出现 CJK 字符；`metadata.preview` 对三态都必填 | `validate.ts:40-83` 的 `missing-translation` |
| 11 | 不得依赖 `createToolRegistry` 做去重或校验：它只合并、排序、冻结，重复 id 会静默覆盖 `byId` | `registry.ts:52-61`；合并前必须调用 `validateToolRegistry` |
| 12 | 新增工具前必须同时解决 Web 注入点与门禁来源；只加工具包、不改查询入口，页面/Sitemap/`check:tools` 会各自看到不同的注册表 | 见 §6 的改动清单；`check-tool-registry.mjs:21-32` |

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 在 `ToolPage` 或按钮事件里直接 `entry.definition.adapter.execute(...)` | 通过 `TaskRuntime.submit` → `TaskRunner` → Worker/执行器调用 adapter；页面只订阅任务快照 |
| 用 `enabled: true/false` 或 `status: 'active'` 表达可用性 | 使用 `availability: preview / implemented / disabled`（D19） |
| 把新工具塞进 `preview-tools.ts` 并把 `availability` 改成 `implemented` | 新建 `@itools/tool-*` 包并导出 `ImplementedRegistryEntry`，由 `createToolRegistry` 注入 |
| 给 `preview` 条目加 `definition`，或给 `implemented` 条目省略 `resources` | 保持联合类型的分支纯净：preview/disabled 只有 `metadata`；implemented 必须有 `definition + resources` |
| 分类不匹配时 301 到正确分类，或停用工具 302 到首页 | 按 D10 直接 404；`buildAppPath` 对停用/未知工具只回首页，不伪造可访问路径 |
| 为了“让预览页可被搜索”去掉 `noindex` 或把 preview 写进 Sitemap | 预览页保持 200 + `noindex`；只有 `implemented` 进入 `listSitemapPaths` |
| 在页面里写死 `/zh-CN/text/json-viewer` 或自己拼分类 | 调用 `buildAppPath(locale, { page: 'tool', toolId })` |
| 只补中文文案，英文先用中文占位 | 两语言都写完整；英文含 CJK 会被 `missing-translation` 阻断 |
| 只改 `apps/web/src/app/registry.ts`，继续让 `route.ts`/`seo.ts`/页面导入 app-core 便捷函数 | 所有查询点统一走同一个注册表实例，否则页面、Sitemap、校验结果不一致 |
| 在未扩展 Web 依赖白名单时直接 `import '@itools/tool-x'` | 先更新 `scripts/check-boundaries.mjs` 与 `scripts/check-import-boundaries.mjs` 的 `@itools/web` 白名单，并补 `apps/web/package.json` |

## 5. 如何验证

```sh
pnpm --filter @itools/app-core build
pnpm check:tools
# 期望：注册表：共 7 条（preview 6、implemented 0、disabled 1），样本任务 3 条。
# 期望：注册表校验通过。

pnpm --filter @itools/app-core test
# 期望：Tests 49 passed（含注册表查询、三态、fixture 执行契约与 10 类负向 issue）

pnpm check:i18n
# 期望：i18n 检查通过：所有资源键都有引用。

pnpm build
node scripts/verify-stage-4.mjs
# 期望：全部 28 项通过（含 preview 200/noindex、disabled 404/no-store、Sitemap 排除 preview/disabled）

pnpm check:boundaries
# 期望：退出码 0，无输出
```

## 6. 常见任务（step-by-step）

### 6.1 新增一个真实工具

1. 新建 `packages/tool-<id>/package.json`，包名 `@itools/tool-<id>`；`pnpm-workspace.yaml` 的 `packages/*` 会自动纳入。依赖只允许 `@itools/contracts`，必要时可加 `@itools/app-core`、`@itools/design-system-adapter`（`check-boundaries.mjs:48-54`）。
2. 在包内实现 `ToolManifest`：`contractVersion: 1`、`id`/`routeKey` 一致、`category` 属于五类、`translationNamespace: 'tools/<id>'`、`icon`、`implementationVersion`、`dependencies`、`requiredBrowserApis`、`supportedFormats`、`maxInputBytes`、`estimatedMemoryBytes`、`computeClass`、`resultTypes`。
3. 实现 `ToolDefinition`：`inputSchema`、`outputSchema`（TypeBox）与 `ToolAdapter.execute(input, context)`；`context` 提供 `taskId`、`cancellation.throwIfCancellationRequested()`、`reportProgress()`。输入/输出校验责任在工具包，当前注册表不代做。
4. 从包入口导出 `ImplementedRegistryEntry`：`availability: 'implemented'`、`metadata`（含双语的 `name/summary/description/preview`）、`definition`、`resources`（`tools/<id>` 命名空间的中英资源）。
5. 新建 `apps/web/src/app/registry.ts`（**待做项**）：`export const toolRegistry = createToolRegistry([entry])`。同时导出一个收集 `resources` 的函数，供 `createI18n(locale, resources)` 使用。
6. 替换所有默认注册表查询点，改为使用 `toolRegistry` 实例：`apps/web/src/app/route.ts`（`findTool`/`findVisibleTool`）、`apps/web/src/app/seo.ts`、`apps/web/src/entry-server.tsx`（`listSitemapPaths`、`createI18n`）、`apps/web/src/pages/{home/HomePage,category/CategoryPage,tool/ToolPage,tasks/TasksPage}.tsx`、`apps/web/src/components/{app-shell/AppShell,app-shell/ToolAccordionNavigation,command-palette/CommandPalette,recent-tasks/RecentTasksPanel}.tsx`。`App.tsx` 的 `createI18n(locale)` 改为传入工具资源。
7. 在 `ToolPage` 增加 `implemented` 分支：预览态保留 `ToolInputSection` + `WorkspaceSample` + `PreviewTaskSection` + `PreviewResultSection`；已实现态改为真实输入、任务区（订阅 `TaskRuntime`）与结果区，只在 `preview` 渲染 `PreviewBadge` 和 `PreviewNotice`。
8. 扩展门禁：`scripts/check-boundaries.mjs` 与 `scripts/check-import-boundaries.mjs` 的 `@itools/web` 白名单加入工具包；`scripts/check-tool-registry.mjs` 的注册表来源必须改为包含注入条目的实例（当前只读 app-core 默认注册表，否则新工具不受 `check:tools` 覆盖）。
9. 补测试后执行：`pnpm build`、`pnpm check:tools`、`pnpm check:i18n`、`node scripts/verify-stage-4.mjs`、`pnpm verify`。Sitemap 应新增 `/{locale}/{category}/{toolId}`；`check:i18n` 当前只扫描 app-core 内置资源与 `apps/web` 源码，工具命名空间资源不在其覆盖内，需另加测试。

## 7. 已知限制与相关决策

- 结构缺口：无 `createToolRegistry([...])` 注入点；`ToolPage` 无 implemented 分支；`check:tools` 只校验默认注册表；`check:i18n` 不校验工具资源；Web 依赖白名单不允许 `@itools/tool-*`。这五项必须在首个工具接入时一起解决。
- `ToolManifestSchema` 已定义，但生产代码没有 `Value.Check(ToolManifestSchema, ...)`；`validateToolRegistry` 只检查 `contractVersion`、`routeKey`、`translationNamespace` 与文案，不校验 `inputSchema`/`outputSchema` 本身。
- `requiredBrowserApis`、`maxInputBytes`、`supportedFormats`、`resultTypes`、`dependencies` 尚未被任何执行链路消费；接入工具时必须自行实现能力检测与输入上限，不得假设框架已代做。
- `createToolRegistry` 只接受 `ImplementedRegistryEntry[]`，不能注入 disabled 条目；disabled 只能写在 `preview-tools.ts`。
- 相关决策：D09（代码注册表为目录来源）、D10（URL 必须含分类，非法即 404）、D13（任务/管理页 noindex）、D14（缓存头）、D19（三态）、D20（preview 200 + noindex、disabled 404）、D21（预览徽标）、D22（注册表唯一来源）、D23（阶段 4 不发布真实工具）、D24（31 条工具清单不改变 `implemented = 0`）、D27（数据库只能下架、不能启用）、D29（后台不得改分类与图标）。
