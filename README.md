# iTools

iTools 当前交付的是一个本地运行的界面样本，用于查看工具目录、工具页面流程和管理界面样本。阶段 2 已验收；阶段 3 尚未开始，正在等待用户确认。整个产品仍是本地 sample UI 预览，未生产部署，也没有 SSR、数据库、真实工具处理、服务端持久化、认证、PWA 或 CI。

## 从这里开始

新 Agent 请先阅读 [Agent 交接说明](docs/19-agent-handoff.md)，再按其中的任务状态、边界和验收要求工作。接着阅读 [仓库现状审计](docs/16-stage-0-audit.md)、[工作区契约](docs/17-stage-1-workspace.md) 和 [应用壳设计与阶段 2 验收](docs/18-stage-2-design-system.md)。这些文档记录当前仓库事实和已验收阶段；若与源码状态不一致，先核实并报告，不要把目标方案写成已实现能力。

## 本地运行

环境要求：Node.js 22 或更新版本；pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm --filter @itools/design-system-adapter build
pnpm dev
```

开发服务器启动后，使用终端输出的本地地址打开预览。设计系统适配包需先生成 `dist`，再启动 Web 应用。

## 验证命令

仓库根目录提供以下检查：

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

这些是当前工作区的本地验证命令，不表示已配置 CI，也不证明尚未实现的产品能力。

## 文档地图

以下 `docs/00` 至 `docs/15` 是项目原始模块规范，保留作目标、约束与设计参考；其中关于 SSR、数据库、认证、任务运行时、持久化、PWA、部署等内容，不代表当前实现。以 [阶段 0 审计](docs/16-stage-0-audit.md)、[阶段 1 契约](docs/17-stage-1-workspace.md)、[阶段 2 设计与验收](docs/18-stage-2-design-system.md) 和源码共同判断当前状态。

- [00 架构概览](docs/00-architecture-overview.md)：系统边界、技术栈和模块关系
- [01 设计系统](docs/01-design-system.md)：视觉语言、主题与组件原则
- [02 路由、国际化与 SEO](docs/02-app-routing-i18n-seo.md)：目标路由与页面发现设计
- [03 工具契约](docs/03-tool-contract.md)：工具元数据及接入约定
- [04 任务与 Worker 运行时](docs/04-task-worker-runtime.md)：目标任务状态和执行模型
- [05 文件资产与本地存储](docs/05-file-assets-local-storage.md)：目标文件管理和持久化设计
- [06 后端、数据库与 API](docs/06-backend-database-api.md)：目标服务端接口与数据层
- [07 管理控制台](docs/07-admin-console.md)：目标管理和访问控制
- [08 安全与隐私](docs/08-security-privacy.md)：安全边界和数据处理原则
- [09 PWA 与缓存更新](docs/09-pwa-cache-update.md)：目标离线和更新策略
- [10 测试、CI 与质量](docs/10-testing-ci-quality.md)：目标质量门禁
- [11 部署、运维与恢复](docs/11-deployment-operations-recovery.md)：目标部署方案
- [12 Agent 协作](docs/12-agent-collaboration.md)：并行开发与交接原则
- [13 验收与未决事项](docs/13-acceptance-open-decisions.md)：项目验收和待决问题
- [14 阶段路线图](docs/14-phase-implementation-roadmap.md)：阶段目标与退出条件
- [15 强制代码要求](docs/15-mandatory-code-requirements.md)：工程和产品约束
- [16 阶段 0 仓库审计](docs/16-stage-0-audit.md)：基线、差异和审计记录
- [17 阶段 1 工作区契约](docs/17-stage-1-workspace.md)：包边界、共享约定和门禁
- [18 阶段 2 应用壳设计](docs/18-stage-2-design-system.md)：适配层、预览范围和验收证据
- [19 Agent 交接](docs/19-agent-handoff.md)：当前状态、工作入口和协作约定
