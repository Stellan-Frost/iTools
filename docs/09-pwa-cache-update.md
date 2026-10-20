# 09 · PWA、缓存与更新

> 定位：阶段 10 的实现、缓存边界、更新时序、恢复方式与验收证据。
> 状态：**阶段 10 已实现**。Service Worker、Web App Manifest、离线首页、更新确认和「修复安装」已接入；阶段 11 已完成首次安装、离线首页与 IndexedDB 边界的 Chromium E2E。

## 1. 当前能力与入口

- 生产客户端在页面加载后注册 `/sw.js`，scope 为 `/`；开发模式不注册。入口是 `apps/web/src/pwa/use-pwa-update-manager.ts`，协议见 `sw-protocol.ts`。
- 构建插件在 `apps/web/vite.config.ts` 生成同一 buildId 的客户端标识、Worker 脚本和 `sw-manifest.json`。清单记录每个预缓存资源的字节数与 SHA-256；构建后的 11 个资源包含主 JS、CSS、manifest、品牌图标与 192/512 PNG 图标，不含字体。SSR 的 `/zh-CN` 与 `/en` 首页在安装时另行下载。
- Worker 由 `apps/web/public/sw.js` 加载 `sw-offline.js` 与 `sw-core.js`。生产服务仅放行这三份脚本、`manifest.webmanifest` 与 `sw-manifest.json` 的固定根路径。脚本均为 `application/javascript`、`no-cache`；`/sw.js` 另带 `Service-Worker-Allowed: /`。
- 「应用信息」入口位于桌面顶部栏和紧凑抽屉。对话框显示当前 buildId，并提供检查更新、确认更新、失败重试和「修复安装」。中英文文案都来自 i18n 资源。
- 离线刷新已缓存的首页可启动应用。未缓存的工具导航、任务页和管理页会收到明确的离线页面；页面内任务和管理状态也会提示离线。现有工具仍全部为预览，**没有可执行工具或真实引擎**。

## 2. 缓存与数据边界

缓存按 buildId 分为 `itools-precache-<buildId>`、`itools-runtime-<buildId>`、`itools-engines-<buildId>`。壳层和双语首页安装时预取；同源 `/assets/`、`/brand-icon/`、manifest 与引擎资源按需缓存。`/api/**`、三份 Worker 脚本和 `sw-manifest.json` 始终走网络，不缓存会话或用户数据。

**字体采用按需缓存。** 当前字体约 5 MB，若全部预取会大幅增加首次安装成本。访问过的字体可在离线时复用；从未访问的子集离线时回落到系统字体。此选择不改变 D36 的更新语义，后续可根据阶段 11 的真实浏览器和性能基线调整。

Cache Storage 与 `@itools/asset-store` 的 IndexedDB 是不同边界。Worker 只操作名称以 `itools-` 开头的 Cache Storage；清理和修复都不调用 IndexedDB 删除。引擎缓存随新版本激活一起清空；未来接入引擎工具时，必须在重新下载成功前显示「需联网重新下载」。

## 3. 更新与修复时序

1. 新 Worker 先下载整个版本清单、校验字节数与 SHA-256，并预缓存双语首页。任何一项失败都删除该新版本的半成品缓存，旧 Worker 和旧缓存继续可用。
2. 完整下载后向页面发 `update-ready`。首次安装的同 buildId 通知不弹更新对话框；真正的新版本必须由用户确认后才发送 `apply-update` 和调用 `skipWaiting()`。对话框始终说明更新可能中断运行中的任务。
3. `activate` 先验证新缓存完整，再删除所有旧 `itools-` 缓存（包括引擎），最后接管页面。页面只在已批准本次更新的 `controllerchange` 后刷新。不保留上一版本缓存；部署回滚属于阶段 12。
4. 下载失败时显示可重试状态；同一 buildId 连续两次失败后停止自动弹窗，手动检查入口仍可用。首次安装失败不会误称旧版仍可用。
5. 「修复安装」经二次确认后先完整下载并验证暂存缓存，再替换当前版本。当前缓存缺资产或完成标记时也能修复；替换失败则从备份恢复。成功后只保留当前 buildId 的三类规范缓存，并刷新页面。修复不会清空本地资产。

## 4. 验证

```sh
pnpm build
node scripts/verify-stage-10.mjs
pnpm verify
```

`verify-stage-10.mjs` 对最终构建产物检查 buildId、资源存在性、字节数、SHA-256、JS/CSS/manifest/图标、字体排除和 Worker 脚本加载；通过 Node VM 模拟 Cache Storage、网络与客户端，覆盖完整/失败安装、更新确认、激活清旧、API 直通、离线导航、损坏缓存修复、替换失败回滚及 IndexedDB 不变。服务端另有固定 PWA 路由的 HTTP 测试。**这些是构建产物与模拟环境验收，不等于真实浏览器 E2E。**

阶段 11 Playwright 已在真实 Chromium 中验证首次安装后断网刷新、旧 Cache Storage 清理，以及 IndexedDB 数据保留。跨版本更新拒绝/失败/成功、关闭页面时的更新、字体回落，以及 Safari 等浏览器差异仍缺 E2E；这些行为的可模拟部分由 `verify-stage-10.mjs` 覆盖。当前没有真实工具，因此「未缓存引擎时离线执行」只能验证缓存与提示规则，不能做真实工具执行测试。

## 5. 相关决策与限制

- D01：IndexedDB 永不随升级或缓存清理自动清库。
- D14：HTML、404 与静态资源沿用既有 HTTP 缓存头；Worker 脚本单独使用 `no-cache`。
- D36：完整下载后确认切换；新版本激活时清所有旧缓存和引擎；不保留客户端旧版。
- 主 JS 仍触发 Vite 的 500 KB chunk 提示；阶段 11 已按真实 Chromium 首页基线制定资源字节预算（D37），代码拆包仍可继续优化。
