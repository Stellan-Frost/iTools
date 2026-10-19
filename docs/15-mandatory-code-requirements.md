# 15 · 强制代码要求与不可违反的约束

> 状态：**生效中**。本文是所有 Agent 的强制检查表。若仓库原始要求与本文件有冲突，根 Agent 必须先核对原始决策记录，不得自行选择较方便的方案。

## 0. 当前执行方式（2026-10-19 审计后）

| 要求 | 执行手段 | 是否自动阻断 |
| --- | --- | --- |
| 格式 | `pnpm format:check`（Prettier） | 是 |
| Lint | `pnpm lint`（ESLint + 清单边界 + 源码边界 + Token） | 是 |
| 类型 | `pnpm typecheck`（TS strict） | 是 |
| 测试 | `pnpm test`（Vitest，558 项；需 `TEST_DATABASE_URL`） | 是 |
| 构建 | `pnpm build`（Turbo） | 是 |
| 注册表 | `pnpm check:tools`（需先 build） | 是 |
| i18n 键 | `pnpm check:i18n`（需先 build） | 是 |
| 隐私（本地包禁网） | `pnpm check:privacy`（已并入 lint） | 是 |
| SSR/HTTP | `node scripts/verify-stage-4.mjs` | 是 |
| 总门禁 | `pnpm verify`（以上全链路） | 是 |
| CI | **未接入**，阶段 11 | 否 |
| 性能/包体预算 | **未测**，阶段 11 | 否 |

### 严格规则清单（ESLint / 脚本）

| 规则 | 实现 | 说明 |
| --- | --- | --- |
| 禁止 `any` / `@ts-ignore` / `eslint-disable` | `@typescript-eslint/no-explicit-any` 等 | 代码中当前为 0 |
| 禁止裸 HTML 交互控件 | `no-restricted-syntax`（button/input/select/textarea） | 仅 `apps/web`；必须用适配层 |
| 禁止直接使用组件库 | `no-restricted-imports`（`m3-expressive-react`） | 必须从 adapter 导入 |
| 禁止深层导入源码/产物 | `no-restricted-imports`（`@itools/*/src/*`、`@itools/*/dist/*`） | 只用包入口 |
| 依赖方向 | `check-boundaries` + `check:imports` | 清单与源码双重校验；server 只依赖 contracts |
| contracts 纯净 | `no-restricted-imports`（`@itools/*`、`node:*`） | 不得依赖工作区包或运行时 |
| 硬编码颜色 / 内联 style / `!important` | `check:tokens` | Web 只用语义 Token |
| 单文件长度 | `max-lines: 400`（生产源码，测试除外） | 超限拆文件 |
| 日志 | `no-console`（仅允许 warn/error） | 不得输出用户数据 |
| 未使用变量/参数 | `no-unused-vars`（`_` 前缀豁免） | — |
| 比较与变量声明 | `eqeqeq`、`prefer-const`、`no-var` | — |
| i18n 键未使用 | `check:i18n` | 资源键必须全部有引用 |

负向验证（2026-10-19）：探针文件加入 `<button>`、`#ff0000`、内联 style、server 导入 app-core，分别被 ESLint、`check:tokens`、`check:imports` 阻断，证明规则生效。

审计结论：上述规则全部通过当前代码；剩余缺口是 CI 接入、Playwright 与性能预算。

## 1. 技术栈与工程规范
- Monorepo：pnpm Workspace + Turborepo。
- 前端：React + Vite；Fastify 负责 SSR 与静态资源托管。
- 后端：Node.js + TypeScript + Fastify。
- 数据库：PostgreSQL；Drizzle ORM + Drizzle Kit。
- API Schema：TypeBox；OpenAPI 从实际路由和 Schema 自动生成。
- 前端数据请求：共享类型安全 API client + TanStack Query。
- 国际化：i18next + react-i18next。
- 测试：Vitest + Playwright。
- 代码质量：TypeScript `strict`、ESLint、Prettier；GitHub Actions CI。
- 部署：Linux + Docker Compose；反向代理负责 HTTPS；Cloudflare/CDN/WAF 作为公网代理。
- 依赖必须由 pnpm 锁文件固定；不得随意引入替代技术栈。

## 结构与职责边界
- 共享契约、工具实现、前端应用、后端和数据库访问按包拆分。
- 工具必须注册到代码注册表；数据库不能启用不存在的实现。
- 工具实现不得绕过统一任务调度、文件资产仓储、错误协议和资源预算。
- 禁止工具之间互相直接依赖；公共能力放入明确的共享包。
- 路由、能力、输入/输出 Schema、依赖、资源预算与测试入口必须显式声明。
- 代码、Seed、数据库和 OpenAPI 契约必须由 CI 检查一致性。

## 隐私与数据处理
- 用户文件、处理结果与普通用户任务数据默认只在浏览器本地处理和保存。
- 不得未经授权将文件、结果、任务数据、遥测或错误报告发送到服务器或第三方。
- IndexedDB、Cache Storage 与服务器数据库是不同数据边界；不得用清理应用缓存的逻辑清理用户数据。
- 本地数据升级只走版本化增量迁移，**禁止在升级路径中自动清库**；清空仅限用户显式触发。
- `asset-store` 与 `task-runtime` 的生产源码禁止 `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon`（`check:privacy` 阻断）。
- 日志禁止记录凭据、Cookie、文件内容、处理结果和敏感参数。
- 工具缺少必要浏览器能力时，应解释并禁用执行；不得自动把用户文件转到服务器处理。

## 安全与运维
- 公开只读 API：输入校验、固定速率限制和适当缓存。
- 管理写 API：会话认证、服务端授权、CSRF 与来源检查。
- CSP 默认拒绝；新增外部资源必须经用途、数据流和安全影响审核；优先本地托管。
- 生产配置通过环境注入；关键配置 Schema 校验失败时拒绝启动，错误不泄露秘密。
- 迁移失败停止发布、保留现场；不得自动执行破坏性反向迁移。
- 应用健康检查达到阈值时可自动回滚上一稳定镜像/配置；数据库迁移、数据恢复和公网安全配置变更仍需独立审批。
- 生产部署不自动进行，必须先经用户批准。

## 产品与交互约束
- 使用 Material Design 3 体系和鸭青品牌方向（源色 `#009688`）；主题色、字体、间距、圆角和动效统一 Token 化。文本字号使用 Display、Headline、Title、Body、Label 五类十五个 MD3 typescale 角色。
- 采用宽松展示型、响应式布局；导航包含可展开分类导航、工具搜索命令面板和最近任务入口。
- 工具页使用统一骨架：标题/简介、输入区、主工作区、任务区、结果区、规范与开源致谢。
- 不开展独立无障碍专项；不得擅自将无障碍工程扩展为额外阶段或改变已确认的产品范围。
- 最近任务既有轻量面板入口，也有独立管理页面。
- 不存在或停用的工具直达 URL 必须返回真实 HTTP 404。
- 工具可用性按三态处理：`preview` 可见但只读、200 + noindex、不进 Sitemap；`implemented` 可执行、可索引；`disabled` 404。不得把预览工具描述成可执行。
- 预览态不得出现伪造进度、伪造“校验通过”或伪造结果。
- 中英文路由与文案均按既定 i18n 规范处理。

## 单一来源（强制）

- 工具身份、分类、可用性、展示元数据：只在 `packages/app-core/src/registry/**`。
- 分类：只在 `packages/app-core/src/catalog/**`。
- 文案：只在 `packages/app-core/src/i18n/resources/**` 或注册表双语字段；不得在组件里硬编码用户可见文本。
- 视觉 Token：只在 `packages/design-system-adapter/src`；Web 只通过 CSS 变量引用。
- 注册表条目、分类、i18n 键、工具文案不得在前端/后端/文档中各自维护副本；由查询函数与 `check:tools`、测试保持一致。

## Agent 纪律
- 不得重新询问已经确认的架构事项。
- 不得把假设写成用户已批准的决策。
- 不得声称未执行的测试已通过，或未部署的功能已上线。
- 任何偏离本规范的实现必须先提交变更提案，说明原因、影响、迁移、测试和回滚方案。
- 汇率工具第 68、69 题继续暂缓，不得推断答案。


## 五项强制代码质量要求（用户明确确认）

### 1. 可读性
- 优先使用直观、明确的实现；避免难以理解的技巧性写法、隐式副作用和不必要的抽象。
- 函数、类型、变量与模块应能从名称和简短上下文中理解用途。
- 复杂算法必须说明关键思路、边界条件和复杂度；注释解释“为什么”，而不是重复代码表面含义。
- 错误处理必须显式，不得吞掉异常或用无意义默认值掩盖失败。
- PR 必须能让未编写该代码的 Agent 根据命名、类型和测试理解其行为。

### 2. 模块化与低耦合
- 单文件只承担一个清晰的主要职责；禁止把路由、业务规则、数据库访问、UI、状态管理和工具算法集中到同一大文件。
- 按职责拆分小文件，并放入清晰的层级目录；不得为拆分而制造只有转发代码、无独立职责的碎片文件。
- 依赖方向必须明确且单向：UI/路由层调用应用服务或用例层；用例层依赖领域契约；基础设施层实现数据库、浏览器存储、网络和 Worker 接口。
- 领域/共享契约不得依赖具体 UI、数据库实现或具体工具实现。
- 工具专属实现不得反向依赖其他工具；跨工具能力放入有明确所有权的共享模块。
- 通过包边界规则、TypeScript 项目引用或 ESLint import 规则检测非法依赖，不只依赖人工约定。

### 3. 命名规范
- 文件、目录、类型、函数、变量、常量、React 组件、测试和 API 字段使用统一命名规则。
- 推荐默认规则：目录与普通文件使用 `kebab-case`；React 组件、类、类型和接口使用 `PascalCase`；变量、函数和属性使用 `camelCase`；真正不可变的全局常量使用 `UPPER_SNAKE_CASE`；布尔值采用 `is/has/can/should` 等可读前缀。
- 测试文件使用被测模块名称加 `.test.ts` / `.test.tsx`；端到端测试放入明确的 `e2e` 目录。
- API JSON 字段统一使用 `camelCase`；数据库表/列使用项目统一约定，建议 `snake_case`，由 Drizzle 显式映射。
- 避免含糊缩写、无意义名称（如 `data2`、`temp`、`utils` 大杂烩）和同一概念多种命名。
- 现有仓库若已采用不同规则，阶段 0 必须先记录并统一，不得混用两套风格。

### 4. 单一实现来源（DRY）
- 同一业务规则、算法、格式校验、错误映射、资源限制和状态转换只能有一个权威实现。
- 复用时通过共享模块/API/函数调用，不复制粘贴或建立行为略有差异的平行实现。
- 优先建立明确的共享模块；只有确有不同业务语义时才允许独立实现，并在代码评审中说明原因。
- 配置、工具能力与元数据不得在前端、后端、Seed 和文档中各自维护互相漂移的副本；通过注册表、Schema、生成代码或一致性检查保持同步。
- 不要为追求“复用”而创建过度通用的框架；抽象必须有清晰职责、调用方和测试。
- CI 应加入重复代码检测或等效检查；检测结果由根 Agent 评估，避免机械消除合理的局部代码。

### 5. 清晰分层与目录架构
- 每个应用/包都必须有清晰目录结构，目录名表达架构职责，而不是按开发者个人习惯随意摆放。
- 典型分层：`presentation`（页面、组件、路由适配）→ `application`（用例、流程编排）→ `domain`（纯业务规则与契约）→ `infrastructure`（数据库、IndexedDB、网络、Worker、文件系统适配）。
- 不要求每个包机械创建全部四层；只在确有职责时建立目录，避免空目录和过度分层。
- 跨层依赖必须遵守单向规则；领域层不得导入 UI、Fastify、Drizzle、浏览器 DOM 或具体存储实现。
- 共享能力按明确领域归属放入 `packages/`；工具专属代码留在各自工具包；应用组装代码留在 `apps/`。
- 目录结构、模块职责、公开入口和允许依赖必须记录在架构文档，并由 CI 约束。

## 每次 PR 的代码质量验收
- [ ] 每个文件职责单一，没有明显的“上帝文件”。
- [ ] 目录和依赖方向符合已记录的分层规则。
- [ ] 新代码遵守命名规范，无同义概念多种命名。
- [ ] 已有共享功能通过调用复用，没有重复实现。
- [ ] 关键业务规则有类型、错误处理和测试。
- [ ] 复杂代码有解释设计原因的必要注释。
- [ ] Lint、类型检查、测试和构建通过。
- [ ] 重复代码与非法依赖检查通过；例外必须在 PR 中说明理由。
