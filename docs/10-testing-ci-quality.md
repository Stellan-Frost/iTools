# 10 · 测试、质量与 CI

> 状态：**本地测试与质量门禁已实现；CI、Playwright、性能预算未实现（阶段 11）**。
> 当前基线：339 项 Vitest 测试、28 项生产 HTTP 验收，全部通过。

## 1. 工具链

| 工具 | 当前状态 | 用途 |
| --- | --- | --- |
| Vitest 5 | 已接入 | 单元/集成/组件测试 |
| Testing Library + jsdom | 已接入 | Web 组件与页面 |
| TypeScript `strict` | 已接入 | 类型检查 |
| ESLint 10 + Prettier | 已接入 | 代码风格与静态检查 |
| Turborepo | 已接入 | 任务编排与缓存 |
| Playwright | **未接入** | 浏览器 E2E、水合、响应式检查（阶段 11） |
| GitHub Actions | **未接入** | PR 门禁（阶段 11） |
| 依赖漏洞扫描 | **未接入** | 阶段 11 |

## 2. 本地门禁

```sh
pnpm verify                        # 总门禁：format → lint → typecheck → test → build → 注册表 → i18n → HTTP
```

分步执行：

```sh
pnpm format:check
pnpm lint                  # ESLint（严格规则）+ 清单边界 + 源码边界 + Token 检查
pnpm typecheck             # Turbo，依赖包先 build
pnpm test                  # Turbo
pnpm build
pnpm check:tools           # 需先构建 app-core
pnpm check:i18n            # 需先构建 app-core
node scripts/verify-stage-4.mjs
```

事实：

- `check:tools`、`check:i18n` 与 HTTP 验收脚本依赖构建产物，**不在 `pnpm lint` 链**；`pnpm verify` 已按正确顺序串联。
- `pnpm lint` 现在包含：ESLint 严格规则、`check-boundaries`（清单）、`check-imports`（源码 import）、`check-tokens`（硬编码颜色/内联样式）、`check:privacy`（本地包禁止网络调用）。
- 隐私门禁：`scripts/check-no-network.mjs` 扫描 `asset-store` 与 `task-runtime` 的生产源码，出现 `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon` 即失败；新增本地处理包必须加入该脚本的白名单并说明理由。
- ESLint 会阻断：`any`、裸 HTML 控件、直接使用 `m3-expressive-react`、深层导入、server 越界依赖、生产文件超过 400 行、`console.log`、未使用变量。
- `scripts/verify-stage-3.mjs` 已删除，只保留 `verify-stage-4.mjs`。
- `@itools/task-runtime` 的测试替身放在 `src/test-support/`，由 `tsconfig.build.json` 排除，**不会进入 dist**；运行时测试不依赖真实定时器、真实 Worker 或系统时钟。
- `@itools/asset-store` 同样把内存仓储与伪 URL/配额放在 `src/test-support/` 并从构建排除；IndexedDB 测试使用 `fake-indexeddb`（devDependency），**未在真实浏览器验证**。

## 3. 测试分布

| 包 | 文件 | 数量 | 覆盖 |
| --- | --- | --- | --- |
| contracts | `contracts.test.ts` | 9 | 任务状态、工具 manifest、API 错误、环境、locale、可用性、Worker 协议、资源预算、资产归档 |
| app-core | `catalog/catalog.test.ts` | 6 | 分类、样本任务、双语 |
| app-core | `registry/registry.test.ts` | 30 | 默认注册表、可见性、Sitemap、搜索、fixture 注入、执行契约、10 类校验 |
| app-core | `i18n/i18n.test.ts` | 13 | 命名空间、翻译、键一致性、extraResources |
| task-runtime | `domain/*.test.ts` | 16 | 状态机合法/非法转换、终态、资源预算三重限制 |
| task-runtime | `application/*.test.ts` | 26 | 队列顺序、三重预算、成功/失败/取消/队列满/销毁、运行时订阅与事件 |
| task-runtime | `infrastructure/worker/*.test.ts` | 24 | 协议校验、Worker 池复用与排队、启动/完成/错误/取消/超时/崩溃 |
| asset-store | `domain/*.test.ts` | 56 | 草稿校验、引用完整性、保留策略、归档编解码 |
| asset-store | `application/*.test.ts` | 45 | 对象 URL 引用计数、资产服务、结果提交、归档导入回滚 |
| asset-store | `infrastructure/indexeddb/*.test.ts` | 24 | 迁移、原子写入、删除联动、配额降级（`fake-indexeddb`） |
| asset-store | `create-asset-store.test.ts` | 6 | 真实 IDB 组装：读写、引用、URL、清理、归档往返、关闭 |
| adapter | 5 个测试文件 | 9 | Dialog、IconButton、Drawer、图标、主题 |
| web | `app/route.test.ts` | 33 | URL 解析/生成、可用性、404 |
| web | `app/seo.test.ts` | 3 | noindex、canonical |
| web | `pages/pages.test.tsx` | 15 | 六页面中英、预览态、无 CJK |
| web | `App.test.tsx` | 10 | 壳层交互、搜索、抽屉、语言切换、预览标识 |
| server | `app.test.ts` | 14 | 重定向、308、404、注入、Sitemap、robots、缓存头、静态资源 |

## 4. 新增测试要求

- 改路由/SEO：必须更新 `route.test.ts`、`seo.test.ts` 与 HTTP 验收脚本。
- 改 i18n：中英键必须同步；`i18n.test.ts` 会检查键集合与空值。
- 改注册表：必须覆盖 `check:tools` 的负向用例与 Sitemap 规则。
- 改 UI 组件：更新组件测试；不要用 `any`、`@ts-ignore` 或跳过断言来“修好”测试。
- 新增工具：契约测试、页面测试、SSR HTTP 测试独立运行，不得依赖其它工具。
- 改资产/存储：必须补充 `asset-store` 的领域或仓储测试；IndexedDB 用例使用 `fake-indexeddb`，不得依赖真实浏览器；**不得用真实用户数据作为测试夹具**。

## 5. 阶段 11 的 CI 门禁（目标）

1. 格式、Lint、类型检查。
2. 单元/集成测试。
3. Playwright 关键流程与水合检查。
4. 构建、包边界、注册表校验（`check:tools`）。
5. OpenAPI 生成与契约差异（阶段 7 后）。
6. 注册表/Seed/数据库一致性（阶段 7 后）。
7. 依赖漏洞扫描：严重且可利用漏洞阻断合并；一般告警由负责人判断。
8. CSP/安全响应头与隐私网络审计。
9. 真实 HTTP 404 与 Sitemap 检查。
10. 性能与包体预算：先测基线，再由根 Agent 提议阈值交用户确认；当前未测。

## 6. 测试数据与隔离

- 测试不得连接生产数据库或修改生产配置（当前无数据库）。
- 组件测试使用 jsdom；SSR 相关断言必须在 node 环境下运行或通过 HTTP 验收。
- 失败必须如实报告；不允许把未执行项写成通过。
