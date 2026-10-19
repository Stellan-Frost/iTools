# 16 · 阶段 0 现状审计与建设基线

> 日期：2026-10-19。范围：审计当时的本地工作目录 `D:\桌面\iTools-MD3`。本记录是阶段 0 的可审核产物，不代表应用已实现；此后阶段 1 已初始化 Git 并新增代码。

## 目标与实际目录

目标：核对仓库、文档、技术栈与依赖关系，登记尚未解决的冲突，为阶段 1 提供明确的起点。

```text
iTools-MD3/
├── README.md
└── docs/
    ├── 00-architecture-overview.md
    ├── 01-design-system.md
    ├── 02-app-routing-i18n-seo.md
    ├── 03-tool-contract.md
    ├── 04-task-worker-runtime.md
    ├── 05-file-assets-local-storage.md
    ├── 06-backend-database-api.md
    ├── 07-admin-console.md
    ├── 08-security-privacy.md
    ├── 09-pwa-cache-update.md
    ├── 10-testing-ci-quality.md
    ├── 11-deployment-operations-recovery.md
    ├── 12-agent-collaboration.md
    ├── 13-acceptance-open-decisions.md
    ├── 14-phase-implementation-roadmap.md
    ├── 15-mandatory-code-requirements.md
    └── 16-stage-0-audit.md
```

目录中没有 `.git`、`AGENTS.md`、源代码、`package.json`、`pnpm-lock.yaml`、Workspace/Turbo 配置、数据库迁移、部署文件或测试。`README.md` 提及的历史 `10-subagent` 文档不在当前目录；没有其他版本可供合并，故不删除或替换现有规范。

## 实际技术栈与目标差异

| 方面 | 当前证据 | 目标规范 |
| --- | --- | --- |
| 版本管理 | 当前目录不是 Git 仓库 | 独立分支或 Worktree 与可追溯变更，见 `12` |
| 工作区 | 无应用或包配置 | pnpm Workspace + Turborepo，见 `00`、`15` |
| 前后端与数据库 | 无实现 | React/Vite/Fastify SSR、PostgreSQL/Drizzle，见 `00`、`06` |
| 契约与任务运行时 | 无注册表、Schema 或 Worker | 共享契约、任务状态机与本地资产仓储，见 `03`–`05` |
| 设计系统 | 只有要求，没有 Token 或组件 | 用户指定的 `@material-3` 参考与洋红 MD3 主题，见 `01` |
| 测试与部署 | 无 CI、测试或部署配置 | Vitest/Playwright/GitHub Actions/Docker Compose，见 `10`、`11` |

本机可调用 Node.js 24.19.0、pnpm 11.25.0、Git 2.53.0；未发现 Docker 命令。这些是本机工具检查结果，不是项目锁定的运行版本或部署验证。

## 规划中的包依赖图

以下是 `00` 与 `15` 指定的**目标方向**，不是现有包图。阶段 1 需确定包名、公开入口与自动边界规则后再视为冻结。

```text
apps/web ──> packages/design-system-adapter
         ├─> packages/app-core ──> packages/contracts
         └─> packages/tool-* ────> packages/app-core 的公开契约
apps/server ──> packages/contracts
            └─> packages/db ────> packages/contracts
packages/contracts ──> 不依赖 UI、数据库实现或工具实现
```

工具之间不得直接依赖；公共能力由明确归属的共享包提供。浏览器 IndexedDB 与 PostgreSQL 是不同数据边界。

## 接口所有权矩阵（阶段 1 拟定）

| 接口/数据 | 权威归属 | 依赖方 | 核验方式 |
| --- | --- | --- | --- |
| API 响应、错误、工具与任务 TypeScript 契约 | `packages/contracts` | Web、Server、工具包 | 类型与契约测试 |
| 工具实现、稳定 ID、能力、路由声明 | 代码注册表；具体包路径待阶段 1 确定 | Web、Server、Seed | 注册表与 Seed 一致性检查 |
| 任务状态与资源预算 | `packages/app-core` | 工具、Web | 状态转换与边界测试 |
| 浏览器资产和 IndexedDB 访问 | `packages/app-core` 的仓储接口及其浏览器实现 | 工具、Web | 持久化与隐私测试 |
| 服务端工具目录及管理数据 | `packages/db` | Server | 迁移、约束与事务测试 |
| API 路由与 OpenAPI | `apps/server` 的实际路由/TypeBox Schema | API client、Web | 生成与差异检查 |
| MD3 Token 与组件适配 | `packages/design-system-adapter` | Web、后台、工具页 | 视觉与组件检查 |

矩阵中尚未存在的包只表示计划；不能据此声称接口已完成。

## 决策定位与冲突清单

已写入本仓库的决策按主题定位于 `00`–`15`：架构/技术栈 `00`、`15`；设计 `01`；路由/国际化 `02`；工具与任务 `03`–`05`；后端与后台 `06`–`07`；安全与运维 `08`–`11`；协作、验收及阶段推进 `12`–`14`。原始访谈或决策记录不在本目录，无法独立核对文档中的“用户已确认”声明。

| 编号 | 现象与影响 | 处理状态 |
| --- | --- | --- |
| D-01 | IndexedDB 结构变化时清空重建与任务/结果长期保留冲突，见 `05`、`13`。 | 未决。生产清库不得据此实施；阶段 6 前确定范围、提示、导出恢复或兼容迁移。 |
| D-02 | 清空应用缓存后下载失败会损失离线可用性，见 `09`、`13`。 | 既定取舍；阶段 10 设计失败提示和恢复路径，缓存清理不得触碰 IndexedDB。 |
| D-03 | CDN 长缓存可能展示已停用工具，见 `02`、`13`。 | 直达 URL 必须经服务端校验并返回真实 404；SSR HTML 的缓存边界待设计。 |
| D-04 | 一般安全告警与严重可利用漏洞门禁不同，见 `08`、`13`。 | 阶段 11 在 CI 中分开设置。 |
| D-05 | 仅一名管理员，见 `07`、`13`。 | 已定范围；仍需基本事务和版本检查。 |
| D-06 | 阶段 3 的数据库启用状态、阶段 4 的 Seed/数据库一致性与结果持久化验收，依赖阶段 5–7 尚未实现的能力，见 `14`。 | 实施顺序冲突。建议阶段 1 先冻结目录查询、任务、资产、数据库适配接口；阶段 3/4 只验收可独立验证的能力，完整集成验收在阶段 7 后进行，并在改动路线图前审阅该调整。 |
| D-07 | README 曾要求合并历史 `10-subagent` 文档，但当前目录没有该文件，也没有可读取的原始决策记录。 | 记录缺失；若后续取得历史文件，再做差异核对。 |

工具清单、依赖版本、MD3 React 组件库、性能阈值、缓存 TTL、历史保留期限仍待相应阶段调研或测量，不视为已定。汇率工具第 68、69 题继续暂缓。

## 阶段 0 验收记录

| 项目 | 结果与证据 |
| --- | --- |
| 阶段编号及目标 | 0；现状审计、差异与冲突登记。 |
| 修改文件 | `README.md`、`docs/01-design-system.md`、本文件。 |
| 实际执行命令 | `Get-ChildItem -Force -Recurse`；`rg --files`；`rg -n`；`git status --short`；`node --version`；`pnpm --version`；`git --version`；读取 `README.md` 与 `docs/00`–`15`。 |
| 测试结果 | 尚无应用代码及测试命令；未运行构建、Lint、类型检查或自动化测试。 |
| 目录树与包依赖图 | 已提供真实目录树及明确标为目标的依赖图。 |
| 决策与冲突 | 已定位主题文档并列出 D-01–D-07；原始决策记录缺失。 |
| 文档真实性 | 未将规划中的功能描述为已实现、已测试或已部署。 |
| 未解决问题 | D-01、D-06、历史决策来源与具体技术选型。 |
| 是否可进入阶段 1 | 阶段 1 的独立基础工作可开始；依赖 D-06 的阶段验收口径应先审阅，D-01 必须在阶段 6 的破坏性数据实现前解决。 |

