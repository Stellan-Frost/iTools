# 15 · 强制代码规范与不可违反的约束

> 定位：所有 Agent 的强制检查表。每个规则都标注了**执行手段**（自动阻断 or 评审）；写代码前过一遍第 2–5 节，提交前过第 8 节清单。
> 状态：生效中。与仓库其它要求冲突时，先核对 [13](13-acceptance-open-decisions.md) 的决策记录，不得自行选方便方案。

## 1. 门禁总览（哪些规则会被自动拦截）

| 要求 | 执行手段 | 阻断 |
| --- | --- | --- |
| 格式 | `pnpm format:check`（Prettier） | ✅ |
| Lint | `pnpm lint`（ESLint + boundaries + imports + tokens + privacy） | ✅ |
| 类型 | `pnpm typecheck`（TS strict 全家桶） | ✅ |
| 测试 | `pnpm test`（Vitest 593 项，需 `TEST_DATABASE_URL`） | ✅ |
| 构建 | `pnpm build`（Turbo） | ✅ |
| 注册表 / i18n 键 | `pnpm check:tools` / `check:i18n` | ✅ |
| 本地包禁网 | `pnpm check:privacy`（fetch/XHR/WebSocket/EventSource/sendBeacon） | ✅ |
| 外部资源 | `pnpm check:external`（构建产物不得引用外部 src/href/url） | ✅ |
| 依赖漏洞 | `pnpm check:audit`（生产依赖 high/critical 阻断，D04） | ✅ 工作流已配置；云端待验证 |
| SSR/HTTP | `node scripts/verify-stage-4.mjs`（28 项） | ✅ |
| PWA 构建/模拟 | `node scripts/verify-stage-10.mjs`（99 项，需先构建） | ✅ |
| Playwright / OpenAPI | `pnpm test:e2e` / `pnpm check:openapi` | ✅ 本地；云端待验证 |
| 覆盖率 / 重复代码 | `pnpm report:coverage` → `pnpm check:coverage`；`pnpm check:duplication` | ✅ |
| CI / 性能预算 | `.github/workflows/quality.yml` / `pnpm check:performance`（D37） | ✅ 本地；云端待验证 |

TS 编译基线（`tsconfig.base.json`）：`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`、`noFallthroughCasesInSwitch`、NodeNext（相对导入必须带 `.js`）。

## 2. 强制规则（含正反例）

### 2.1 类型与错误处理

| ❌ | ✅ |
| --- | --- |
| `function handle(data: any)` | `function handle(data: unknown)` + 类型守卫或 TypeBox 校验 |
| `// @ts-ignore` 跳过报错 | 修类型；确需放宽先提变更提案 |
| `catch (e) { /* 忽略 */ }` | 显式处理：向上抛、转错误码、或注释说明为何可安全忽略 |
| `const x = obj.data!.id` | `const id = obj?.data?.id; if (id === undefined) return …` |
| 可选字段写 `taskId: undefined` | 条件展开 `...(taskId === undefined ? {} : { taskId })` |
| 字符串比较用 `==` | `===`（ESLint `eqeqeq`） |

### 2.2 命名规范

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| 目录与普通文件 | `kebab-case` | `task-scheduler.ts`、`page-chrome/` |
| React 组件 / 类 / 类型 / 接口 | `PascalCase` | `AppShell.tsx`、`TaskScheduler`、`AssetDraft` |
| 变量 / 函数 / 属性 | `camelCase` | `parseAppPath`、`buildHeadHtml` |
| 不可变全局常量 | `UPPER_SNAKE_CASE` | `ADMIN_SESSION_IDLE_MS`、`HTML_CACHE_CONTROL` |
| 布尔 | `is/has/can/should` 前缀 | `isRateLimited`、`hasReferences` |
| 测试文件 | `<被测模块名>.test.ts(x)` | `route.test.ts`、`admin-integration.test.ts` |
| API JSON 字段 | `camelCase` | `toolId`、`availabilityOverride` |
| 数据库表/列 | `snake_case`（Drizzle 显式映射） | `tool_localizations.tool_id` |

禁止含糊命名（`data2`、`temp`、`utils` 大杂烩）与同一概念多种叫法。

### 2.3 模块化与分层

- 单文件只承担一个职责；生产源码 `max-lines: 400`（测试除外，ESLint 阻断）。
- 典型分层 `presentation → application → domain → infrastructure`，不强制建满四层，但依赖必须单向：domain 不得 import UI/Fastify/Drizzle/DOM/存储实现。
- 依赖方向白名单见 [00](00-architecture-overview.md) §3；`pnpm check:boundaries` + `check:imports` 双重阻断。
- 禁止工具间互相依赖；跨工具能力放入有所有权的共享包。

### 2.4 单一来源（DRY）

| 唯一来源 | 路径 |
| --- | --- |
| 工具身份/分类/可用性 | `packages/app-core/src/registry/**` |
| 分类与样本任务 | `packages/app-core/src/catalog/**` |
| 用户可见文案 | `app-core/src/i18n/resources/**` 或注册表双语字段 |
| 视觉 Token | `packages/design-system-adapter/src`（Web 只用 CSS 变量） |
| 状态转换表 | `task-runtime/src/domain/task-state.ts` |
| 表结构 | `packages/db/src/schema/tables.ts`（冻结，改动需确认） |

同一规则禁止出现第二个实现；复用走共享模块；例外必须在交付说明中写理由。

### 2.5 UI 与 MD3（详见 [01](01-design-system.md)）

- 禁止裸 `button/input/select/textarea`（ESLint 阻断）；禁止直接 import `m3-expressive-react`。
- 禁止十六进制颜色、内联 `style`、`!important`（`check:tokens` 阻断）。
- 文案禁止硬编码：组件里出现用户可见中英文即违规（品牌名与技术值除外）；英文页面不得出现 CJK（页面测试断言）。

### 2.6 日志与隐私

- `no-console` 只放行 `warn/error`；生产代码不得输出用户数据。
- 服务端日志只记 `time/requestId/method/path/status/durationMs`，路径去查询串（`apps/server/src/logging/request-log.ts`）。
- 错误响应固定文案 + `requestId`，禁止回显 `error.message`、SQL、堆栈、连接串。
- 用户文件、结果、任务数据只在浏览器本地；`check:privacy` 阻断 `asset-store`/`task-runtime` 的任何网络调用（新增本地包必须显式加入名单）。
- IndexedDB / Cache Storage / 生产数据库是三个数据边界；清缓存的逻辑不得触碰 IndexedDB（D01/D36）。

### 2.7 数据库与迁移

- 迁移只允许 `CREATE` / `ADD CONSTRAINT`；禁止 `DROP/TRUNCATE/DELETE`；已执行文件不得改写（checksum 拒绝）。
- 服务启动不自动迁移；迁移是显式运维命令。
- 测试只连 `_test` 后缀库（守卫拒绝其它库名）。

## 3. 注释与可读性

- 注释解释「为什么」，不复述代码；复杂算法必须说明关键思路、边界条件与复杂度。
- 函数/类型从命名即可理解用途；避免隐式副作用与技巧性写法。
- 错误处理显式；不得用无意义默认值掩盖失败。
- 未使用的变量/参数用 `_` 前缀（ESLint 豁免），否则删除。

## 4. 安全与运维红线

- CSP 默认拒绝；新增外部资源必须经用途/数据流/安全影响审核，且 `check:external` 必须仍通过（优先本地托管）。
- 公开只读 API：输入 TypeBox 校验 + 限流 + 适当缓存；管理写 API：会话 + 服务端授权 + CSRF + 来源检查。
- 生产配置经环境注入，Schema 校验失败拒绝启动，错误不泄露秘密值。
- 生产部署不自动进行，必须用户批准；健康检查自动回滚仅限应用镜像/配置，数据库迁移与数据恢复须独立审批。

## 5. 产品约束（防「顺手实现」）

- 三态可用性：`preview` 只读 + noindex、`implemented` 可执行、`disabled` 404；不得把预览写成可执行，不得伪造进度/校验/结果。
- 工具 URL 含分类；分类不匹配、停用、不存在一律真实 404，不重定向（D10）。
- 分类/图标不接受后台编辑（D29）；数据库只能下架不能启用（D27）。
- 不开展独立无障碍专项；不得扩大已确认的产品范围（改清单须先过用户）。
- 汇率工具第 68/69 题暂缓，不得推断答案。

## 6. Agent 纪律

- 不得重新询问已确认的架构事项（先查 [13](13-acceptance-open-decisions.md)）。
- 不得把假设写成用户已批准的决策；不得声称未执行的验证已通过。
- 任何偏离本规范的实现必须先提交变更提案（原因、影响、迁移、测试、回滚）。

## 7. 提交前检查清单

- [ ] `pnpm verify` 全绿（或明确列出失败项与原因）。
- [ ] 每个文件职责单一，无「上帝文件」（≤400 行）。
- [ ] 依赖方向符合 [00](00-architecture-overview.md) §3；未绕过注册表/i18n/adapter/调度器/资产仓储。
- [ ] 新代码遵守命名规范；无重复实现。
- [ ] 关键业务规则有类型、错误处理与测试；测试数量与上次基线的差值可解释。
- [ ] 用户可见文案中英同键同改，`check:i18n` 通过。
- [ ] 日志/错误信息不含凭据、文件内容、敏感参数。
- [ ] `docs/13` 决策与受影响模块文档已同步；提交信息含摘要与要点。
