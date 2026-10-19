# 19 · 新 Agent 快速接手

> 状态：截至 2026-10-19，阶段 0–4 均有验收记录；阶段 4（全局框架、三态注册表、预览状态）已完成。**没有可执行工具**，首个真实工具与执行 UI 尚未设计。阶段 5 尚未开始，启动前须由用户确认范围。本文用于恢复工作上下文，不构成启动新功能的授权。

## 阅读顺序

1. 根目录 [README.md](../README.md)：仓库索引与项目状态。
2. 本指南：现状、边界和接手规则。
3. [阶段 4 冻结](23-stage-4-freeze.md) 与 [阶段 4 验收](24-stage-4-acceptance.md)：当前注册表、三态可用性、预览页规则与证据。
4. [阶段 3 冻结](20-stage-3-routing-ssr-i18n-seo.md) 与 [验收](21-stage-3-acceptance.md)：SSR、路由、i18n、SEO 的依据。
5. 根据任务阅读 `docs/00`–`15` 的架构要求、产品决定和阶段计划；它们是规划基线，不是已实现能力。

不要把规划文档中的目标能力当作当前功能。若权威决策来源或验收口径不清，记录为未决并交由根 Agent/用户裁定。

## 当前状态

- 工作区有五个包：`apps/web`、`apps/server`、`packages/app-core`、`packages/contracts`、`packages/design-system-adapter`。
- 已实现：Fastify SSR、`/{locale}` 路由、中英双语、真实 404、SSR SEO head、Sitemap/robots、语言切换、三态工具注册表与预览页规则。
- 默认注册表 7 条：6 个 `preview`（可见、不可执行、带“预览”标识）+ 1 个 `disabled`（404）；`implemented` 为 0，因此 Sitemap 只有首页与 5 个分类。
- 没有真实工具执行、任务运行时、IndexedDB、数据库、认证、PWA、CI 或部署。预览页输入禁用，任务区/结果区只显示“未实现”说明。
- 最近一次全量验证：format、lint、typecheck、test（139 项）、build、`check:tools` 通过；生产 HTTP 验收 28/28。证据见 [阶段 4 验收](24-stage-4-acceptance.md)。

## 入口与职责

| 入口 | 职责 | 工作边界 |
| --- | --- | --- |
| `apps/server/src/index.ts` | 服务端启动、dev/prod 渲染器组装、优雅关闭。 | 不承载页面或目录逻辑。 |
| `apps/server/src/app.ts` | Fastify 路由、SSR 注入、静态资源、Sitemap/robots、缓存头。 | 只依赖 `SsrRenderer` 契约，不导入 web/app-core。 |
| `apps/server/src/renderer/dev.ts` | Vite middleware + `ssrLoadModule`。 | 开发专用。 |
| `apps/server/src/renderer/prod.ts` | 加载 `dist/server/entry-server.js` 与 `dist/client/index.html`。 | 生产专用。 |
| `apps/web/src/entry-server.tsx` | `render()`、`listSitemapUrls()` 与语言常量。 | SSR 唯一渲染入口。 |
| `apps/web/src/entry-client.tsx` | `hydrateRoot` 与初始 locale/route。 | 浏览器唯一入口。 |
| `apps/web/src/app/route.ts` | URL 解析与规范路径生成。 | 内存状态已移除，URL 是唯一来源。 |
| `apps/web/src/app/navigation.tsx` | `AppNavigation` 上下文（navigate / switchLocale / openSearch）。 | 页面不得直接操作 `history`。 |
| `apps/web/src/app/seo.ts` | title/description/canonical/hreflang/noindex。 | 渲染器负责转义。 |
| `packages/app-core/src/registry/**` | 三态注册表、预览条目、校验、查询/搜索/Sitemap 路径。 | 不依赖 React/DOM；不发布真实工具。 |
| `packages/app-core/src/catalog/**` | 分类定义、样本任务。 | 不再保存工具副本。 |
| `packages/app-core/src/i18n/**` | 5 个命名空间的中英资源、`createI18n(locale, extraResources?)`。 | 资源聚合入口 `resources/index.ts` 由根 Agent 维护。 |
| `packages/contracts/src/tool-registry.ts` | 三态可用性、注册表条目类型。 | 纯类型/守卫。 |
| `packages/contracts/src/{locale,ssr}.ts` | 语言集合与 SSR 渲染契约。 | 纯类型/守卫，不含运行时服务。 |
| `scripts/check-tool-registry.mjs` | `pnpm check:tools`：注册表结构校验。 | 需先构建 app-core。 |
| `scripts/verify-stage-4.mjs` | 生产产物 HTTP 验收。 | 需先 `pnpm build`。 |

## 常用命令

从仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm dev                 # 先构建 contracts/app-core/adapter，再启动 Fastify + Vite middleware
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:tools         # 需先构建 app-core
node scripts/verify-stage-4.mjs
```

- `pnpm dev` 默认监听 `127.0.0.1:5173`；`/` 会 302 到 `/zh-CN`。
- 生产模式：`pnpm build` 后在 `apps/server` 目录运行 `NODE_ENV=production node dist/index.js`。环境变量：`HOST`、`PORT`、`SITE_ORIGIN`、`WEB_ROOT`。
- 服务端 dev 脚本使用 `node --watch-path=./src`；**不要把监听范围扩到全仓库**，Vite 写入 `node_modules/.vite` 会导致无限重启。
- `verify-stage-3.mjs` 是阶段 3 历史脚本，阶段 4 起不再通过，不要用它做门禁。
- 全新克隆先 `pnpm install`（`pnpm-workspace.yaml` 已允许 esbuild 构建脚本），再 `pnpm build`。

## 未决事项与下一阶段门槛

阶段 5（任务运行时）尚未启动；也可先设计首个真实工具。开始前须由用户确认优先级：

1. 若先做真实工具：需要确认工具清单与执行 UI 形态；注册表已预留 `implemented` 条目与 `createToolRegistry()` 注入点。
2. 若进入阶段 5：冻结任务状态机、FIFO/资源预算、Worker 协议与取消策略；预览页的任务区/结果区届时替换为真实状态。
3. D01（IndexedDB 清库与长期保留）仍须在阶段 6 前解决；D02/D03/D04/D05 按对应阶段处理。
4. 阶段 4 遗留：CI 接入 `check:tools`（阶段 11）、Playwright 水合与 E2E（阶段 11）、包体优化与性能预算（阶段 11）、预览徽标在导航中的无障碍等价文本。
5. 工具清单与汇率工具第 68/69 题仍未确定，不得替用户决定。

## Agent 协作与文件所有权

- 根 Agent 负责规划、跨模块接口裁决、集成、验收和冲突处理；实施 Agent 只在明确派发的文件范围内工作。派发内容需写明目标、禁止事项、文件所有权、依赖/冻结接口和验收标准。
- 共享工作目录中不可假设自己独占代码库；先看 `git status` 和当前 diff，不覆盖或撤销他人修改。不同 Agent 不并行改同一契约，除非根 Agent 已协调。
- 当前协作约定由根 Agent（Deepseek-V4.1-Flash High）负责规划、接口裁决、集成和验收，实施 Agent（Deepseek-V4.1-Flash High）负责获派范围内的实现与对应检查。模型选择及推理强度按当前任务的明确指示或协作约定执行。
- Agent 可在获派范围内实现、修复、写文档并运行要求的检查；不得伪报未执行的验证。生产部署、生产迁移、破坏性数据操作和公网安全配置变更遵循 `docs/12`、`docs/15` 的审批边界。
- 契约、产品范围或阶段顺序若需变更，先记录原因、影响、迁移、验证和回滚方案，交根 Agent/用户审阅；未确认前不把提案写成决定。

## 接手后第一步

从用户当前任务开始，只做其明确范围内的工作。若任务要求进入阶段 5 或设计首个真实工具，先完成上文的确认与接口冻结；用户未确认前不新增真实工具、不接入任务运行时，也不改动已验收的注册表三态与预览页口径。
