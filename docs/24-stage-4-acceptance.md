# 24 · 阶段 4 验收记录

> 记录日期：2026-10-19。范围与冻结接口见 [23 · 阶段 4 冻结](23-stage-4-freeze.md)。本阶段按用户决定「先建全局框架、后设计具体工具」实施：**没有发布任何可执行工具**，预览工具带明确标识且不可执行。

## 1. 交付物

| 位置 | 内容 |
| --- | --- |
| `packages/contracts/src/tool-registry.ts` | `TOOL_AVAILABILITIES` 三态、`ToolCatalogMetadata`、`RegistryEntry` 联合类型、`isPreviewEntry` / `isImplementedEntry` |
| `packages/app-core/src/registry/**` | 7 条默认条目（6 preview + 1 disabled）、`createToolRegistry`、查询/搜索/Sitemap 路径、`validateToolRegistry`、30 项测试 |
| `packages/app-core/src/catalog/**` | 裁剪为分类 + 样本任务；工具数据唯一来源迁至注册表 |
| `packages/app-core/src/i18n/**` | `createI18n(locale, extraResources?)`、预览状态与工具页说明文案；删除失效的伪执行文案键 |
| `apps/web` | 路由放宽到 preview、SEO 预览页 noindex、壳层/卡片/工具页预览标识与只读态、SEO 测试 |
| `scripts/check-tool-registry.mjs` | `pnpm check:tools`：结构/翻译/引用校验，非零退出 |
| `scripts/verify-stage-4.mjs` | 生产产物 HTTP 验收（28 项） |

## 2. 实际执行命令与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm format:check` | 通过 |
| `pnpm lint` | 通过（ESLint + 依赖边界 + 未包含 check:tools） |
| `pnpm typecheck` | 通过，8/8 Turbo 任务 |
| `pnpm test` | 通过，8/8 Turbo 任务；分包含计 **139 项**：contracts 6、app-core 49、adapter 9、web 61、server 14 |
| `pnpm build` | 通过，5/5 Turbo 任务 |
| `pnpm check:tools` | 通过：共 7 条（preview 6、implemented 0、disabled 1），样本任务 3 条，无 issue |
| `node scripts/verify-stage-4.mjs` | **28/28 通过** |

未执行：真实浏览器交互/水合测试（阶段 11 Playwright）、CI 阻断、数据库一致性。

## 3. 行为验收

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 注册表结构、三态可用性、唯一 ID/routeKey | ✅ | app-core 30 项注册表测试 |
| 预览工具在导航、搜索、首页、分类可见且带“预览”标识 | ✅ | web 组件测试 + `PreviewBadge` |
| 预览工具页 200、输入禁用、无伪执行结果、`noindex` | ✅ | HTTP 验收 + 页面测试 + `seo.test.ts` |
| 停用工具 404 且不缓存 | ✅ | HTTP 验收（csv-inspector） |
| Sitemap 只含首页、分类；排除 preview/disabled/tasks | ✅ | HTTP 验收 |
| 搜索/导航不含停用工具 | ✅ | web 测试 |
| 注册表校验负向用例（重复 ID、非法分类、缺翻译、命名空间、contractVersion、样本任务引用） | ✅ | registry 测试 + `check:tools` |
| 执行契约（TypeBox 校验 → adapter 执行 → 输出校验） | ✅ | 测试专用 fixture，不进入产品注册表 |
| 工具页统一区块顺序（01 输入 / 02 工作区 / 03 任务 / 04 结果 / 致谢） | ✅ | 页面组件与测试 |
| 真实工具执行与结果 UI | ⏸ 按 D23 留到首个真实工具设计 | — |
| 任务队列/取消/持久化 | ⏸ 阶段 5 | — |
| Seed / 数据库一致性 | ⏸ 阶段 7 | — |
| CI 阻断 / Playwright E2E | ⏸ 阶段 11 | — |

## 4. 关键规则

- 可用性：`preview`（可见、不可执行）、`implemented`（可执行）、`disabled`（404）。
- 预览页：HTTP 200 + `<meta name="robots" content="noindex">`，不进 Sitemap；导航/搜索/卡片显示“预览”徽标。
- 停用页：HTTP 404，`Cache-Control: no-store`。
- Sitemap 当前为 12 条 URL（2 语言 × 首页 + 5 分类），没有工具页，符合“只收录已实现工具”的规则。
- 工具元数据、可用性、分类全部来自 `@itools/app-core` 注册表；`app-core/catalog` 不再保存工具副本。
- 预览页输入框禁用，任务区/结果区仅显示静态说明，不再出现“校验通过”“等待中”等伪执行反馈。

## 5. 已知限制

1. **没有可执行工具**：默认注册表 `implemented` 为 0；首个真实工具及其执行 UI 尚未设计，属于用户明确的下一轮范围。
2. **执行契约仅 headless 验证**：fixture 证明了校验/执行/输出校验，但没有真实页面驱动。
3. **浏览器水合仍未测**：React 水合与交互仍只在 jsdom 覆盖。
4. **CI 阻断未接入**：`check:tools` 依赖构建产物（先 `pnpm build`），只能本地或后续 CI 调用。
5. **阶段 3 的 `verify-stage-3.mjs` 已过时**：Sitemap 与工具索引断言不再适用，脚本顶部已标注，当前门禁使用 `verify-stage-4.mjs`。
6. **预览徽标对辅助技术隐藏**：为避免改变按钮/对话框的可访问名称，徽标标记 `aria-hidden`；状态语义由预览说明文本承载，导航中暂无等价文本，属于已知取舍。
7. **包体仍偏大**：未做代码分割，客户端与 SSR bundle 与阶段 3 相当。

## 6. 结论

阶段 4 的“全局框架”部分完成并通过可独立验收项：注册表、三态可用性、预览页规则、统一页面骨架、校验脚本与契约测试。真实工具、执行 UI、任务运行时、数据库与 CI 按 D22/D23 延后，不得把本阶段描述为“工具已可用”。
