# iTools 项目长期记忆

## 架构基线（阶段 3–7 后，2026-10-19）

- 8 个包：`apps/web`（React 页面 + URL 路由 + SSR 渲染函数 + SEO + API 客户端）、`apps/server`（Fastify SSR 宿主 + `/api/v1`）、`packages/app-core`（三态工具注册表 + 分类 + 样本任务 + i18n）、`packages/task-runtime`（任务状态机 + 调度器 + Worker 池）、`packages/asset-store`（资产模型 + IndexedDB 仓储 + 对象 URL + 归档）、`packages/db`（Drizzle schema + 迁移 + Seed + pg 仓储 + 目录合并）、`packages/contracts`（共享契约）、`packages/design-system-adapter`（MD3 适配）。
- 依赖方向：web → app-core / adapter / contracts；server → contracts / db；app-core → contracts；task-runtime → contracts；asset-store → contracts；db → contracts / app-core。server 不导入 web/app-core 源码，生产按文件路径加载 `apps/web/dist/server/entry-server.js`。
- 分类体系固定为 `audio/image/video/text/other`（docs/02）；工具 URL 为 `/{locale}/{category}/{toolId}`，分类不匹配/停用/不存在一律 404。
- 工具可用性三态：`preview`（可见、只读、200 + noindex、不进 Sitemap）、`implemented`（可执行、可索引、进 Sitemap）、`disabled`（404）。当前 implemented=0，Sitemap 只有首页 + 5 分类。
- 工具元数据唯一来源是 `app-core/registry`；`app-core/catalog` 不再保存工具副本。
- 路由：`/` 302 → `/zh-CN`；非根尾斜杠 308；`tasks/admin` noindex 且不进 Sitemap；HTML `max-age=0, must-revalidate`，404 `no-store`。
- SSR 必须在 `apps/web/vite.config.ts` 的 `ssr.noExternal` 中内联 `@itools/app-core`、`@itools/design-system-adapter`、`m3-expressive-react`、`@material/material-color-utilities`。

## 工程约定

- 根 `pnpm dev` 先构建 contracts/app-core/adapter，再启动 server（5173）。
- server dev 脚本必须限制监听范围：`node --watch-path=./src --import tsx src/index.ts`；监听全仓库会因 Vite 写 `node_modules/.vite` 无限重启。
- `pnpm-workspace.yaml` 的 `allowBuilds.esbuild` 必须为 `true`，否则 pnpm 11 在脚本前校验阶段失败。
- 验收脚本：`node scripts/verify-stage-4.mjs`（需先 `pnpm build`）；阶段 3 旧脚本已删除。
- 严格门禁：`pnpm verify` 串联 format/lint/typecheck/test/build/check:tools/check:i18n/HTTP。
- `pnpm lint` = ESLint 严格规则 + `check-boundaries` + `check-imports`（源码 import 方向）+ `check-tokens`（硬编码颜色/内联 style/!important）。
- ESLint 阻断：`any`、裸 HTML 控件、直接 import `m3-expressive-react`、深层 `@itools/*/src|dist`、server 越界依赖、生产文件 >400 行、`console.log`、未使用变量。
- 注册表校验：`pnpm check:tools` 依赖 app-core 构建产物，不纳入 `pnpm lint`。
- 测试基线：584 项（contracts 9 / app-core 49 / task-runtime 66 / asset-store 131 / db 65 / adapter 9 / web 96 / server 159）；HTTP 28/28。
- `pnpm lint` 含 `check:boundaries` + `check:imports` + `check:tokens` + `check:privacy`（`scripts/check-no-network.mjs`，asset-store/task-runtime 生产源码禁网）。

## 阶段 5 任务运行时（2026-10-19）

- 位置 `packages/task-runtime`，依赖仅 contracts；分层 `domain`（状态机/预算/错误）→ `application`（调度器/运行时外观/执行器契约）→ `infrastructure`（Worker 池/协议/定时器）。
- 7 态：queued / preparing / running / cancelling / completed / failed / cancelled；转换表在 `domain/task-state.ts`，非法转换抛 `invalid-task-transition`；排队取消直接 cancelled，运行中取消两步确认。
- 默认预算：并发 4、总内存 1536 MiB、单工具并发 1、队列 50、取消超时 2000ms（`application/scheduler-policy.ts`）。
- 结果必须经注入的 `commitResult` 成功才 `completed`；取消确认后迟到结果丢弃。
- 不依赖 React/DOM/Node：`TimerApi`、`now`、`createTaskId`、`onListenerError` 均注入；测试替身放 `src/test-support/`，被 `tsconfig.build.json` 排除。
- **未接线**：没有真实工具、任务 UI、真实 Worker 脚本、持久化；`implemented` 仍为 0。

## 阶段 6 本地资产存储（2026-10-19）

- 位置 `packages/asset-store`，依赖仅 contracts；分层 domain（校验/引用/保留/归档编解码）→ application（端口 + 服务 + 对象 URL + 归档）→ infrastructure/indexeddb（迁移/仓储/配额）。
- 组装入口 `createAssetStore({database, objectUrls?, quota?, now?, createAssetId?})`，返回 `{service, archive, repository, dispose}`。
- IndexedDB `itools-assets` v1：assets / blobs / references / tasks / meta；写入单事务原子化；迁移只允许建仓建索引，**绝不自动清库**（D01 已决）。
- 保留：源文件 7 天；跳过优先级 not-source > referenced > active-task；时间不可解析则保留。
- 归档：单 JSON + 内置 base64；导入先全量校验再写；replaceExisting 走内存快照恢复。
- `createAssetResultCommitter` 结构兼容 task-runtime 的 `commitResult`，不引入包依赖。
- 未接线：未接页面与任务运行时（D26）；IndexedDB 只在 fake-indexeddb 下验证。

## 阶段 7 数据库与 API（2026-10-19）

- 本机无 Docker/psql/WSL（WSL 被安全策略阻断），数据库用**便携版 PostgreSQL 17.6**：二进制 `C:/itools-pg/bin`、数据 `C:/itools-pg/data`、`127.0.0.1:5432`、库 `itools` / `itools_test`；不注册系统服务，删除目录即清理。密码见 `.env`（gitignored）。
- 启动方式：`C:/itools-pg/bin/postgres.exe -D "C:/itools-pg/data" -p 5432 -c listen_addresses=127.0.0.1`（必须以后台任务方式运行，普通 Bash 调用结束会被回收）。
- **`pnpm test` 需要数据库在运行**；`TEST_DATABASE_URL` 由 `node --env-file-if-exists=.env` 注入，且 `turbo.json` 的 `test.env` 必须声明该变量，否则 Turbo 严格模式会丢弃。
- 目录采用 M1/D27：注册表权威，DB 只存覆盖（order/双语文案/`availability_override` 仅 `'disabled'`，只能下架不能启用）；Seed 预填等值不算覆盖（`source` 仍为 registry）。
- `@itools/db` 依赖 app-core（仅读注册表）承载目录合并；server 只依赖 contracts + db。
- 迁移：`packages/db/migrations/*.sql` + 单文件单事务 + sha256 checksum；服务启动不自动迁移，需显式执行 CLI。
- 无 `DATABASE_URL` 时服务照常启动，目录回落注册表，`/health/ready` 报 `skipped`。

## 阶段 9 安全与隐私（2026-10-19，提交 f470524）

- `apps/server/src/security/headers.ts`：onSend 统一注入；生产 CSP 12 指令、`script-src 'self'`；`style-src` 必须 `'unsafe-inline'`（D34）；HSTS 仅 https。
- 管理写请求来源检查：`allowedOrigin` 由 index.ts 传 siteOrigin，非 GET/HEAD 强制 Origin 匹配（guard.ts）。
- 公开 API 限流：复用 `admin/auth/rate-limit.ts` 的固定窗口，每 IP 120 次/分钟（D35，进程内）。
- `apps/server/src/logging/request-log.ts`：单行 JSON，只含 time/requestId/method/path(去查询串)/status/durationMs，不读头与 body。
- 门禁：`check:external`（构建产物无外部资源，串入 verify）、`check:audit`（pnpm audit，未进 CI）。
- 真实 HTTP 冒烟：CSP/HSTS 等头齐全；`?token=...` 请求日志中敏感值 grep=0。

## 阶段 8 管理员后端（2026-10-19，提交 1b636c0）

- 迁移 0002：`admin_credentials`（`id = 1` 单行 check）；口令 scrypt(N=16384,r=8,p=1)，会话 token 只存 sha256 哈希。
- 会话：空闲 7 天滑动、绝对 30 天封顶；Cookie `itools_admin`（HttpOnly/SameSite=Strict）+ `itools_admin_csrf`（可读，双提交）。
- 初始化：`ADMIN_SETUP_TOKEN` 环境变量（≥24 字符，未设置则入口不存在），成功后可自动登录，重复初始化 409。
- 登录限流：进程内固定窗口 5 次 / 15 分钟，无永久锁定。
- 写接口：`PATCH metadata`（双语文案+排序）、`PATCH availability`（只能下架/恢复）、`GET versions`、`POST rollback`（带 `expectedVersionId` 防覆盖）。
- 版本快照按 (tool, locale) 存三条文案，保留 50 版；排序与启停不进入版本（D32）。
- 集成测试要独立 schema（`options=-c search_path=...`），否则两个集成测试并行 `drop schema public` 会互相踩。
- 后台 UI：初始化/登录/工具选择/双语文案/排序/上下架确认/版本回滚；管理客户端带 CSRF 头；口令恢复 CLI `pnpm --filter @itools/server admin:reset-password`。
- 已知限制：Cookie Max-Age 不随请求刷新、CSRF 不轮换、限流仅进程内、写入无事务、后台无浏览器 E2E。

## 阶段 8 决策（已实施）

- D29：后台**不开放分类与图标编辑**，只改双语文案 / 排序 / 启停（分类参与 URL 规则，图标参与注册表校验）。
- D30：元数据版本按「工具 + 语言」保留最近 **50 版**，按数量清理，当前版本不删。
- D31：管理员初始化 = **环境变量 `ADMIN_SETUP_TOKEN` + 网页初始化页**；令牌只比对不落库、不进日志；未配置时入口不存在，成功后永久关闭。
- 待办清单（32 项，含跨阶段技术债）在 `.workbuddy/plans/stage-8-todo.md`；实施仍需新增迁移 0002（`admin_credentials` 表）。

## 已确认工具清单（D24）

文本 8（字数、JSON、大小写、简繁、命名规则、文本对比、编码解码、正则）；图像 7（压缩、格式转换、裁切缩放、水印、GIF、证件照、抠图）；音频 5（格式转换、裁剪、合并、变速变调、音量标准化）；视频 7（压缩、格式转换、裁剪、水印、音频提取、关键帧提取、转 GIF 仅导航）；其他 4（二维码、时间戳、汇率、URL 编解码）。共 31 条 / 30 可执行。汇率第 68/69 题仍未决。

## 文档与 UI 约定（2026-10-19 重构后）

- 仓库只保留 `docs/00`–`15` 单套文档；`00` 是新 Agent 入口（架构、命令、代码地图、核心规则）。阶段过程稿、旧截图、`verify-stage-3.mjs` 均已删除。
- UI 禁止裸 HTML 控件；导航手风琴用 `ListItem`，品牌入口用 `IconButton`，卡片/页面/壳层共用 `components/page-chrome/PreviewBadge`。
- 预览徽标统一使用 `common:availability.preview`，不再有 `catalog:tool.previewBadge`。
- `AppShell` 仅保留状态与组合；顶栏与抽屉分别在 `AppShellTopBar.tsx` / `AppShellDrawer.tsx`。
- i18n 键必须全部有引用；资源改动后跑 `i18n.test.ts` 的键一致性检查。
- 代码审计结论：无 `any`/`@ts-ignore`、无散落品牌色；剩余缺口是 CI、Playwright、性能预算。

## 阶段 10 决策 D36（2026-10-19，提交 e399939，未开工）

- 用户在四个子问题上拍板：**B 原子切换 + E1 引擎一起清空 + R1 不留旧版**。
- 更新时序不可改回「先清空再下载」：新版本先写 `itools-precache-<buildId>`，全部成功才 activate 并删全部旧缓存（含引擎）；失败保留旧版本 + 提示「更新未完成」+ 重试；同 buildId 连续失败 2 次后不再自动提示。
- E1 的代价必须诚实呈现：更新成功后引擎类工具在重新下载前**不能离线执行**，UI 标「需联网重新下载」。
- R1：另提供「修复安装」（全量重下当前版本）修半损坏；版本回退只走服务端部署回滚。
- 实测前提：web 端当前**无 SW、无 manifest**；壳层 5.4 MB（JS 0.6 + CSS 0.4 + **108 个字体子集 4.9 MB**）；`vite-plugin-pwa@2.0.0`、`workbox-window@7.4.1` 可装；`/sw.js` 需新增根路径路由，CSP 的 `worker-src 'self' blob:` 已就绪。
- 未决：字体预缓存策略（全量 5.4 MB 首装 vs 运行时缓存），与 D36 无耦合，实施时单独对比。
- 方案对比文档：`.workbuddy/plans/stage-10-d02-options.md`。

## 提交

- `f9c1429` 阶段 3；`7d1d7b6` 阶段 4；`3fb902b` 代码规范审计与文档重构；`7a1edff` 严格代码门禁；`83f7c08` 阶段 5 任务运行时；`096843f` 阶段 6 资产存储；`7fba8b0` 阶段 7 数据库与只读 API；`7494957` 阶段 8 决策；`1b636c0` 阶段 8 管理员后端；`2d3df8d` 阶段 8 后台界面与口令恢复（阶段 8 完成）；`f470524` 阶段 9 安全与隐私；`e399939` D02 决策（D36）。均未推送。
