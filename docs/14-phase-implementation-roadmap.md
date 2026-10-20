# 14 · 分阶段实施路线图

> 定位：阶段划分、各阶段目标/交付/验收证据与推进规则；「现在能做什么、下一步门槛是什么」从这里查。
> 状态：**阶段 0–11 已完成**；阶段 11 本地及云端 CI、分支保护验收已完成，阶段 12–13 未开始。验收只依据代码、自动化测试、构建产物和可复现证据，不接受口头声明。
> 验收顺序按 D06：不依赖数据库/任务运行时的部分先验收，完整集成验收在阶段 7 之后（见 [13](13-acceptance-open-decisions.md)）。

## 0. 阶段状态

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 0 | 现状审计与基线冻结 | ✅ 完成 |
| 1 | Monorepo、规范与共享契约 | ✅ 完成 |
| 2 | 设计系统与应用壳 | ✅ 完成 |
| 3 | 路由、SSR、i18n、SEO | ✅ 完成（可独立验收部分） |
| 4 | 全局框架、三态注册表、预览状态 | ✅ 完成（无可执行工具） |
| 5 | 任务运行时与 Worker | ✅ 完成（运行时包 + fixture 验收，未接工具/UI） |
| 6 | 文件资产与 IndexedDB | ✅ 完成（存储包 + fake-indexeddb 验收，未接工具/UI） |
| 7 | 后端、数据库与 API | ✅ 完成（只读 API + 迁移/Seed/OpenAPI；认证属阶段 8） |
| 8 | 唯一管理员与管理后台 | ✅ 完成（认证/写接口/回滚/后台界面/口令恢复） |
| 9 | 安全、隐私与依赖治理 | ✅ 完成（CSP/安全头/限流/日志/审计；漏洞阻断属阶段 11） |
| 10 | PWA、缓存与更新 | ✅ 完成（构建产物/Node VM 验收；真实浏览器 E2E 属阶段 11） |
| 11 | CI、性能与质量门禁 | ✅ 本地及云端门禁通过；失败合并阻断已验证 |
| 12 | 部署、备份与恢复 | ⏳ 未开始 |
| 13 | 全局验收与交付 | ⏳ 未开始 |

## 1. 已完成阶段（证据摘要）

### 阶段 0–1：审计、工作区与契约

- pnpm Workspace + Turborepo；TypeScript strict；ESLint/Prettier；依赖边界脚本。
- `packages/contracts`：API、任务、资产、工具、locale、SSR、注册表形状。
- 证据：`pnpm lint/typecheck/test/build` 通过；锁文件固定。

### 阶段 2：设计系统与应用壳

- `packages/design-system-adapter`：MD3 组件、鸭青主题、字体、Token。
- 桌面侧栏 / 紧凑抽屉 / 搜索命令面板 / 工具详情 Dialog / 主题切换。
- 证据：adapter 9 项、web 壳层测试；无视觉回归工具。

### 阶段 3：路由、SSR、i18n、SEO

- Fastify SSR；`/zh-CN`、`/en`；真实 404；canonical/hreflang；Sitemap/robots。
- 证据：139 项测试中的 contracts/app-core/web/server 相关项；28 项 HTTP 验收。

### 阶段 4：全局框架与三态注册表

- 注册表唯一来源；`preview/implemented/disabled`；预览页只读 + noindex；`check:tools`。
- 证据：app-core 49 项、web 61 项、`check:tools`、28 项 HTTP 验收。
- 未完成：真实工具、执行 UI（用户决定“先框架后工具”）。

## 2. 阶段 5：任务运行时与 Worker ✅

**目标**：所有工具共用一致的任务状态、队列、进度、取消、错误与资源预算。

**交付**（`packages/task-runtime`，依赖仅 contracts）

- 7 态状态机 + 显式转换表；非法转换抛 `invalid-task-transition`。
- 全局 FIFO + 资源感知并发（总并发、总内存、单工具并发）；队首放不下时允许轻量任务先行。
- Worker 池（按引擎分组、租约复用、`discard` 重建）；`start/cancel` 与 `progress/complete/error/cancelled` 协议经 TypeBox 校验。
- 取消两步确认；超时强杀并重建 Worker；取消确认后迟到的结果被丢弃。
- 结果必须经 `commitResult` 成功才标记 `completed`。
- 运行时为全局实例，订阅者退订（路由切换）不影响任务。

**验收证据**

- 66 项运行时测试（状态机 10、预算 6、调度器 18、运行时 8、协议 7、池 7、执行器 10）。
- 契约测试 +2：Worker 协议双向校验、资源请求与预算校验。
- `pnpm verify` 通过：207 项测试、28 项 HTTP 验收、`check:tools` 与 `check:i18n` 通过。
- 覆盖：合法/非法转换、队列顺序、三重预算、成功/失败/取消/超时/崩溃/协议违规、队列满、提交失败、重复取消、销毁。

**未完成（有意留到后续）**

- 未接入任何真实工具，`implemented` 仍为 0；工具页仍是预览只读。
- 无任务 UI、无 IndexedDB 持久化、无真实 Worker 脚本；浏览器内 Worker 行为无 E2E（阶段 11）。
- 预算数值未经性能基线校准。

## 3. 阶段 6：文件资产与 IndexedDB ✅

**目标**：统一管理源文件、中间文件、结果与任务引用，本地数据不被意外清理或外传。

**交付**（`packages/asset-store`，依赖仅 contracts；4 个 subagent 并行、文件零重叠）

- 资产模型 `source / intermediate / result`，写入前校验，`sizeBytes` 只取真实内容大小。
- IndexedDB 仓储：`assets` / `blobs` / `references` / `tasks` / `meta`，写入单事务原子化；版本化增量迁移，**永不自动清库**（D01 已决）。
- 对象 URL 注册表：按 Blob 引用计数、幂等释放、`releaseAll` 后旧句柄失效。
- 保留策略：源文件 7 天、结果长期保留；跳过 `not-source` > `referenced` > `active-task`；时间无法解析时保守保留。
- 配额：`estimate()` / `requestPersistence()`，缺失字段不伪造、被拒不抛错。
- 归档：单 JSON + 内置 base64；导入先全量校验再写入；`replaceExisting` 走快照恢复，否则只回滚本次新增。
- `createAssetResultCommitter` 结构兼容 `commitResult`，不引入 task-runtime 依赖。
- 隐私门禁 `scripts/check-no-network.mjs` 纳入 `pnpm lint`。

**验收证据**

- 131 项资产测试（领域 33、应用 35、IndexedDB 24、归档 33、组装 6），IndexedDB 用例跑在 `fake-indexeddb` 上。
- 契约测试 +1（资产记录 / 归档外壳 Schema）。
- `pnpm verify` 通过：339 项测试、28 项 HTTP、`check:privacy` 通过。

**未完成（有意留到后续）**

- 未接页面与任务运行时（D26）；工具仍不可执行，`implemented` 为 0。
- 未做真实浏览器验证（Safari 事务窗口、多标签页 `blocked`、真实配额），属阶段 11 E2E。
- 归档未分片，base64 体积约增 33%。

## 4. 阶段 7：后端、数据库与 API ✅

**目标**：可验证的服务端数据层、类型安全 API、可追踪迁移。

**交付**（`packages/db` + `apps/server/src/api` + `apps/web/src/api`；4 个 subagent 并行，文件零重叠）

- PostgreSQL 17 + Drizzle schema：`tools` / `tool_localizations` / `tool_metadata_versions` / `admin_sessions`。
- 版本化 SQL 迁移执行器：单文件单事务、sha256 checksum、幂等、失败整体回滚。
- Seed：注册表全量「不存在则插入」，不覆盖已有 order 与文案，可重复执行。
- 目录合并（M1/D27）：注册表提供身份、分类、可用性；数据库只能覆盖排序与文案，且只能下架。
- 只读 API：`/api/v1/tools`、`/api/v1/tools/:id`、`/api/v1/health/{live,ready}`、`/api/v1/openapi.json`；统一错误信封与 requestId。
- 连接池（max 10、超时、statement_timeout）、ready 探测 1 秒硬超时且不抛错、优雅关闭。
- 前端 `createToolApiClient` + `toolCatalogQueryOptions`（staleTime 60s），错误码 `NETWORK_ERROR` / `INVALID_RESPONSE` / 服务端 code。
- 无 `DATABASE_URL` 时目录回落注册表，服务照常启动。

**验收证据**

- 44 项数据库测试（迁移 8、连接池 2、探测 4、pg 仓储 9、目录合并 12、Seed 9），全部跑在真实 PostgreSQL 17.6 上。
- 服务端 31 项：原有 14 项 + API 13 项 + 端到端 4 项（迁移 → Seed → 合并 → HTTP）。
- 前端 9 项客户端测试。
- 生产模式冒烟：`/api/v1/tools` 200（6 条、`public, max-age=60`）、未知工具 404 `TOOL_NOT_FOUND`、`/health/ready` 200 `database:ok`、OpenAPI 5 条路径。
- `pnpm verify` 通过：409 项测试、28 项 HTTP 验收。

**未完成（有意留到后续）**

- 无写接口、无认证、无 CSRF、无限流（阶段 8/9）；`admin_sessions` 与 `tool_metadata_versions` 只有表结构。
- 前端客户端未接入任何页面。
- 多进程并发迁移无 advisory lock；`db:generate` 未纳入流程，结构权威是 `tables.ts`。

## 5. 阶段 8：唯一管理员与管理后台 ✅

**目标**：唯一管理员安全管理工具可用性与展示元数据。

**已完成（后端与接口）**

- 迁移 0002：`admin_credentials`（单行约束）。
- 口令 `scrypt` + 随机盐 + `timingSafeEqual`；会话 token 只存 sha256 哈希。
- 会话：空闲 7 天滑动、绝对 30 天封顶、登录轮换、登出撤销、批量撤销仓储方法。
- CSRF 双提交 + `x-csrf-token`，非 GET/HEAD 强制校验；`sameSite=Strict`、`HttpOnly`、HTTPS 下 `Secure`。
- 初始化：`ADMIN_SETUP_TOKEN` 常量时间比对，未配置时入口不存在，成功后永久关闭。
- 登录固定限流（5 次 / 15 分钟，内存窗口，不永久锁定）。
- 写接口：双语文案 + 排序、启停（只能下架或恢复注册表默认）、版本列表、回滚（`expectedVersionId` 防覆盖）。
- 版本快照按 (tool, locale) 记录文案，保留最近 50 版（D30/D32）。
- 后台界面：初始化 / 登录 / 工具选择 / 双语文案与排序 / 上下架确认 / 版本历史与回滚，全部走适配层组件与 i18n。
- 口令恢复命令 `reset-password`：更新哈希 + 撤销全部会话，支持随机生成口令。

**验收证据**

- 数据库 21 项新增（凭据 10、会话 6、版本 5），全部跑在真实 PostgreSQL 上。
- 服务端新增 94 项（认证 75、写接口 14、口令恢复 5）+ 8 项管理端到端。
- 前端 26 项新增（管理客户端 17、后台界面 9）。
- 真实 HTTP 冒烟：setup 201 + 两个 Cookie → 无 CSRF 403 → 带 CSRF 200 且公开目录立即反映 → 登出 204 → 写请求 401 → CLI 重置口令 → 新口令 200、旧口令 401。
- `pnpm verify` 通过：558 项测试、28 项 HTTP 验收。

**未完成 / 已知限制**

- 阶段 8 时后台只有组件测试与 HTTP 冒烟；阶段 11 补充了无数据库场景的浏览器安全失败测试，真实管理员登录仍缺浏览器 E2E。
- 会话 Cookie 不随请求刷新 Max-Age；CSRF token 不轮换；限流为进程内实现；写入无数据库事务。
- 后台页数据用 effect + 局部状态，未接 TanStack Query（D33）。

## 6. 阶段 9：安全、隐私与依赖治理 ✅

**目标**：默认拒绝 CSP；公开只读 API 与管理写 API 分级保护；锁定依赖并扫描漏洞；日志最小化。

**交付**

- 安全响应头：`onSend` 统一注入，覆盖 HTML / API / 404 / 静态资源；生产 CSP 12 条指令，`script-src 'self'`，开发环境才放行内联脚本与 `ws:`。
- HSTS 仅在 `https:` 站点下发；`nosniff`、`Referrer-Policy`、`X-Frame-Options: DENY`、`Permissions-Policy`、`COOP` 全站生效；不覆盖业务已设置的同名头。
- 外部资源审计 `scripts/check-external-resources.mjs`：构建产物出现外部 `src/href/url()` 即失败，已串入 `pnpm verify`。
- 公开只读 API 固定限流：每 IP 120 次/分钟，超限 429 + `retry-after`。
- 管理写请求来源检查：生产环境非 GET/HEAD 必须 `Origin` 等于站点来源。
- 脱敏请求日志：单行 JSON，只含时间/requestId/方法/路径/状态/耗时；不读请求头、请求体、响应体，路径截断查询串。
- 依赖扫描命令 `pnpm check:audit`（`pnpm audit --prod --audit-level high`），当前无已知漏洞。

**验收证据**

- 安全响应头 12 项测试（8 项头策略 + 4 项应用级接线，含 302/404/503）。
- 来源检查 5 项、限流 1 项（第 121 次 429）、日志脱敏 8 项。
- 真实 HTTP 冒烟：CSP/HSTS 等头齐全；带 `?token=...` 的请求日志只留路径，敏感值 grep 计数为 0。
- `pnpm verify` 通过：584 项测试、28 项 HTTP 验收、外部资源审计通过。

**未完成 / 已知限制**

- `style-src` 保留 `'unsafe-inline'`（D34）；CSP 的实际浏览器执行效果未做 E2E。
- 阶段 9 时漏洞扫描尚未接入 CI；阶段 11 已写入工作流，分支保护的失败合并阻断已验证。日志落盘、轮转与 30 天保留属阶段 12。
- 公开 API 限流为进程内实现（D35）。

## 7. 阶段 10：PWA、缓存与更新 ✅

**范围与交付**：版本化清单与 SHA-256 校验、同源 manifest/192/512 图标、三份 Service Worker 脚本、双语首页离线兜底、静态资源按需缓存、更新确认与失败重试、「修复安装」及可见 buildId。字体约 5 MB 采用按需缓存；旧 buildId 的壳层、运行时及引擎缓存在新版本完整激活后一起清除。Cache Storage 操作不触及 IndexedDB。

**验收证据**：`scripts/verify-stage-10.mjs` 对最终构建产物做 99 项检查，覆盖清单完整性与哈希、完整/失败安装、确认前不激活、离线导航、损坏缓存修复、回滚及本地资产边界；服务端 PWA 路由和前端更新交互有定向测试。`pnpm verify` 仍是全量门禁。具体代码与限制见 [09](09-pwa-cache-update.md)。

**已知限制**：没有可执行工具或真实引擎，无法实际验证引擎重新下载后的执行；Node VM 验收不能代替真实浏览器 E2E。阶段 11 已补首次安装、离线首页及 IndexedDB 边界，跨版本更新与修复故障矩阵仍依赖模拟。主 JS 仍有 Vite 体积提示；阶段 11 已对首页资源字节设预算。

## 8. 阶段 11：CI、性能与质量门禁 ✅

**交付**：`.github/workflows/quality.yml` 覆盖冻结锁文件安装、PostgreSQL 测试库、格式/Lint/类型、Vitest 覆盖率、构建、HTTP/PWA 验收、Playwright Chromium、完整公开与管理 OpenAPI 兼容性、注册表/i18n、重复代码、性能预算与生产依赖漏洞分级。真实浏览器 9 项测试覆盖双语首页、搜索、预览工具直达、任务样本、后台失败关闭、404、CSP、Service Worker 离线首页与 IndexedDB 保留。

**基线与预算**：8 包 V8 覆盖率记录在 `quality/coverage-baseline.json`，门禁允许各指标最多回退 5 个百分点；重复代码扫描当前 0 处。Chromium 中英文首页分别采样 7 次，编码后页面资源字节为 2,306,700 / 1,537,951；用户确认的硬上限为 2,539,520 / 1,699,840。FCP/LCP 中位数 148 / 136 ms 仅报告，不阻断。详细测量环境与样本见 `quality/performance-baseline.json`。

**证据与限制**：`pnpm install --frozen-lockfile` 与 `pnpm verify:stage11` 本地通过，包含 Vitest 593、HTTP 28、PWA 99、Playwright 9、OpenAPI 脚本测试 3、11 路径兼容检查、覆盖率 8 包、重复代码 0 处、性能预算及漏洞审计。[云端 `quality` 运行](https://github.com/Stellan-Frost/iTools/actions/runs/39363058759) 在 `b8677ac` 成功；临时 [PR #1](https://github.com/Stellan-Frost/iTools/pull/1) 的格式检查失败后，受保护 `main` 返回 `mergeable_state: blocked`。逐项记录见 [13](13-acceptance-open-decisions.md)。后台 E2E 目前只验证无数据库时的安全失败，真实管理员登录流程仍无浏览器覆盖。

**验收**：干净环境可复现；硬性检查失败阻止合并；安全告警与严重漏洞门禁分级；性能预算有真实基线；E2E 覆盖首页、搜索、工具直达、任务、后台、错误路径。

## 9. 阶段 12：部署、备份与恢复

**任务**：Docker Compose、反代模板、网络规则、健康检查、部署脚本入 Git；密钥经环境/只读文件注入；健康检查失败自动回滚应用；迁移失败停止发布并保留现场。

**验收**：配置/镜像可追溯，秘密不进 Git/镜像；源站不能绕过代理；回滚演练可复现且不自动反向迁移；备份策略与失败告警可验证；RTO/RPO 24 小时目标与“未定期演练”的限制有记录。

**进入准备（2026-10-20，尚未开始阶段 12）**：阶段 11 的本地、云端 CI 与分支保护验收现已完成，满足 §11 的前置阶段规则。阶段 12 的实施仍需按下列顺序留下可复现证据；生产环境动作遵守 [11](11-deployment-operations-recovery.md) 的批准要求。

阶段 12 开始后按以下顺序交付，并为每项留下可复现证据：

1. 固定部署拓扑与配置边界：应用、PostgreSQL、反向代理的 Compose 配置和网络规则；只由反向代理暴露公网端口，应用与数据库不直接暴露；运行时密钥从环境或只读文件注入。核对 `SITE_ORIGIN`、健康检查及 D35 多实例限流方案。
2. 建立可追溯构建与发布脚本：记录源码提交、镜像标识和配置版本；显式执行迁移与 Seed。迁移失败立即停止发布并保留诊断现场，不自动反向迁移。
3. 实现应用健康检查失败后的自动回滚；回滚范围只含应用镜像与配置，不含数据库迁移或数据恢复。用故障注入验证旧版本重新可用，并记录操作步骤与结果。
4. 建立 PostgreSQL 备份、保留、校验、异地存放与失败告警；在隔离环境做恢复演练，记录实测 RTO/RPO。24 小时目前只是目标；未建立定期演练前必须继续注明限制。
5. 验证代理绕过、TLS、缓存/404（D03）、日志保留与告警，再运行全量质量门禁并把证据写入 [13](13-acceptance-open-decisions.md)。

真实服务器、域名与证书、备份存放位置、保留周期、告警接收渠道及生产发布窗口须在实施前明确。生产部署、生产迁移、恢复演练和公网配置变更须按 [11](11-deployment-operations-recovery.md) 获得用户批准。

## 10. 阶段 13：全局验收与交付

**任务**：执行 [13](13-acceptance-open-decisions.md) 全量清单；整理测试报告、变更/依赖清单、迁移计划、备份恢复与回滚计划；核对各 Agent 报告与文件范围。

**验收**：硬性测试通过或明确列为阻塞；每阶段有目标/证据/负责人；已知限制与未决决策完整；文档与代码一致；部署计划经用户明确批准，不自动部署。

## 11. 阶段推进规则

- 不跳过前置阶段；并行开发必须先冻结所依赖接口。
- “完成”意味着验收证据存在，不等同于文档写好。
- 测试失败、契约冲突、隐私边界不清或破坏性行为未获批准时，阶段状态为 `blocked`。
- 与既定用户决策不一致的实现必须先提交变更提案，不得静默改动。
- 每个阶段必须满足 [15](15-mandatory-code-requirements.md) 的五项强制代码要求。
