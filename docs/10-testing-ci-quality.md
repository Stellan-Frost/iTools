# 10 · 测试、质量与 CI

> 状态：**本地测试与质量门禁已实现；CI、Playwright、性能预算未实现（阶段 11）**。
> 当前基线：139 项 Vitest 测试、28 项生产 HTTP 验收，全部通过。

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
pnpm format:check
pnpm lint                  # ESLint + check-boundaries
pnpm typecheck             # Turbo，依赖包先 build
pnpm test                  # Turbo
pnpm build
pnpm check:tools           # 需先构建 app-core
node scripts/verify-stage-4.mjs   # 需先 build
```

事实：

- `check:tools` 与 HTTP 验收脚本依赖构建产物，**不在 `pnpm lint` 链**；先 build 再运行。
- 阶段 3 的旧验收脚本已删除，只保留 `verify-stage-4.mjs`。
- `pnpm lint` 的边界检查只校验包清单，不解析源码 import。

## 3. 测试分布

| 包 | 文件 | 数量 | 覆盖 |
| --- | --- | --- | --- |
| contracts | `contracts.test.ts` | 6 | 任务状态、工具 manifest、API 错误、环境、locale、可用性 |
| app-core | `catalog/catalog.test.ts` | 6 | 分类、样本任务、双语 |
| app-core | `registry/registry.test.ts` | 30 | 默认注册表、可见性、Sitemap、搜索、fixture 注入、执行契约、10 类校验 |
| app-core | `i18n/i18n.test.ts` | 13 | 命名空间、翻译、键一致性、extraResources |
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
