# 09 · PWA、缓存与更新

> 定位：定义离线能力边界、Cache Storage 分区、更新时序与失败恢复，供阶段 10 实施；也说明当前为什么“看起来能离线”并不成立。
> 状态：**未实现（阶段 10）**。无 Service Worker、无 manifest、无 Cache Storage 使用、无更新提示；更新策略已由 D36 决定（B 原子切换 + E1 引擎随壳层清空 + R1 不留旧版）。
> 代码入口（现状）：`apps/server/src/app.ts`、`apps/server/src/security/headers.ts`、`apps/web/index.html`、`apps/web/vite.config.ts`、`packages/asset-store/src/infrastructure/indexeddb/**`。本文 §2 标注“待新增”的文件尚不存在。

## 1. 当前事实

- 全站没有任何 Service Worker 注册：`apps/web/src` 中不存在 `navigator.serviceWorker`、`caches`、`workbox` 关键字；`apps/server/src` 没有 `/sw.js` 路由。
- 没有 Web App Manifest：`apps/web/index.html` 只有 favicon、viewport 与两个 SSR 占位符；没有 `<link rel="manifest">`、`theme-color`、apple-touch-icon。
- 因此当前**完全依赖网络**：断网后刷新即失败，不存在“上次可用工具”；也没有安装入口。
- 未匹配路径统一走 `setNotFoundHandler`，所以 `GET /sw.js`、`GET /manifest.webmanifest` 现在都返回 **404 + `no-store`**（HTML 404 页面，不是 JS/JSON）。
- CSP 已为此预留：生产 `worker-src 'self' blob:`、`manifest-src 'self'`（`apps/server/src/security/headers.ts:44-45`）；生产 `script-src` 仍为 `'self'`，因此 SW 脚本必须同源、不得内联注册。
- 构建产物体积（壳层，`apps/web/dist/client/assets` 实测）：

| 项 | 体积 | 说明 |
| --- | --- | --- |
| JS | 0.6 MB（1 个文件） | `index-*.js` |
| CSS | 0.4 MB（1 个文件） | `index-*.css` |
| 字体 | 5.3 MB（109 个文件） | 其中 108 个 woff2 子集约 4.9 MB，另 1 个 woff 回退 |
| 合计 | 约 6.3 MB | 目录占用 6.6 MB；任务书基线记为 5.4 MB（JS 0.6 + CSS 0.4 + 字体 4.9），与实测差异来自字体文件计数与取整，阶段 11 性能基线时校准 |

- 构建没有 buildId/版本号注入：`vite.config.ts` 未定义 `define`，HTML 与客户端都没有可读版本标识；`public/` 只有 `brand-icon/`。
- IndexedDB 已由 `@itools/asset-store` 使用（`assets/blobs/references/tasks/meta`），与 Cache Storage 完全独立；D01 规定升级只能增量迁移、永不自动清库。

## 2. 代码地图

| 路径 | 职责 | 状态 |
| --- | --- | --- |
| `apps/server/src/app.ts` | 路由注册顺序；`/sw.js` 必须在此注册，且排在 404 处理器之前 | 现有；需改 |
| `apps/server/src/security/headers.ts` | CSP `worker-src`/`manifest-src`；SW 响应也要经过安全头 | 现有，已预留 |
| `apps/web/index.html` | manifest 链接、theme-color、SW 注册入口的宿主 | 现有；需改 |
| `apps/web/vite.config.ts` | 构建产物清单与 buildId 注入点 | 现有；需改 |
| `apps/web/public/manifest.webmanifest` + 图标 | Web App Manifest 与 192/512 图标 | **待新增** |
| `apps/web/src/pwa/register.ts` | 注册、更新检测、消息通道（`update-available` / `update-applied`） | **待新增** |
| `apps/web/src/pwa/update-store.ts` | 更新状态机：idle / downloading / ready / failed / repairing | **待新增** |
| `apps/web/src/components/pwa/UpdatePrompt.tsx` | 更新提示、失败重试、任务运行中确认、「修复安装」入口 | **待新增** |
| `apps/web/public/sw.js`（或构建生成） | precache、activate 清理、运行时缓存、引擎缓存 | **待新增** |
| `apps/web/src/pages/**` | 需在工具页/设置区暴露“需联网重新下载”状态与当前版本 | 现有；需改 |
| `packages/asset-store/**` | IndexedDB 数据边界，**不得**被缓存清理逻辑触碰 | 现有，不改 |

## 3. 必须遵守的规则

1. 缓存分区固定为三类，名称带 buildId：壳层 `itools-precache-<buildId>`、运行时 `itools-runtime-<buildId>`、重型引擎 `itools-engines-<buildId>`。检查：DevTools → Application → Cache Storage 只应出现当前 buildId。
2. 更新顺序不可交换：**先在 `itools-precache-<new>` 内完整下载并校验全部条目 → 全部成功 → `skipWaiting`/activate → 删除所有非当前 buildId 的 cache**。任何“先清后下”都视为缺陷。
3. activate 必须清空**全部**旧 cache，包括 `itools-engines-*`（E1）；不得只删 precache。
4. 引擎被清空后，引擎类工具在重新下载成功前必须显示「需联网重新下载」，禁止显示“仍可离线”（E1）。
5. 不保留上一版本（R1）：客户端不做版本回退；回退只走服务端部署回滚。
6. 必须提供「修复安装」：删除全部 `itools-*` cache 后按当前 buildId 全量重下，仅用于修复半损坏缓存。检查：执行后 Cache Storage 只剩当前 buildId 且应用可离线启动。
7. 下载失败：**放弃本次安装，旧 cache 与旧版本保持完整**，提示「更新未完成，仍使用上一版本」并提供重试；同一 buildId 连续失败 2 次后不再自动提示，改为设置项内手动触发。
8. 更新必须由用户确认；有运行中任务时先提示中断风险。禁止在用户确认前 `skipWaiting`、`reload()` 或让新 SW 接管页面；`clients.claim()` 只能在用户同意本次更新后的 activate 中执行。
9. `/sw.js` 必须从根路径提供、`Content-Type: application/javascript`、`Cache-Control: no-cache`（可加 `Service-Worker-Allowed: /`）；注册 scope 为 `/`。不得走 `/assets/*` 的一年 immutable 缓存。
10. 不得用缓存清理逻辑删除 IndexedDB：清 Cache Storage 与清 IndexedDB 是两个独立动作，后者只能由用户显式触发（D01）。
11. 运行时缓存只允许同源静态资源与已审核的 GET 响应；`/api/v1/**` 的认证/管理响应、任何含凭据或个人数据的响应必须 network-only。
12. manifest 必须同源、含 `name`/`short_name`/`start_url`/`display`/`theme_color`/`background_color` 与 192×192、512×512 图标；图标放在 `public/`，不得引用外部 CDN。
13. 离线兜底：导航请求失败时返回缓存的 `/{locale}` 文档；`/{locale}/tasks`、`/{locale}/admin` 在离线时必须给出明确不可用说明，不得展示过期数据为最新。
14. 版本可见：界面必须能读到当前 buildId（设置/关于区域），否则失败提示与「修复安装」无法自证。

## 4. 禁止事项

| ❌ 错误做法 | ✅ 正确做法 |
| --- | --- |
| activate 里先 `caches.delete()` 再 `addAll()` | 新 cache 全部写成功后才 activate 并清理旧 cache |
| 只删 `itools-precache-*`，保留 `itools-engines-*` “提升体验” | 一并删除；UI 标注「需联网重新下载」（E1） |
| 更新时直接 `skipWaiting()` + `location.reload()` | 先经用户确认；有运行任务时提示中断风险 |
| 清缓存时顺手 `indexedDB.deleteDatabase('itools')` | 只动 `itools-*` cache；IndexedDB 永不随缓存清理 |
| 把 `/api/v1/tools` 或 admin 会话响应放进 runtime cache | 只缓存静态资源；API 一律 network-only |
| 引擎被清后仍显示“可离线使用” | 显示「需联网重新下载」，并在下载成功后恢复 |
| 更新失败后仍宣称“旧版本已不可用” | 明确「更新未完成，仍使用上一版本」并给重试 |
| 为省事保留上一 buildId 的 precache | 只保留当前 buildId（R1）；修复走「修复安装」 |
| 连续失败仍每次弹窗 | 同一 buildId 失败 2 次后停止自动提示，转手动 |
| 把字体 4.9 MB 全量塞进 precache 而不做决策 | 字体是否全量预缓存尚未决定（§7），决策前不得写入清单 |

## 5. 如何验证

**现在（未实现，用于确认“确实没有”）**

```sh
grep -rn "serviceWorker\|caches\.\|workbox" apps/web/src apps/server/src   # 期望：无输出
grep -n "manifest" apps/web/index.html                                      # 期望：无输出
# 端口以 PORT 为准（默认 5173，本仓库 .env 为 3000）
curl -sI http://127.0.0.1:5173/sw.js                 # 期望：404 + cache-control: no-store
curl -sI http://127.0.0.1:5173/manifest.webmanifest  # 期望：404 + cache-control: no-store
curl -sI http://127.0.0.1:5173/zh-CN | grep -i content-security-policy     # 期望含 worker-src 'self' blob:
du -sh apps/web/dist/client/assets && ls apps/web/dist/client/assets | grep -c woff2  # 6.6M / 108
```

**阶段 10 完成后必须逐项通过（当前未执行，不得写成已通过）**

| 场景 | 期望 |
| --- | --- |
| 首次访问后断网刷新 | 应用可启动，首页与已访问静态资源可用 |
| 离线打开从未访问的工具页 | 给出离线说明，不白屏、不伪造数据 |
| 未缓存引擎时离线执行 | 阻止执行并提示「需联网重新下载」 |
| 更新下载中刷新/关页 | 旧版本仍完整可用，不出现半损坏状态 |
| 更新下载失败 | 版本号不变、旧 cache 完整、提示可重试 |
| 更新成功 | 旧 buildId 的 cache 数量为 0 |
| 运行任务时触发更新 | 先确认，取消则不更新、任务继续 |
| 清缓存后检查 IndexedDB | 资产、引用、任务记录数量不变 |
| 「修复安装」 | 全量重下后离线启动成功 |
| 连续 2 次失败 | 第 3 次起不再自动弹提示 |

## 6. 常见任务（step-by-step）

### 6.1 接入最小可用的 SW 骨架

1. 新增 `apps/web/public/sw.js`，只做 `install`（`addAll` 当前 buildId 的壳层清单）、`activate`（删非当前 cache）、`fetch` 直通。
2. `apps/web/src/pwa/register.ts` 在 `window.load` 后 `navigator.serviceWorker.register('/sw.js', { scope: '/' })`，只在 `import.meta.env.PROD` 执行。
3. `apps/server/src/app.ts` 在 `registerOpenApi`/`registerApi` **之前**加 `GET /sw.js`：读产物、设 `application/javascript`、`Cache-Control: no-cache`，文件缺失时 404（不得 500）。
4. 在 `index.html` 加 `<link rel="manifest" href="/manifest.webmanifest">`，`manifest.webmanifest` 与图标放 `public/`。
5. 跑 §5 的 curl 检查，确认 `Content-Type` 与缓存头正确，且不再落到 HTML 404。

### 6.2 生成 precache 清单与 buildId

1. 在 `vite.config.ts` 用构建钩子读取 `dist/client` 产物，生成 `{ buildId, files: [...] }`，写入 `dist/client/sw-manifest.json`。
2. buildId 取内容哈希或构建时间戳，注入 `sw.js` 与页面（`__BUILD_ID__` 替换），保证 SW 与页面读到同一值。
3. 清单只含 JS/CSS/HTML/图标/manifest；字体与引擎按 §7 决策处理，未决策前不加入。
4. 校验：构建后 `sw-manifest.json` 的 `files` 每项都存在于 `dist/client`，缺失即构建失败。

### 6.3 实现更新流程（D36）

1. `install` 事件：打开 `itools-precache-<new>`，`addAll` 全部条目；任一失败 → `cache.delete` 新 cache、向页面 `postMessage({ type: 'update-failed' })`、不 `skipWaiting`。
2. 全部成功 → `postMessage({ type: 'update-ready' })`，等待页面 `postMessage({ type: 'apply-update' })` 后再 `skipWaiting`。
3. `activate`：删除所有 name 以 `itools-` 开头且不等于当前三类的 cache，然后 `clients.claim()`（此时才允许接管）。
4. 页面侧 `update-store.ts`：记录 `failedBuildIds` 计数（`localStorage`），同 buildId 达 2 次后不再自动提示。
5. 任务运行中：从 `@itools/task-runtime` 读活动任务数；> 0 时提示“更新会中断任务”，用户确认后才发 `apply-update`。

### 6.4 实现「修复安装」

1. 设置/关于区域提供入口，二次确认文案说明“将清空离线缓存，不影响本地资产”。
2. 执行：`caches.keys()` → 删除所有 `itools-*` → `registration.unregister()` → 重新 `register` 并按当前 buildId 全量下载。
3. 完成后提示“修复完成”，并刷新页面；失败保留当前可用状态并提示重试。

### 6.5 接入引擎缓存（工具实现后）

1. 引擎包声明自身资源清单与体积（注册表/工具包元数据），由 SW 在首次使用时下载到 `itools-engines-<buildId>`。
2. 下载完成前，工具页禁用执行并显示“需联网下载引擎”。
3. 更新成功后引擎 cache 被清空，工具页必须回到“需联网重新下载”，不得沿用旧状态标记。

## 7. 已知限制与相关决策

- 阶段 10 未开始：本文所有“必须”均为待实施规范，不代表已具备离线能力；当前断网即不可用。
- 字体策略未决：108 个 woff2 子集约 4.9 MB，占壳层绝大多数；全量预缓存会显著放大首次安装成本，按需缓存又会让离线中文字体缺字。需先定策略再写清单。
- 本地调试：`http://127.0.0.1` / `http://localhost` 属安全上下文，可注册 SW；局域网 IP 的 http 不行，必须 HTTPS。
- 无 Playwright：SW 生命周期、离线启动、更新失败恢复无法进 CI 自动验证，属阶段 11。
- 无 buildId 注入管线，需在阶段 10 一并补齐，否则 D36 的“版本化 cache + 失败计数”无法落地。
- 不做客户端版本回退（R1）；回退由服务端部署回滚承担（阶段 12）。
- 相关决策：D02 已决为 **D36**（B + E1 + R1）；D01（IndexedDB 永不自动清库）；D14（缓存头）。全文见 [13](13-acceptance-open-decisions.md)。
