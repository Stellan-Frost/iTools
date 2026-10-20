# 10 · 测试与质量门禁

> 定位：说明本地质量门禁每条命令在挡什么、593 项 Vitest 和 9 项浏览器 E2E 如何运行，以及 CI、覆盖率、OpenAPI、性能预算的证据与限制。
> 状态：阶段 11 本地门禁已实现；GitHub Actions 工作流已写入仓库，云端运行与分支保护因仓库暂无 Git remote 而待验证。
> 代码入口：`scripts/{check-boundaries,check-import-boundaries,check-design-tokens,check-no-network,check-external-resources,check-tool-registry,check-i18n-keys}.mjs`、`scripts/verify-stage-4.mjs`、`apps/web/vite.config.ts`、`packages/design-system-adapter/vitest.config.ts`、`packages/db/src/test-support/test-database.ts`。

## 1. 当前事实

阶段 11 本地基线（2026-10-20）：**593 项 Vitest、9 项 Playwright Chromium、HTTP 验收 28 项、PWA 构建/Node VM 验收 99 项**。数据库测试必须由 `TEST_DATABASE_URL` 连接真实 PostgreSQL；缺变量直接失败而不是跳过。

| 包 | 测试文件（关键） | 数量 |
| --- | --- | --- |
| `packages/contracts` | `contracts.test.ts`（任务、manifest、API 错误、环境、locale、可用性、Worker 协议、预算、归档） | 9 |
| `packages/app-core` | `catalog/catalog.test.ts`、`registry/registry.test.ts`、`i18n/i18n.test.ts` | 49 |
| `packages/task-runtime` | `domain/*.test.ts`、`application/*.test.ts`、`infrastructure/worker/*.test.ts` | 66 |
| `packages/asset-store` | `domain/*`、`application/*`、`infrastructure/indexeddb/*`、`create-asset-store.test.ts` | 131 |
| `packages/db` | `migrate.test.ts`、`infrastructure/*.test.ts`、`catalog/*.test.ts` | 65 |
| `packages/design-system-adapter` | `Dialog` / `IconButton` / `NavigationDrawer` / `MaterialIcon` / `AppThemeProvider` / `colors` | 9 |
| `apps/web` | `app/route`、`app/seo`、`pages/pages`、`App`、`api/*`、`pages/admin/admin`、`pwa/*`、`components/pwa/*` | 102 |
| `apps/server` | `app`、`api/*`、`security/headers`、`logging/request-log`、`admin/**`、`catalog-integration`、`cli/reset-password-core`、`pwa/app` | 162 |
| **合计** | — | **593** |

工具链：Vitest 5.0.5（各包 `vitest run`）、`@testing-library/react` 16 + jsdom 30（web 组件）、`fake-indexeddb` 6.2.6（asset-store）、TypeScript 6.0.2 `strict`、ESLint 10 + Prettier 3.9、Turborepo 2.11。

| 缺口 | 现状 |
| --- | --- |
| Playwright / 真实浏览器 E2E | 9 项本地通过：SSR/水合、搜索、预览直达、任务、后台失败关闭、404、CSP、SW 离线首页与 IndexedDB 保留；真实管理员登录、SW 多版本切换仍未覆盖 |
| GitHub Actions | 工作流已配置；没有 Git remote，云端执行和分支保护未验证，不能声称已阻止合并 |
| 覆盖率阈值 | V8 基线已记录，8 包的语句/分支/函数指标最多允许回退 5 个百分点；`report:coverage` 后运行 `check:coverage` |
| 性能与包体预算 | 中英文首页各 7 次 Chromium 基线；资源字节硬预算已按 D37 启用，FCP/LCP 只报告 |
| 依赖漏洞阻断 | D04 已确认：生产依赖 high/critical 阻断，low/moderate 只报告；本地审计 0 项，云端待验证 |

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `package.json` 的 `verify` | 总门禁：format:check → lint → typecheck → test → build → check:external → check:tools → check:i18n → verify-stage-4 → verify-stage-10 |
| `scripts/run-turbo.mjs` | 统一以 `TURBO_TELEMETRY_DISABLED=1` 调用 turbo，保证输出与退出码透传 |
| `scripts/check-boundaries.mjs` | 只读 `package.json`，校验工作区包允许的 `@itools/*` 依赖 |
| `scripts/check-import-boundaries.mjs` | 解析源码 import/动态 import，校验依赖方向、禁止包名自引用、禁止相对导入越出包边界 |
| `scripts/check-design-tokens.mjs` | 扫描 `apps/web/src`：禁止十六进制/rgb/hsl 颜色、`!important`、`.tsx` 内联 `style={{}}` |
| `scripts/check-no-network.mjs` | 扫描 `asset-store`、`task-runtime` 生产源码，命中 `fetch`/XHR/WebSocket/EventSource/sendBeacon 即失败 |
| `scripts/check-external-resources.mjs` | 扫描 `apps/web/dist/client` 的 HTML/CSS，禁止外部 `src`/`href`/`url()` |
| `scripts/check-tool-registry.mjs` | 读取 app-core 构建产物，校验注册表、翻译、样本任务引用 |
| `scripts/check-i18n-keys.mjs` | 读取 app-core 构建产物的资源，断言每个叶子键在 `apps/web/src` 有引用 |
| `scripts/verify-stage-4.mjs` | 生产模式起真实服务（端口 5198）跑 28 项 HTTP 验收，见 §1 与 §5 |
| `scripts/verify-stage-10.mjs` | 核对最终 PWA 构建产物，Node VM 模拟 Cache Storage/客户端验证 99 项更新、离线与修复行为 |
| `playwright.config.ts`、`e2e/**` | 启动无数据库生产服务，用真实 Chromium 执行 9 项浏览器验收 |
| `scripts/check-openapi-diff.mjs`、`quality/openapi-baseline.json` | 用 `_test` 数据库环境注册公开及管理 API，检测相对冻结基线的破坏性契约变更 |
| `scripts/check-coverage.mjs`、`quality/coverage-baseline.json` | 汇总各包 V8 覆盖率，阻断超过 5 个百分点的回退或缺失报告 |
| `scripts/{measure-performance,performance-budget,performance-report}.mjs`、`quality/performance-baseline.json` | 用 Chromium 测量首页并按 D37 阻断资源字节超预算；时序仅报告 |
| `.github/workflows/quality.yml` | 在 PR/push/手动触发时运行上述硬检查与依赖漏洞分级；需仓库连接和分支保护才可实际阻断合并 |
| `apps/web/vite.config.ts` | web 的 Vitest 配置：`environment: 'jsdom'`、`setupFiles`、`css: true`、`restoreMocks`、内联 adapter/MCU |
| `packages/design-system-adapter/vitest.config.ts` | 仅内联 `@material/material-color-utilities`（其 ESM 内部导入无扩展名） |
| `packages/db/src/test-support/test-database.ts` | `assertTestDatabase`、`resetTestDatabase`、`withTestDatabase`、`withIsolatedSchema` |
| `packages/*/tsconfig.build.json` | 构建时排除 `src/**/*.test.ts(x)`；task-runtime / asset-store / db 额外排除 `src/test-support/**`，测试替身不进 dist |

测试替身位置：`packages/task-runtime/src/test-support/{fake-timer,fake-worker,fake-task-runner}.ts`、`packages/asset-store/src/test-support/{in-memory-repository,fake-object-url}.ts`、`packages/db/src/test-support/{in-memory-catalog-repository,test-database}.ts`、`apps/server/src/admin/test-support/*`。

## 3. 必须遵守的规则

1. 新测试必须放在被测模块旁，命名 `<module>.test.ts(x)`；E2E 放 `e2e/`。
2. 测试替身只能放 `src/test-support/`，且该路径必须被 `tsconfig.build.json` 排除。检查：`ls packages/*/dist | grep test-support` 应无输出。
3. 服务端/契约断言在 node 环境跑；只有 `apps/web` 用 jsdom。禁止在 jsdom 里断言 SSR 字符串或 HTTP 状态码。
4. 数据库测试只读 `TEST_DATABASE_URL`；db 包的库名必须以 `_test` 结尾（`assertTestDatabase`），否则直接抛错。
5. 服务端集成测试（`catalog-integration.test.ts`、`admin/admin-integration.test.ts`）会重建 schema，**必须**人工保证 `TEST_DATABASE_URL` 指向 `_test` 库；它们不复用 db 包的守卫。根 `pnpm test` 以 Turbo `--concurrency=1` 串行运行包级测试，db/server 各自关闭 Vitest 文件并行，避免多个测试同时重建 `public` schema。
6. 不得用真实时钟/真实 Worker/真实浏览器存储替代测试替身：task-runtime 用 `fake-timer`/`fake-worker`，asset-store IDB 用 `fake-indexeddb`。
7. 禁止 `any`、`@ts-ignore`、`eslint-disable`、`.skip`、注释掉断言来“修好”测试；ESLint 会挡前两项，后两项由评审兜底。
8. 改路由/SEO 必须同时更新 `route.test.ts`、`seo.test.ts` 与 `verify-stage-4.mjs`；只改其一则门禁不完整。
9. 改 i18n 必须中英同步；`i18n.test.ts` 断言 `common` 键集与非空，`check:i18n` 断言“所有键有引用”。
10. 新增失败用例必须能在移除修复后失败（负向探针，见 §6.4）；只写“正向通过”的测试视为无效。
11. 测试数量变化必须同步本文件 §1、[13](13-acceptance-open-decisions.md) 与 [00](00-architecture-overview.md) 的基线；不得保留过期数字。
12. 任何未执行的门禁必须在报告中标注“未执行”，不得写成通过。

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 把 fake repository 放进 `src/application/` 供测试 import | 放 `src/test-support/`，并由 `tsconfig.build.json` 排除 |
| 让 `TEST_DATABASE_URL` 指向开发库 `itools` | 必须指向 `itools_test`；db 包会直接拒绝运行 |
| 用 `setTimeout(200)` 等待异步任务 | 注入 `fake-timer`，按虚拟时间推进 |
| 断言 `db.listItems()` 返回条数而不断言字段 | 断言身份、分类、可用性、排序与来源标记 |
| 用 `expect(true).toBe(true)` 占位或 `it.skip` 掉失败用例 | 删除无效用例或修复实现；skip 必须在报告中说明原因 |
| 在 jsdom 中挂载整页来验证 404 状态码 | 用 `createApp().inject()` 或 `verify-stage-4.mjs` 验证真实 HTTP |
| 改缓存头只改代码不更新 `app.test.ts` | 同步断言与 `docs/02 §1.6`，跑 `verify-stage-4.mjs` |
| 依赖本机全局安装的 psql/Playwright | 只用 `package.json` 锁定的依赖与 `C:/itools-pg/bin` 显式路径 |

## 5. 如何验证

```sh
pnpm format:check      # Prettier；期望 "All matched files use Prettier code style!"
pnpm lint              # ESLint + 边界 + 源码 import + Token + 隐私；期望全通过且无警告
pnpm typecheck         # Turbo 12 个任务；期望 12/12 successful
pnpm test              # 期望 593 passed（8 个包；db/server 文件与包级任务串行）
pnpm report:coverage   # 同一批测试启用 V8 覆盖率；产出各包 coverage/coverage-final.json
pnpm check:coverage    # 各包覆盖率相对 quality/coverage-baseline.json 回退不得超过 5 个百分点
pnpm build             # 期望 8/8 successful（client + SSR + server + 6 包）
pnpm check:external    # 期望：外部资源审计通过：{n} 个 HTML/CSS 文件无外部引用。
pnpm check:tools       # 期望：注册表：共 7 条（preview 6、implemented 0、disabled 1），样本任务 3 条。
pnpm check:i18n        # 期望：i18n 检查通过：所有资源键都有引用。
node scripts/verify-stage-4.mjs   # 期望：全部 28 项通过
node scripts/verify-stage-10.mjs  # 构建后运行，期望：全部 99 项通过
pnpm typecheck:e2e     # Playwright 配置与 E2E 严格类型检查
pnpm test:e2e          # 先构建并安装 Chromium；期望 9 passed
pnpm check:openapi     # 需 TEST_DATABASE_URL 指向 *_test；公开与管理 API 无破坏性变更
pnpm check:duplication # ≥10 行、≥80 token 的源码重复块，当前 0 处
pnpm check:performance # 构建后执行；中英文首页资源字节不得超过 D37 预算
pnpm check:audit       # 生产依赖 high/critical 漏洞阻断；low/moderate 只报告
pnpm verify            # 基础全链路；阶段 11 的新增门禁按上述命令执行
pnpm verify:stage11    # 基础全链路 + 覆盖率、OpenAPI、Playwright、重复代码、性能预算、漏洞分级
```

单元/集成子集：

```sh
pnpm --filter @itools/web test -- app/route        # 33 passed
pnpm --filter @itools/db test -- migrate           # 8 passed，需 TEST_DATABASE_URL
pnpm test:db                                       # 只跑 db 包
node --env-file-if-exists=.env scripts/run-turbo.mjs test --filter=@itools/server
```

失败时的判读：`TEST_DATABASE_URL` 缺失会抛“数据库测试无法运行”；库名不以 `_test` 结尾会抛“拒绝在数据库 … 上执行测试重置”；`check:i18n` 失败会逐条列出未引用键。

## 6. 常见任务（step-by-step）

### 6.1 新增一个纯函数单测

1. 在模块旁建 `xxx.test.ts`，`import { describe, expect, it } from 'vitest'`。
2. 只测公开行为，不 mock 同包内部函数；时间/随机数通过参数注入。
3. 跑 `pnpm --filter @itools/<pkg> test -- xxx`，再全量 `pnpm test` 确认总数更新。

### 6.2 新增数据库集成测试

1. 在 `packages/db/src/**` 建 `*.test.ts`，用 `withIsolatedSchema('tc_<feature>', async (pool) => {...})` 建独立 schema。
2. schema 名只允许 `[a-z_][a-z0-9_]*`；测试结束由 helper 关闭连接池。
3. 需要“空库全量重建”语义时用 `withTestDatabase`（会 drop `public` schema，仅限 `_test` 库）。
4. 跑 `pnpm test:db`；确认未触碰 `itools` 开发库。

### 6.3 新增一条 HTTP 验收

1. 在 `scripts/verify-stage-4.mjs` 的 `try` 块内加 `check('名称', 条件, '细节')`。
2. 需要新路径时用 `request(path)`（`redirect: 'manual'`），不要跟随重定向。
3. 同步更新 `docs/02` 的路径/缓存表与 [13](13-acceptance-open-decisions.md) 的 28 项计数。
4. 跑 `pnpm build && node scripts/verify-stage-4.mjs`，确认最后一行是“全部 N 项通过”。

### 6.4 负向探针（证明门禁真的会挡）

1. 建临时文件 `apps/web/src/__probe__.tsx`，写入 `<button>点我</button>` 与 `const c = '#ff0000';`。
2. 跑 `pnpm lint`：期望 ESLint 报“禁止裸 HTML 控件”，`check:tokens` 报“禁止硬编码十六进制颜色”，退出码非 0。
3. 再建 `apps/server/src/__probe__.ts`，`import { toolRegistry } from '@itools/app-core';`，跑 `pnpm check:imports`：期望报“@itools/server 不得依赖 @itools/app-core”。
4. 建 `packages/task-runtime/src/__probe__.ts` 写 `fetch('/x')`，跑 `pnpm check:privacy`：期望报“出现 fetch()”。
5. **删除全部探针文件**后重跑 `pnpm verify`，确认恢复通过；探针不得提交。

### 6.5 接入 GitHub 后验证 CI

1. 将仓库连接 GitHub，推送包含 `.github/workflows/quality.yml` 的分支；确认 PR 与 push 触发的 `quality` job 实际通过。工作流使用 PostgreSQL 17 的 `itools_test`，并执行锁文件安装、Vitest 覆盖率、构建、OpenAPI、Playwright、性能与漏洞门禁。
2. 在 GitHub 分支保护中将 `quality` 设为必需检查；未设置之前，工作流失败本身不能阻止合并。当前仓库无 Git remote，故这两步未执行。
3. 浏览器 E2E 的后台用例仅覆盖无数据库时的安全失败；需要隔离的浏览器管理员会话测试时，必须使用独立 `_test` 库，不复用会重建 `public` schema 的并行测试。

## 7. 已知限制与相关决策

- GitHub Actions 工作流尚未在云端运行；仓库没有 Git remote，分支保护也未设置，实际合并阻断未验证。
- Playwright 覆盖真实 Chromium 的水合、CSP、SW 首次安装/离线首页和 IndexedDB 保留；多版本更新切换、损坏修复、真实管理员登录及真实工具 Worker 仍缺浏览器 E2E。
- 服务端集成测试重建 `public` schema 且不校验 `_test` 后缀，安全性完全依赖 `TEST_DATABASE_URL` 的取值；调用前务必确认连接串。
- `check:i18n` 只查“键有引用”，不查键集合；键集断言只覆盖 `common`。
- 覆盖率指标含测试替身与已执行文件；新增未被任何测试导入的文件不一定进入 V8 报告，评审仍需检查测试覆盖范围。
- 性能基线只测单台 Windows 主机上的 Chromium 首页；CI Linux 环境的资源字节门禁尚未云端验证。FCP/LCP 与真实压缩收益仅报告，未设时序硬阈值；见 [09](09-pwa-cache-update.md) 和 `quality/performance-baseline.json`。
- 相关决策：D04（漏洞分级）、D06（验收顺序）、D15（SSR noExternal）、D35（进程内限流）、D37（性能预算）。全文见 [13](13-acceptance-open-decisions.md)。
