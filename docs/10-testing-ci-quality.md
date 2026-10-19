# 10 · 测试与质量门禁

> 定位：说明本地质量门禁每条命令在挡什么、584 项测试分布在哪、如何新增单测/集成/HTTP 验收、如何做负向探针，以及 CI、Playwright、性能预算的真实缺口。
> 状态：本地测试与门禁已实现（阶段 1–9 持续累积）；**CI、Playwright、覆盖率阈值、性能/包体预算未实现（阶段 11）**。
> 代码入口：`scripts/{check-boundaries,check-import-boundaries,check-design-tokens,check-no-network,check-external-resources,check-tool-registry,check-i18n-keys}.mjs`、`scripts/verify-stage-4.mjs`、`apps/web/vite.config.ts`、`packages/design-system-adapter/vitest.config.ts`、`packages/db/src/test-support/test-database.ts`。

## 1. 当前事实

基线（2026-10-19）：**584 项 Vitest 全部通过，HTTP 验收 28/28**。测试必须连接真实 PostgreSQL 的部分由 `TEST_DATABASE_URL` 提供，缺变量时直接失败而不是跳过。

| 包 | 测试文件（关键） | 数量 |
| --- | --- | --- |
| `packages/contracts` | `contracts.test.ts`（任务、manifest、API 错误、环境、locale、可用性、Worker 协议、预算、归档） | 9 |
| `packages/app-core` | `catalog/catalog.test.ts`、`registry/registry.test.ts`、`i18n/i18n.test.ts` | 49 |
| `packages/task-runtime` | `domain/*.test.ts`、`application/*.test.ts`、`infrastructure/worker/*.test.ts` | 66 |
| `packages/asset-store` | `domain/*`、`application/*`、`infrastructure/indexeddb/*`、`create-asset-store.test.ts` | 131 |
| `packages/db` | `migrate.test.ts`、`infrastructure/*.test.ts`、`catalog/*.test.ts` | 65 |
| `packages/design-system-adapter` | `Dialog` / `IconButton` / `NavigationDrawer` / `MaterialIcon` / `AppThemeProvider` / `colors` | 9 |
| `apps/web` | `app/route`、`app/seo`、`pages/pages`、`App`、`api/*`、`pages/admin/admin` | 96 |
| `apps/server` | `app`、`api/*`、`security/headers`、`logging/request-log`、`admin/**`、`catalog-integration`、`cli/reset-password-core` | 159 |
| **合计** | — | **584** |

工具链：Vitest 5.0.5（各包 `vitest run`）、`@testing-library/react` 16 + jsdom 30（web 组件）、`fake-indexeddb` 6.2.6（asset-store）、TypeScript 6.0.2 `strict`、ESLint 10 + Prettier 3.9、Turborepo 2.11。

| 缺口 | 现状 |
| --- | --- |
| Playwright / 真实浏览器 E2E | 未接入；无水合、CSP 实际执行、SW、IndexedDB 真实行为验证 |
| GitHub Actions / 任意 CI | 未接入；门禁只在本地手工执行 |
| 覆盖率阈值 | 未配置，`vitest` 未开启 coverage |
| 性能与包体预算 | 未测基线、无阈值 |
| 依赖漏洞阻断 | 有 `pnpm check:audit`，但不在 `verify` 链，不阻断合并（D04 未决） |

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `package.json` 的 `verify` | 总门禁：format:check → lint → typecheck → test → build → check:external → check:tools → check:i18n → verify-stage-4 |
| `scripts/run-turbo.mjs` | 统一以 `TURBO_TELEMETRY_DISABLED=1` 调用 turbo，保证输出与退出码透传 |
| `scripts/check-boundaries.mjs` | 只读 `package.json`，校验工作区包允许的 `@itools/*` 依赖 |
| `scripts/check-import-boundaries.mjs` | 解析源码 import/动态 import，校验依赖方向、禁止包名自引用、禁止相对导入越出包边界 |
| `scripts/check-design-tokens.mjs` | 扫描 `apps/web/src`：禁止十六进制/rgb/hsl 颜色、`!important`、`.tsx` 内联 `style={{}}` |
| `scripts/check-no-network.mjs` | 扫描 `asset-store`、`task-runtime` 生产源码，命中 `fetch`/XHR/WebSocket/EventSource/sendBeacon 即失败 |
| `scripts/check-external-resources.mjs` | 扫描 `apps/web/dist/client` 的 HTML/CSS，禁止外部 `src`/`href`/`url()` |
| `scripts/check-tool-registry.mjs` | 读取 app-core 构建产物，校验注册表、翻译、样本任务引用 |
| `scripts/check-i18n-keys.mjs` | 读取 app-core 构建产物的资源，断言每个叶子键在 `apps/web/src` 有引用 |
| `scripts/verify-stage-4.mjs` | 生产模式起真实服务（端口 5198）跑 28 项 HTTP 验收，见 §1 与 §5 |
| `apps/web/vite.config.ts` | web 的 Vitest 配置：`environment: 'jsdom'`、`setupFiles`、`css: true`、`restoreMocks`、内联 adapter/MCU |
| `packages/design-system-adapter/vitest.config.ts` | 仅内联 `@material/material-color-utilities`（其 ESM 内部导入无扩展名） |
| `packages/db/src/test-support/test-database.ts` | `assertTestDatabase`、`resetTestDatabase`、`withTestDatabase`、`withIsolatedSchema` |
| `packages/*/tsconfig.build.json` | 构建时排除 `src/**/*.test.ts(x)`；task-runtime / asset-store / db 额外排除 `src/test-support/**`，测试替身不进 dist |

测试替身位置：`packages/task-runtime/src/test-support/{fake-timer,fake-worker,fake-task-runner}.ts`、`packages/asset-store/src/test-support/{in-memory-repository,fake-object-url}.ts`、`packages/db/src/test-support/{in-memory-catalog-repository,test-database}.ts`、`apps/server/src/admin/test-support/*`。

## 3. 必须遵守的规则

1. 新测试必须放在被测模块旁，命名 `<module>.test.ts(x)`；E2E 才放 `e2e/`（阶段 11 建目录），当前无 E2E 目录。
2. 测试替身只能放 `src/test-support/`，且该路径必须被 `tsconfig.build.json` 排除。检查：`ls packages/*/dist | grep test-support` 应无输出。
3. 服务端/契约断言在 node 环境跑；只有 `apps/web` 用 jsdom。禁止在 jsdom 里断言 SSR 字符串或 HTTP 状态码。
4. 数据库测试只读 `TEST_DATABASE_URL`；db 包的库名必须以 `_test` 结尾（`assertTestDatabase`），否则直接抛错。
5. 服务端集成测试（`catalog-integration.test.ts`、`admin/admin-integration.test.ts`）会重建 schema，**必须**人工保证 `TEST_DATABASE_URL` 指向 `_test` 库；它们不复用 db 包的守卫。
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
pnpm test              # 期望 584 passed（8 个包）
pnpm build             # 期望 8/8 successful（client + SSR + server + 6 包）
pnpm check:external    # 期望：外部资源审计通过：{n} 个 HTML/CSS 文件无外部引用。
pnpm check:tools       # 期望：注册表：共 7 条（preview 6、implemented 0、disabled 1），样本任务 3 条。
pnpm check:i18n        # 期望：i18n 检查通过：所有资源键都有引用。
node scripts/verify-stage-4.mjs   # 期望：全部 28 项通过
pnpm verify            # 以上全链路；任一步失败即整体失败
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

### 6.5 接入 CI（阶段 11 待做）

1. 新 workflow 依序跑 `pnpm install --frozen-lockfile` → `format:check` → `lint` → `typecheck` → `test` → `build` → `check:tools` → `check:i18n` → `verify-stage-4.mjs`。
2. 起 PostgreSQL service（库名 `itools_test`）并注入 `TEST_DATABASE_URL`；`turbo.json` 已声明 `test.env`，否则 Turbo 严格模式会丢弃该变量。
3. 再加 Playwright job 与 `pnpm check:audit`；漏洞分级按 D04 定规则，严重且可利用才阻断。

## 7. 已知限制与相关决策

- 无 CI：所有门禁依赖开发者本地执行，无法阻止绕过；这是当前最大质量风险（阶段 11）。
- 无 Playwright：水合、CSP 实际执行、SW 生命周期、真实 IndexedDB/Worker 行为均未验证；`fake-indexeddb` 通过不等于浏览器通过。
- 服务端集成测试重建 `public` schema 且不校验 `_test` 后缀，安全性完全依赖 `TEST_DATABASE_URL` 的取值；调用前务必确认连接串。
- `check:i18n` 只查“键有引用”，不查键集合；键集断言只覆盖 `common`。
- 无覆盖率统计与阈值、无重复代码检测（doc/15 要求 CI 加入，属阶段 11）。
- 性能与包体预算未测；当前壳层约 6.3 MB（详见 [09](09-pwa-cache-update.md)），阈值须先测基线再由用户确认。
- 相关决策：D04（漏洞分级）、D06（验收顺序）、D15（SSR noExternal）、D35（进程内限流）。全文见 [13](13-acceptance-open-decisions.md)。
