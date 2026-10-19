# 品牌图标资源

此目录包含 iTools 品牌标记的六个 SVG 变体。应用内的品牌图标与工具功能图标用途不同：功能图标使用 Material Symbols，不使用本目录的品牌素材。

| 文件                       | 用途                                 |
| -------------------------- | ------------------------------------ |
| `icon-preview.svg`         | 完整品牌图标；应用顶栏品牌标记使用它 |
| `favicon.svg`              | 浏览器标签页图标                     |
| `icon-background.svg`      | 浅色图标导出的背景图层               |
| `icon-foreground.svg`      | 浅色图标导出的前景图层               |
| `icon-background-dark.svg` | 深色图标导出的背景图层               |
| `icon-foreground-dark.svg` | 深色图标导出的前景图层               |

## 当前引用

`apps/web/index.html` 将 `/brand-icon/favicon.svg` 注册为 SVG favicon；Web 公共目录通过站点根路径提供资源。应用壳在 `apps/web/src/components/app-shell/AppShell.tsx` 引用 `/brand-icon/icon-preview.svg`。`AppShell.module.css` 使用 `--itools-layout-brand-mark-size`（当前为 2rem）控制显示尺寸，并使用全圆角 token 裁切展示；该 CSS 展示方式不改变 SVG 文件本身。

四个分层 SVG 保留用于外部图标组合或导出，目前页面没有单独引用它们。仓库没有 PNG 导出、`apple-touch-icon.png` 或 PWA 图标配置，不应假定这些资源已生成。

## 来源与状态

资源来自当前提供的图标素材 ZIP；来源位置为 `C:/Users/王子涵/.codex/codex-remote-attachments/01a1528e-d1e0-71a2-abfb-bddf6d3328dc/D38206D2-E3C0-4C72-8D87-5E07CBA0D332/1-icon-pack-2.zip`。该本机路径仅作素材来源记录，不是运行依赖。ZIP 中的原始素材未修改；仓库 SVG 是应用使用的副本，配色调整为鸭青。此处描述资源用途，不表示它们通过 Apple 或 Material Design 认证。
