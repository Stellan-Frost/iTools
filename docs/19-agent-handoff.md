# 19 · 新 Agent 快速接手

> 状态：截至 2026-10-19，阶段 2 预览已有验收记录；阶段 3 尚未开始，须等待用户确认下一步及 D06 验收顺序。本指南用于恢复工作上下文，不构成启动新功能的授权。

## 阅读顺序

1. 根目录 [README.md](../README.md)：仓库索引与项目状态。
2. 本指南：现状、边界和接手规则。
3. 根据任务阅读 `docs/00`–`15` 中相关的架构要求、产品决定和阶段计划。它们是规划基线；若与现代码看起来不同，先判断是尚未实施还是实际冲突。
4. 阅读对应模块 README 和源码，再查看 [当前审计](16-stage-0-audit.md)、[工作区与契约](17-stage-1-workspace.md)、[阶段 2 设计与验收](18-stage-2-design-system.md)。历史决策和代码变化用 Git 历史追溯。

不要把规划文档中的目标能力当作当前功能。若权威决策来源或验收口径不清，记录为未决并交由根 Agent/用户裁定。

## 当前状态

- 工作区内有三个包：`packages/contracts`、`packages/design-system-adapter`、`apps/web`。
- 阶段 0 最初是纯文档审计；阶段 1 建立 workspace 与共享契约；阶段 2 建立 MD3 适配层和浏览器界面预览。
- web 当前使用内存路由/主题状态与静态样例目录、任务、结果和管理数据。
- 没有 SSR、数据库、真实工具执行、任务运行时、持久化、认证、PWA、CI 或部署实现。
- 阶段 2 既有记录为 22 项测试通过（contracts 4、adapter 9、web 9）；build、lint、typecheck、format、peer 检查也有既有通过记录。它们不是本轮重跑。最终验收截图 4 张见 `docs/assets/stage-2/`，阶段说明见 `docs/18-stage-2-design-system.md`。

## 入口与职责

| 入口                                            | 职责                                                | 工作边界                         |
| ----------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| `apps/web/src/main.tsx`                         | 浏览器入口，导入适配层全局样式并挂载 React。        | 当前为 `createRoot` 客户端渲染。 |
| `apps/web/src/App.tsx`                          | 应用壳、当前页选择、内存主题和搜索开关。            | 不是完整 URL 路由或持久化状态。  |
| `apps/web/src/app/route.ts`                     | 前端展示用 `AppRoute` 联合类型。                    | 不处理 SSR、真实 404 或 URL。    |
| `apps/web/src/data/sample-catalog.ts`           | 预览用样例目录数据。                                | 不是真实注册表或数据库 Seed。    |
| `packages/design-system-adapter/src/index.ts`   | 适配器公开组件入口。                                | Web 基础 UI 经此包导入。         |
| `packages/design-system-adapter/src/styles.css` | 适配器全局样式入口。                                | 从 Web `main.tsx` 导入一次。     |
| `packages/contracts/src/index.ts`               | API、资产、环境、任务、工具契约公开入口。           | 形状和类型，不包含运行时服务。   |
| `scripts/check-boundaries.mjs`                  | 校验 workspace manifest 中 `@itools/*` 依赖白名单。 | 不扫描源码 import。              |
| `scripts/run-turbo.mjs`                         | 运行本地 Turbo，并关闭遥测。                        | 根 build/test/typecheck 使用。   |

## 常用命令

从仓库根目录按需要执行；新增依赖或准备验证时先查看根 `package.json`、锁文件与包脚本。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:boundaries
```

根 `lint` 同时运行 ESLint 与 workspace manifest 边界检查；后者不验证所有源码导入。根脚本没有 `peers check`。以上是当前可用操作说明，不表示本指南编写期间执行过这些命令。

## 未决事项与下一阶段门槛

阶段 3 仍待用户确认启动。开始实施之前：

1. 先冻结阶段 3 所需的目录查询、任务、资产和数据库适配接口，并明确每个接口的归属与依赖。
2. 解决 D06 的验收顺序冲突。阶段 3/4 的数据库启用状态、Seed/数据库一致性和结果持久化验收依赖阶段 5–7 的能力；原审计提出将可独立验证部分前置、完整集成验收移至阶段 7 后，但这只是建议，尚未获用户确认。将确认后的顺序写回路线图和验收文档后再执行。
3. 按相关阶段处理其他未决项：D01（IndexedDB 结构迁移/清理与长期保留）、D02（缓存清除后下载失败恢复）、D03（CDN 缓存与停用工具/真实 404）、D04（安全告警门禁分级）、D05（唯一管理员仍需实现）、D07（缺失的历史 `10-subagent` 来源记录）。D01 在阶段 6 触及破坏性数据处理前必须解决。

阶段 3 SSR 评估至少要覆盖当前实现带来的迁移问题：`apps/web/src/main.tsx` 使用 `createRoot`，不是 `hydrateRoot`；`App.tsx` 内的 `AppRoute` 仅为内存状态，没有 URL 同步；`use-compact-viewport.ts` 读取 `window`/`matchMedia`，需明确服务端渲染与 hydration 策略；`m3-expressive-react` 的 SSR 兼容性需要通过实际验证。当前源码未见 `fetch`、`localStorage` 或 `indexedDB` 使用。这些是待评估事项，不是预先确定的实现方案。

性能阈值、工具清单、缓存 TTL 等须由对应阶段调研或测量；汇率工具第 68、69 题继续暂缓。不要在不相关工作中静默替用户决定这些事项。

## Agent 协作与文件所有权

- 根 Agent 负责规划、跨模块接口裁决、集成、验收和冲突处理；实施 Agent 只在明确派发的文件范围内工作。派发内容需写明目标、禁止事项、文件所有权、依赖/冻结接口和验收标准。
- 共享工作目录中不可假设自己独占代码库；先看 `git status` 和当前 diff，不覆盖或撤销他人修改。不同 Agent 不并行改同一契约，除非根 Agent已协调。
- 模型和推理强度服从当前任务/主 Agent 的明确设置；历史 `docs/12` 中的模型名称只是当时协作约定，不能覆盖当前运行设置。
- Agent 可在获派范围内实现、修复、写文档并运行要求的检查；不得伪报未执行的验证。生产部署、生产迁移、破坏性数据操作和公网安全配置变更遵循 `docs/12`、`docs/15` 的审批边界。
- 契约、产品范围或阶段顺序若需变更，先记录原因、影响、迁移、验证和回滚方案，交根 Agent/用户审阅；未确认前不把提案写成决定。

## 接手后第一步

从用户当前任务开始，只做其明确范围内的工作。若任务要求进入阶段 3，先完成上文的确认和接口冻结门槛；用户未确认前，不启动阶段 3 或添加真实功能。
