# 08 · 安全与隐私

> 定位：把「用户数据不出浏览器、管理面最小暴露、日志不含敏感值」落实为可检查的响应头、认证、限流、门禁与数据边界。
> 状态：已实现（阶段 9）。依赖漏洞合并阻断（阶段 11 CI）、WAF/源站防护与日志 30 天保留（阶段 12）未实现。
> 代码入口：`apps/server/src/security/headers.ts`、`apps/server/src/admin/auth/guard.ts`、`apps/server/src/api/routes.ts`、`apps/server/src/logging/request-log.ts`、`scripts/check-no-network.mjs`、`scripts/check-external-resources.mjs`。

## 1. 当前事实

| 面 | 暴露内容 | 现有控制 |
| --- | --- | --- |
| 公网 SSR / 静态 | 页面 HTML、`/assets`、`/brand-icon` | 安全头全覆盖；CSP 严格；无外部资源 |
| 公开 API | 目录元数据（无用户数据） | 只读 GET；120 次/分/IP；固定错误文案 |
| 管理 API | 文案/排序/启停/版本 | 唯一管理员；scrypt；HttpOnly 会话；CSRF + Origin；5 次/15 分钟 |
| 用户文件 | 只在浏览器 IndexedDB（`itools-assets`） | 无上传端点；`check:privacy` 禁止本地包联网 |
| 数据库 | 目录覆盖、管理员凭据/会话/版本 | 开发期仅本机 `127.0.0.1`；不存用户内容 |
| 日志 | stdout 单行 JSON | 只 6 个字段；路径去查询串；不读头/体 |
| 第三方依赖 | npm 包 | 锁文件固定；`check:audit`（未阻断） |

安全响应头（`headers.ts`）：

| 头 | 值 |
| --- | --- |
| `content-security-policy` | 12 条指令：`default-src`、`script-src`、`style-src`、`img-src`、`font-src`、`connect-src`、`worker-src`、`manifest-src`、`object-src`、`base-uri`、`form-action`、`frame-ancestors` |
| 生产 CSP | `script-src 'self'`；`style-src 'self' 'unsafe-inline'`（D34）；`img-src 'self' data: blob:`；`worker-src 'self' blob:`；`object-src 'none'`；`base-uri 'self'`；`form-action 'self'`；`frame-ancestors 'none'` |
| 开发 CSP | 额外放行内联脚本与 `connect-src ws:`（Vite HMR），兜底指令保留 |
| 其余 | `x-content-type-options: nosniff`、`referrer-policy: strict-origin-when-cross-origin`、`x-frame-options: DENY`、`permissions-policy` 禁用 camera/microphone/geolocation/payment、`cross-origin-opener-policy: same-origin` |
| HSTS | 仅当 `SITE_ORIGIN` 是 https：`max-age=31536000; includeSubDomains` |

- 安全头经 `app.ts:53` 的 `onSend` 统一注入；`hasHeader` 保证不覆盖业务已设置的同名头。
- 认证：scrypt（N=16384, r=8, p=1）；token 只存 sha256；空闲 7 天滑动 + 绝对 30 天；登录轮换；双提交 CSRF；Cookie `itools_admin`（HttpOnly/SameSite=Strict）+ `itools_admin_csrf`。
- 限流：登录 5 次/15 分钟、公开 API 120 次/分钟，均为进程内固定窗口，超限 429 + `retry-after`。
- 测试：headers 8、app-security 4、guard-origin 5、rate-limit 1、request-log 8，均属 server 159 项。

## 2. 代码地图

| 路径 | 职责 |
| --- | --- |
| `apps/server/src/security/headers.ts` | CSP 指令、基础头、HSTS 开关、`onSend` 钩子 |
| `apps/server/src/app.ts` | 安全头与请求日志钩子的接线顺序 |
| `apps/server/src/admin/auth/guard.ts` | 会话解析 + CSRF 双提交 + Origin 校验 |
| `apps/server/src/admin/auth/cookies.ts` | Cookie 属性（Path/SameSite/HttpOnly/Secure） |
| `apps/server/src/admin/auth/csrf.ts` | 16 字节随机令牌与常量时间比较 |
| `apps/server/src/admin/auth/rate-limit.ts` | 固定窗口实现（含 1024 键清理阈值） |
| `apps/server/src/api/routes.ts` | 公开 API 限流、429 头、缓存策略、固定错误码 |
| `apps/server/src/logging/request-log.ts` | 单行 JSON、字段白名单、路径去查询串 |
| `apps/server/src/config.ts` | `ADMIN_SETUP_TOKEN` ≥24 字符、`DATABASE_URL` 前缀校验 |
| `apps/server/src/index.ts` | 仅生产注入 `logRequests`；`secureCookies = siteOrigin 为 https` |
| `scripts/check-no-network.mjs` | 本地处理包禁网扫描（`check:privacy`） |
| `scripts/check-external-resources.mjs` | 构建产物外链扫描（`check:external`） |
| `scripts/check-import-boundaries.mjs` | 源码依赖方向（含 server 只依赖 contracts/db） |
| `package.json` | `lint` 串联 `check:privacy`；`verify` 串联 `check:external` |

## 3. 必须遵守的规则

| 规则 | 可检查点 |
| --- | --- |
| 安全头必须覆盖所有响应 | `app.ts:53`；`app-security.test.ts` 断言 302/404/503 均带头 |
| 不得覆盖业务已设的同名头 | `applySecurityHeaders` 的 `reply.hasHeader`（`headers.ts:64-82`） |
| 生产 `script-src` 只能是 `'self'` | `headers.ts:37-39`；`app-security.test.ts:79` 反向断言 |
| `style-src` 保留 `'unsafe-inline'` | D34；改动必须同步 `headers.test.ts:79` 的完整指令数组 |
| HSTS 只在 https 站点下发 | `isHttpsOrigin`（`headers.ts:97`）；http 测试断言无该头 |
| 口令与 token 不得明文落库 | `password.ts`（scrypt）、`tokens.ts`（sha256）；库里只有 `password_hash` 与 `token_hash` |
| 会话 Cookie 必须 HttpOnly + SameSite=Strict | `cookies.ts:14-15,57-78`；CSRF Cookie 例外（需 JS 读取） |
| 非 GET/HEAD 必须 CSRF + Origin | `guard.ts:80-95`；`guard-origin.test.ts` 5 项 |
| 限流阈值不得随手改 | 登录 `admin/types.ts:24`、公开 `api/routes.ts:22`；改则同步测试 |
| 429 必须带 `retry-after` 且 `no-store` | `routes.ts:39-47`；`api/rate-limit.test.ts` 第 121 次 |
| 日志字段固定 6 个 | `RequestLogEntry`（`request-log.ts:10-19`）与 `formatRequestLog`（`:36-45`） |
| 日志路径必须去查询串 | `extractPath`（`:30-33`）；不得原样输出 `request.url` |
| 本地处理包不得联网 | `check-no-network.mjs` 的 `FORBIDDEN_PATTERNS`；`pnpm check:privacy` 已并入 lint |
| 构建产物不得引用外部资源 | `check-external-resources.mjs`；`pnpm verify` 在 build 后执行 |
| 不得把用户文件/结果写入生产库 | 无上传路由；契约无文件字段；`check:privacy` + 评审兜底 |
| 秘密只来自环境变量 | `config.ts`；令牌 <24 字符拒绝启动；不得写入代码、镜像或日志 |

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| 生产 CSP 给 `script-src` 加 `'unsafe-inline'` | 保持 `'self'`；开发放宽只走 `isProduction` 分支 |
| 为了让样式通过把 `style-src` 收紧到 `'self'` | 保留 `'unsafe-inline'`（D34），否则 MD3 元素级 style 全失效 |
| 在 `asset-store` / `task-runtime` 里 `fetch` 上传 | 本地处理包禁止一切出网 API，门禁会失败 |
| 引入 CDN 字体、脚本或图片 | 本地托管；`check:external` 会阻断构建产物外链 |
| 日志里记 `request.url`、Cookie、Authorization、body | 只记 path（去查询串）与状态/耗时 |
| 对 http 本地站点也下发 HSTS | 仅在 `SITE_ORIGIN` 为 https 时下发 |
| 失败登录就永久锁定账号 | 固定窗口 15 分钟，窗口结束自动恢复 |
| 把用户文件或处理结果写进生产 DB「方便统计」 | 用户数据只留浏览器 IndexedDB；DB 只存目录覆盖与管理数据 |

## 5. 如何验证

```sh
pnpm check:privacy
# 期望：隐私边界检查通过：2 个本地包无网络调用。

pnpm build && pnpm check:external
# 期望：外部资源审计通过：<N> 个 HTML/CSS 文件无外部引用。

pnpm check:audit
# 期望：No known vulnerabilities found（当前基线；阶段 11 工作流已加入 D04 分级门禁，云端运行通过）

pnpm test
# 期望：593 passed（server 162 中：headers 8、app-security 4、guard-origin 5、rate-limit 1、request-log 8）

grep -rn "fetch(\|XMLHttpRequest\|new WebSocket\|EventSource\|sendBeacon" \
  packages/asset-store/src packages/task-runtime/src
# 期望：无输出
```

```sh
# 安全头（http 站点不应出现 strict-transport-security）
curl -sI http://127.0.0.1:3000/zh-CN | grep -iE \
  'content-security-policy|x-content-type-options|referrer-policy|x-frame-options|permissions-policy|cross-origin-opener-policy'
# 六项齐全；CSP 含 frame-ancestors 'none'，且 script-src 为 'self'

# 公开 API 限流：120 个 200 + 1 个 429
for i in $(seq 1 121); do
  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/v1/health/live
done | sort | uniq -c

# 日志脱敏：生产模式启动后发带敏感查询串的请求
curl -s 'http://127.0.0.1:3000/api/v1/tools?token=secret' >/dev/null
# stdout 该行只有 path="/api/v1/tools"，grep secret 应为 0
```

## 6. 常见任务（step-by-step）

### 6.1 调整 CSP

1. 只改 `apps/server/src/security/headers.ts` 的 `directives` 数组；顺序固定，便于快照与审查。
2. 同步 `apps/server/src/security/headers.test.ts:79` 的完整 `toEqual` 数组，否则测试立即失败。
3. 生产不得加 `'unsafe-inline'` / `'unsafe-eval'` 到 `script-src`；开发放宽只能经 `options.isProduction` 分支。
4. 需要新来源时优先本地托管：`check:external` 不允许构建产物引用外域；确需放行要先审核用途与数据流，再同时改 CSP 与审计脚本。
5. `pnpm --filter @itools/server test` 与 `pnpm build && pnpm check:external` 都通过才算完成。

### 6.2 新增本地处理包并纳入隐私门禁

1. 确认包只做浏览器内处理，不引入 HTTP/WS/Beacon；下载模型或引擎的逻辑留在壳层。
2. 在 `scripts/check-no-network.mjs` 的 `LOCAL_ONLY_PACKAGES` 加 `packages/<name>`，并在注释里写明理由。
3. `pnpm check:privacy` 期望「3 个本地包无网络调用」；`pnpm lint` 自动包含该检查。

### 6.3 调整限流

1. 公开 API 改 `apps/server/src/api/routes.ts:22` 的 `PUBLIC_RATE_LIMIT`；登录改 `apps/server/src/admin/types.ts:24` 的 `ADMIN_LOGIN_RATE_LIMIT`。
2. 不要改成永久锁定或渐进延迟（与登录策略冲突）。
3. 更新 `api/rate-limit.test.ts`（第 121 次）与 `admin/auth/rate-limit.test.ts`（窗口边界）；多实例前先评估集中限流（D35）。

### 6.4 修改日志字段

1. 只允许运行状态字段：在 `RequestLogEntry` 与 `formatRequestLog` 同步增删，保持固定键顺序。
2. 禁止加入 `headers`、`body`、`query`、`userId`、`fileName`、`toolInput`。
3. 更新 `request-log.test.ts`：查询串、Cookie、Authorization、body 均不得出现在输出；写失败必须继续吞掉。

### 6.5 新增管理写路由的安全接线

1. 必须 `preHandler: deps.guard`（会话 + CSRF + Origin），不得自定义宽松校验。
2. 响应 `cache-control: no-store`；错误只走 `sendAdminError`。
3. 补 401/403 测试，并参考 `guard-origin.test.ts` 覆盖缺失/跨源 Origin；权限细节见 [07](07-admin-console.md)。

## 7. 已知限制与相关决策

- D04 已决：阶段 11 的工作流对生产依赖 high/critical 告警阻断，对 low/moderate 只报告；用户于 2026-10-20 确认。云端运行与分支保护已验证；高危漏洞的负向注入未单独执行。
- D34：`style-src` 必须保留 `'unsafe-inline'`；`script-src` 不放宽。
- D35：限流为进程内固定窗口，多实例各自计数。
- 未配置 `trustProxy`（Fastify 默认 false）：`request.ip` 是直连地址；部署在反向代理后所有请求共享代理 IP，按 IP 限流会失真，阶段 12 必须处理。
- HSTS 取决于 `SITE_ORIGIN` 是否为 https；本地 http 不下发属预期。
- 没有 CSP `report-uri` / `report-to`，违规只落在浏览器控制台。
- 日志只写 stdout，无轮转、无 30 天保留（阶段 12），进程退出即丢。
- `admin_sessions.deleteExpired` 已实现但未被调用，过期会话不会主动清理。
- 依赖审计已写入阶段 11 的 CI 工作流，云端运行通过；SBOM 与许可证汇总仍未完成（阶段 13）。
- 安全测试均为 `inject` 与组件级，无浏览器 E2E；CSP 在真实浏览器中的行为未自动化验证。
