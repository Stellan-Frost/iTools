# iTools 全局开发文档

> 版本：Architecture Baseline Draft 1.0  
> 状态：根据全局框架访谈整理，待根 Agent 审核；不是已部署或已验证的系统。

## 使用规则
1. 本目录是全局架构基线；代码仓库中的本目录应作为唯一权威来源。
2. 文档按职责拆分。修改某模块时只改相关文档，并同步更新本索引与受影响的契约。
3. 根 Agent（GPT-6 Sol，Medium）负责规划、派发、集成、冲突裁决、验收和文档核验；子 Agent（GPT-6 Luna，Medium）负责分支内执行与测试。
4. 已确认的架构决策不得被子 Agent 静默改写。变更须提交原因、影响、迁移方案、测试与回滚计划，由根 Agent 审核；生产变更仍须用户批准。
5. 不得声称文档中的方案已实现、测试或部署，除非有真实证据。

## 文档索引
- `00-architecture-overview.md`：系统边界、技术栈、模块依赖、决策原则
- `01-design-system.md`：MD3 设计系统、洋红主题、字体、图标、动效和布局
- `02-app-routing-i18n-seo.md`：SSR、路由、双语、目录查询、SEO 与 404
- `03-tool-contract.md`：工具注册、TypeScript 契约、页面骨架与接入流程
- `04-task-worker-runtime.md`：任务状态机、FIFO 调度、Worker、取消和资源预算
- `05-file-assets-local-storage.md`：文件资产、IndexedDB、配额、清理、导入导出
- `06-backend-database-api.md`：Fastify、PostgreSQL、Drizzle、TypeBox、API 约定
- `07-admin-console.md`：唯一管理员、会话认证、目录管理与元数据版本
- `08-security-privacy.md`：CSP、限流、日志、依赖扫描和数据边界
- `09-pwa-cache-update.md`：PWA、缓存、离线限制和更新流程
- `10-testing-ci-quality.md`：测试、CI、合并门禁、性能预算
- `11-deployment-operations-recovery.md`：Docker Compose、环境、备份、部署和恢复
- `12-agent-collaboration.md`：Subagent、Worktree、文件所有权与合并
- `13-acceptance-open-decisions.md`：验收清单、已知冲突、未决事项
- `14-phase-implementation-roadmap.md`：每个实施阶段的目标、任务与验收标准
- `15-mandatory-code-requirements.md`：强制代码要求、不可违反的工程与产品约束；包含可读性、模块化、命名、DRY 与分层规则
- `16-stage-0-audit.md`：阶段 0 仓库现状、规划依赖图、接口所有权、冲突与验收记录
- `17-stage-1-workspace.md`：阶段 1 工作区、共享契约、命令、包边界与验收记录

## 当前开发状态
阶段 1 已建立 pnpm 工作区和 `@itools/contracts` 基础包；应用、数据库、工具与设计系统尚未实现。建设状态和实际验收证据见 `docs/17-stage-1-workspace.md`。

## 本地准备
需要 Node.js 22 或更新版本，以及 pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

这些命令当前验证工作区与共享契约，不代表全站功能已完成。

## 强制要求
- 所有 Agent 必须先阅读 `15-mandatory-code-requirements.md`，不得自行更换技术栈或扩大产品范围。
- 阶段执行必须遵守 `14-phase-implementation-roadmap.md`；每阶段均需提交目标、验收结果和可复现证据。

## 根 Agent 执行顺序
1. 审查现有仓库与已有文档，先合并再删除或替换，禁止重复建立平行规范；历史文档若不在当前仓库，应在阶段 0 审计中注明。
2. 输出实际仓库目录树、现有技术栈差异和决策冲突表。
3. 建立工作区/包依赖图与接口所有权矩阵。
4. 按阶段实现全局框架；先交付可审核初版，不部署生产。
5. 所有硬性验收通过后，提交报告和部署计划，等待用户批准。
