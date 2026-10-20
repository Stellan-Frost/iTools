# 13 · 验收、未决事项与决策记录

> 定位：全局验收清单、验证快照、全部决策（D01–D37）与未决事项。任何「为什么这样做」的问题先查这里。
> 状态：生效中。阶段详情见 [14](14-phase-implementation-roadmap.md)。

## 1. 当前验证快照（2026-10-20）

| 项 | 结果 |
| --- | --- |
| 测试 | 593 项通过：contracts 9、app-core 49、task-runtime 66、asset-store 131、db 65、adapter 9、web 102、server 162 |
| 类型检查 | 12/12 Turbo 任务通过 |
| 格式 / Lint | 通过（ESLint + 依赖边界 + Token + 隐私） |
| 构建 | 8/8 任务通过（client + SSR + server + 6 包） |
| 数据库 | 本地便携 PostgreSQL 17.6；迁移 0001+0002、Seed、管理端到端在真实库运行 |
| 安全响应头 | 12 项：CSP 指令、HSTS 开关、200/302/404/503 全覆盖；外部资源审计通过 |
| 管理端到端 | 8 项 inject + 真实 HTTP 冒烟（setup 201/Cookie → 无 CSRF 403 → 带 CSRF 200 → 登出 204 → 写 401 → CLI 重置口令） |
| 注册表校验 | `check:tools` 通过：7 条（preview 6、implemented 0、disabled 1），3 条样本任务 |
| HTTP 验收 | 28/28（302/308/200/404、noindex、Sitemap、robots、缓存头） |
| PWA 构建/模拟验收 | `verify-stage-10.mjs` 99/99：资源哈希、更新、离线与修复；完整更新故障矩阵仍由模拟环境覆盖 |
| Playwright Chromium | 9/9：双语首页水合、搜索、预览直达、任务样本、后台失败关闭、404、CSP、SW 离线首页与 IndexedDB 保留 |
| OpenAPI 兼容性 | 公开与管理 API 共 11 条路径相对冻结基线无破坏性变更；3 项检查脚本测试通过 |
| 覆盖率 / 重复代码 | 8 包 V8 覆盖率均在记录基线 5 个百分点以内；≥10 行且 ≥80 token 的重复块 0 处 |
| 性能预算 | 中文首页 2,306,700 / 2,539,520 bytes，英文 1,537,951 / 1,699,840 bytes，均通过；FCP/LCP 只报告 |
| 依赖审计 | `pnpm check:audit` 通过：当前生产依赖 0 项已知漏洞；D04 high/critical 阻断规则已写入工作流 |
| API 冒烟 | 生产模式实跑：`/api/v1/tools` 200（`max-age=60`）、未知工具 404、`/health/ready` 200、OpenAPI 5 条路径 |
| 隐私门禁 | `check:privacy` 通过：asset-store / task-runtime 生产源码无网络调用 |
| 浏览器 E2E | Chromium 9 项已执行；真实管理员登录、跨版本 SW 更新和 Safari 差异未覆盖 |
| IndexedDB 验证 | `fake-indexeddb` 单元测试及真实 Chromium PWA 边界 E2E 已通过；Safari 与多标签事务未覆盖 |
| 真实 Worker 脚本 | **未实现**（阶段 5 用测试替身验收） |
| CI | [云端 `quality` 运行](https://github.com/Stellan-Frost/iTools/actions/runs/39363058759) 在 `b8677ac` 成功；受保护 `main` 的失败合并阻断由 [PR #1](https://github.com/Stellan-Frost/iTools/pull/1) 验证 |

## 2. 全局验收清单

| 项 | 状态 |
| --- | --- |
| Monorepo、包边界、锁文件、共享契约 | ✅ 阶段 1 |
| MD3 设计系统、主题、响应式壳层 | ✅ 阶段 2 |
| 双语 SSR、语言 URL、真实 404、Sitemap、canonical/hreflang | ✅ 阶段 3 |
| 三态工具注册表、预览页规则、注册表校验、统一页面骨架 | ✅ 阶段 4 |
| 任务状态机、队列、Worker、取消 | ✅ 阶段 5（运行时包 + fixture 验收，未接工具与 UI） |
| IndexedDB 文件资产、保留、导入导出 | ✅ 阶段 6（D01 已决，未接工具与 UI） |
| PostgreSQL、Drizzle、TypeBox API、OpenAPI | ✅ 阶段 7（只读 API；写接口属阶段 8） |
| 唯一管理员、会话、CSRF、限流、元数据回滚 | ✅ 阶段 8（含后台界面与密码恢复命令） |
| CSP、安全响应头、公开 API 限流、脱敏日志、依赖扫描 | ✅ 阶段 9（漏洞合并阻断属阶段 11 CI） |
| 首个真实工具与执行 UI | ⏳ 待排期（D24 清单已确认；运行时已就绪） |
| PWA、缓存清理、更新失败恢复 | ✅ 阶段 10（D36；构建产物和 Node VM 验收，浏览器 E2E 属阶段 11） |
| CI、Playwright、性能预算 | ✅ 阶段 11 本地及云端通过，失败合并阻断已验证 |
| Docker Compose、备份、回滚 | ⏳ 阶段 12 |
| 全局交付与生产部署批准 | ⏳ 阶段 13；部署须用户明确批准 |

## 3. 决策记录（已决，按编号排序）

| 编号 | 决策 |
| --- | --- |
| D01 | IndexedDB 升级只走版本化增量迁移，迁移只允许建仓/建索引；**永不自动清库**，迁移缺失直接 abort；重置仅限用户显式 `reset()`（可先导出归档）。保留是默认，清库是例外。 |
| D02 | 已并入 D36。 |
| D03 | （未决，见 §4）CDN 长缓存与停用工具 404 的一致性。 |
| D04 | 阶段 11 CI 对生产依赖的 high/critical 漏洞告警阻断；low/moderate 只报告。用户于 2026-10-20 确认。 |
| D05 | 只做唯一管理员；不开放注册、不做多管理员协作。 |
| D06 | 不依赖数据库/任务运行时的部分先验收；数据库启用状态、Seed 一致性、结果持久化在阶段 7 后验收。 |
| D08 | 分类固定 `audio/image/video/text/other`；阶段 2 的预览分类退役。 |
| D09 | 工具目录由代码注册表提供；数据库接入后保持同一 URL 与可用性规则。 |
| D10 | 工具 URL 必须含分类；分类不匹配、停用、不存在均 404，不重定向。 |
| D11 | `/` 302 → `/zh-CN`；非根尾斜杠 308。 |
| D12 | 语言切换保留当前路由。 |
| D13 | 任务页、管理页 `noindex`，robots 禁止抓取，不进 Sitemap。 |
| D14 | HTML `max-age=0, must-revalidate`；404 `no-store`；Sitemap/robots `max-age=300`；assets 一年 immutable。 |
| D15 | SSR `ssr.noExternal` 必须含 app-core、adapter、`m3-expressive-react`、`@material/material-color-utilities`。 |
| D16 | （未决，见 §4）任务/资产端口冻结时机。 |
| D17 | 首页首屏保留全局搜索；`openSearch` 纳入 `AppNavigation` 上下文。 |
| D18 | server dev 用 `node --watch-path=./src`；不得监听全仓库。 |
| D19 | 可用性三态 `preview / implemented / disabled`，取代 `enabled: boolean`。 |
| D20 | 预览页 200 + noindex、不进 Sitemap；停用页 404。 |
| D21 | 导航、搜索、卡片可展示预览工具，但必须带「预览」徽标。 |
| D22 | 注册表是工具元数据与可用性的唯一来源；`app-core/catalog` 只留分类与样本任务。 |
| D23 | 阶段 4 只建框架不发布真实工具；执行契约用 fixture 验证，执行 UI 留给首个真实工具。 |
| D24 | 工具清单（31 条 / 30 可执行 + 1 仅导航）：文本 8、图像 7、音频 5、视频 7（含「转 GIF 仅导航」）、其他 4。清单只定范围，不改变 `implemented = 0`。 |
| D25 | 阶段 5 只交付运行时本体（测试替身验收）；不接真实工具、任务 UI、持久化。 |
| D26 | 阶段 6 只交付 `@itools/asset-store` 本体；`createAssetResultCommitter` 以结构兼容对接 `commitResult`，不引入包依赖。 |
| D27 | 目录采用 **M1**：注册表是身份/分类/可用性唯一来源；数据库只存覆盖（order / 双语文案 / `availability_override` 只能 `'disabled'`）；Seed 值等于默认值时 `source` 仍为 `registry`。 |
| D28 | `packages/db` 承载目录合并，允许依赖 `@itools/app-core`；`apps/server` 只依赖 `contracts` + `db`。 |
| D29 | 后台**不开放分类与图标编辑**（属工具身份，只由注册表决定）；后台只能改双语文案、排序、启停。 |
| D30 | 元数据版本保留每个「工具 + 语言」**最近 50 版**，按数量清理；当前生效版本永不清理。 |
| D31 | 管理员初始化 = 环境变量 `ADMIN_SETUP_TOKEN` + 网页初始化页；令牌只与内存环境变量比对，不落库不写日志；未设置时入口不存在；成功后永久关闭。 |
| D32 | 版本快照按 **(tool, locale)** 记录三条文案；排序与启停不进版本历史。 |
| D33 | 后台界面用 effect + 局部状态取数，不接 TanStack Query；`admin-queries.ts` 选项留给后续页面。 |
| D34 | CSP `style-src` 保留 `'unsafe-inline'`（MD3 输出元素级 style 属性）；`script-src` 保持严格 `'self'`。 |
| D35 | 公开只读 API 进程内固定窗口限流（每 IP 120 次/分钟）；多实例各自计数，集中限流属阶段 12。 |
| D36 | PWA 更新 = **B + E1 + R1**：新版本先在版本化 cache（`<buildId>`）内完整下载，全部成功才 activate 并清空全部旧缓存（**含引擎**），失败则旧版本完整可用 + 提示 + 重试（连续 2 次失败停止自动提示）；不留上一版本，提供「修复安装」；版本回退只走服务端部署回滚。 |
| D37 | 阶段 11 性能门禁：基于 2026-10-20 的真实 Chromium 基线，首页 `pageEncodedBodyBytes` 中文不得超过 2,539,520，英文不得超过 1,699,840；每种语言 7 次采样取最大值判断。FCP/LCP 只报告，不用受机器负载影响的时间值阻断 CI。用户于 2026-10-20 确认。 |

## 4. 未决

| 编号 | 事项 | 影响/门槛 |
| --- | --- | --- |
| D03 | CDN 长缓存与停用工具 404 的一致性 | 404 已实现；CDN TTL 与缓存绕过须部署阶段实测 |
| D16 | 任务/资产端口是否冻结 | 目录端口已冻结；任务与资产端口仍只有单一实现，暂不冻结 |
| — | 首个真实工具排期与注册表注入点重构 | 清单已定（D24）；`视频转 GIF` 仅导航与 D10 冲突，实现时须先给方案（跳转图像分类，不在视频分类建条目） |
| — | 汇率工具第 68/69 题 | 已列入 D24；数据来源、精度与更新策略未决，**不得推断答案** |
| — | 字体预缓存策略 | 阶段 10 采用按需缓存，避免首次安装额外预取约 5 MB；离线未访问子集回落系统字体。阶段 11 根据浏览器与性能基线复核 |

## 5. 阶段验收记录要求

每个阶段结束必须记录：阶段编号、目标、范围与非范围；修改文件清单；实际执行的命令与结果（含测试数量与失败项）；验收标准逐项状态；证据位置；未解决问题与已知限制；是否允许进入下一阶段。**缺少可复现证据即视为未验收**，不得用口头声明替代。

### 阶段 10 验收记录（2026-10-20）

| 项 | 记录 |
| --- | --- |
| 目标 | 提供可安装的 PWA 壳层、受控更新、离线首页与失败修复，落实 D36 缓存边界。 |
| 范围 | 同源 manifest/图标、构建时资源清单及 SHA-256、Service Worker 三类版本化缓存、更新确认/重试/修复 UI、双语离线状态、服务端静态路由与缓存头。 |
| 非范围 | 真实工具或引擎执行、浏览器 E2E、CI、性能预算、部署；分别留待后续阶段或工具排期。 |
| 修改文件 | `apps/web/public/{sw.js,sw-core.js,sw-offline.js,manifest.webmanifest,brand-icon/icon-192.png,brand-icon/icon-512.png}`、`apps/web/vite.config.ts`、`apps/web/index.html`、`apps/web/src/{pwa,components/pwa,App.tsx,components/app-shell,pages}`、`apps/server/src/{app.ts,index.ts,pwa}`、`packages/app-core/src/i18n/resources/{zh-CN,en}`、`scripts/verify-stage-10.mjs`、根及 db/server/web 的 `package.json`、`eslint.config.mjs`、`README.md`、`docs/{00,04,05,06,07,08,09,10,13,14,15}*`。 |
| 实际命令 | `pnpm test:db`：65/65；`pnpm verify`：格式、Lint/边界/隐私、类型检查 12/12、Vitest 593/593、构建 8/8、外部资源/注册表/i18n、HTTP 28/28、PWA 99/99，全部通过。之前全量运行曾因数据库测试并发重置共享 schema 与 Web 测试 5 秒超时失败；已将测试任务串行、db/server 文件串行并将相关超时设为 30 秒，最终复验无失败项。 |
| 验收标准 | 清单资源完整与哈希 ✅；失败安装保留旧版本 ✅；用户确认后激活并清理旧壳层/引擎缓存 ✅；离线首页与状态提示 ✅；损坏缓存修复及交换失败回滚 ✅；IndexedDB 不受缓存清理影响 ✅；全量门禁 ✅。 |
| 证据位置 | `scripts/verify-stage-10.mjs`（最终构建产物 + Node VM 99 项）、`apps/server/src/pwa/app.test.ts`、`apps/web/src/components/pwa/*.test.tsx`、`docs/09-pwa-cache-update.md`。 |
| 已知限制 | 阶段 10 验收时浏览器 E2E 尚未执行；没有可执行工具或真实引擎，无法实测引擎离线执行；未访问字体子集离线时回落系统字体；主 JS 有 Vite 体积提示。阶段 11 后续补充了部分浏览器 E2E 与性能基线。 |
| 下一阶段 | 阶段 10 已验收；用户已确认进入阶段 11。 |

### 阶段 11 本地验收记录（2026-10-20）

| 项 | 记录 |
| --- | --- |
| 目标 | 把现有本地质量检查扩展到真实浏览器、契约兼容性、覆盖率、重复代码、性能与漏洞分级，并写入可复现的 GitHub Actions 工作流。 |
| 范围 | PostgreSQL `_test` 库上的 Vitest/完整 OpenAPI、Chromium E2E、8 包 V8 覆盖率门禁、源码重复块检查、D37 首页字节预算、D04 生产依赖漏洞分级、PR/push 工作流。 |
| 非范围 | GitHub 仓库连接、云端 Actions 实跑、分支保护设置、生产部署、真实工具执行；用户选择先完成本地验收。 |
| 修改文件 | `.github/workflows/quality.yml`、`playwright.config.ts`、`tsconfig.e2e.json`、`e2e/{app,pwa}.spec.ts`、`scripts/{check-coverage,check-openapi-diff,check-openapi-diff.test,openapi-compatibility,measure-performance,performance-budget,performance-budget.test,performance-report}.mjs`、`quality/{coverage,openapi,performance}-baseline.json`、根 `package.json` / `pnpm-lock.yaml` / `.gitignore`、`README.md`、`docs/{00,07,08,09,10,13,14,15}*`。 |
| 实际命令 | `pnpm install --frozen-lockfile` 通过；`pnpm verify:stage11` 通过，其中格式/Lint/边界/隐私、类型检查 12/12、Vitest 593/593、构建 8/8、HTTP 28/28、PWA 99/99、Playwright 9/9、OpenAPI 脚本测试 3/3 与 11 路径兼容检查、覆盖率 8 包、重复块 0、性能预算两语言通过、生产依赖审计 0 告警。新增性能预算负向探针 2/2 单独复跑通过；定向 `pnpm typecheck:e2e` 已通过。 |
| 验收标准 | 锁文件安装可复现 ✅；硬检查本地失败即非零退出 ✅；D04 安全分级已获用户确认并写入工作流 ✅；D37 预算有真实基线且已获用户确认 ✅；指定页面与错误路径 E2E ✅；GitHub 云端运行与分支保护的补充验收见下表。 |
| 证据位置 | `.github/workflows/quality.yml`、`e2e/`、`scripts/{check-openapi-diff,performance-budget}.test.mjs` 负向探针、`quality/coverage-baseline.json`、`quality/openapi-baseline.json`、`quality/performance-baseline.json` 与 `docs/10-testing-ci-quality.md`。 |
| 已知限制 | Chromium E2E 未覆盖真实管理员登录、跨版本 SW 更新/修复及 Safari；性能墙钟数仅报告。覆盖率报告只计入 V8 捕获的文件。云端补充验收见下表。 |
| 下一阶段 | 本地交付通过；云端补充验收完成后，阶段 12 的前置门槛已满足。 |

### 阶段 11 云端补充验收（2026-10-20）

| 项 | 记录 |
| --- | --- |
| 仓库与范围 | [Stellan-Frost/iTools](https://github.com/Stellan-Frost/iTools) 已连接；用户确认改为公开仓库，以启用当前账号方案下的分支保护。公开前扫描了 Git 历史与文件名，并轮换与历史测试值相同的本机 PostgreSQL 口令；`.env` 未纳入 Git。 |
| 成功路径 | 提交 `b8677ac5b0a8962b8a8868487342d62ac25f2852` 的 [Actions 运行](https://github.com/Stellan-Frost/iTools/actions/runs/39363058759) `quality` 成功；包括 Linux Chromium 字节预算、OpenAPI、覆盖率及生产依赖审计。 |
| 分支保护 | `main` 要求由 GitHub Actions 提供的 `quality` 检查（App ID 15368）、分支与主干同步、经 PR 合并；管理员同样受约束，0 位必需审阅者，禁止强推和删除。 |
| 负向探针 | 临时 [PR #1](https://github.com/Stellan-Frost/iTools/pull/1) 故意加入未格式化 JSON，`Check formatting` 失败；在非 draft 状态下 `mergeable_state: blocked`。验收后已关闭 PR 并删除分支。 |
| 结论与限制 | 阶段 11 验收完成，允许进入阶段 12。已证实格式失败阻止合并；高危依赖漏洞的负向路径未单独注入，Safari 与真实管理员浏览器流程仍未覆盖。 |
