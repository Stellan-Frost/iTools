# 扇形工具 · 网站图标包

## 项目接入

此图标包由 iTools 网站使用，资源保存在 `apps/web/public/brand-icon/`：

- 应用栏品牌标记：`/brand-icon/icon-preview.svg`
- 浏览器标签页图标：`/brand-icon/favicon.svg`
- 前景与背景明暗图层保留用于平台图标导出，不作为功能图标使用。

网站功能图标继续使用 Material Symbols。原始 SVG 图形与配色保持不变。

遵循 Apple iOS 26 / Liquid Glass 图标规范设计：连续曲率圆角、分层结构、单一色相柔和渐变、图形简化加粗。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `icon-preview.svg` | 完整图标（含圆角），用于网站 logo、预览、导出 PNG |
| `favicon.svg` | 浏览器标签页图标，针对 16–32px 优化 |
| `icon-background.svg` | 分层文件：背景层（1024×1024，铺满、无圆角） |
| `icon-foreground.svg` | 分层文件：前景层（透明底，支点处镂空） |
| `icon-background-dark.svg` | 深色模式背景层 |
| `icon-foreground-dark.svg` | 深色模式前景层 |

## 使用方式

### 网页

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

`apple-touch-icon.png` 需要 180×180 的 PNG，可用 `icon-preview.svg` 在 Figma、Sketch 或在线工具中导出。

### Apple Icon Composer

1. 新建项目，画布 1024×1024。
2. 将 `icon-background.svg` 作为背景层，`icon-foreground.svg` 作为前景层拖入。
3. 在深色外观下分别替换为 `-dark` 版本。
4. 圆角蒙版、玻璃高光与阴影由系统自动添加，无需手动绘制。

## 设计参数

| 项目 | 值 |
| --- | --- |
| 背景渐变（默认） | `#5B67F0` → `#2A2F94` |
| 背景渐变（深色） | `#2C2C30` → `#0A0A0C` |
| 前景色（默认） | `#FFFFFF`，侧刀片不透明度 45% |
| 前景色（深色） | `#8E9BFF`，侧刀片不透明度 45% |
| 画布 | 1024×1024（分层文件）、96×96 / 32×32（预览与 favicon） |

## 注意

- 前景层的支点镂空使用了 SVG `mask`，导入前请确认所用工具支持；如不支持，可先在矢量软件中将其转为路径。
- 图标内不含文字，符合 Apple 规范。
