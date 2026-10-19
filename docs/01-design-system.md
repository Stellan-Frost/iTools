# 01 · 设计系统与视觉规范

## 规范来源
- 用户指定的 MD3 参考：[@material-3](plugin://material-3@created-by-me-remote)。设计与实现阶段应以该参考核对组件语义、布局、色彩角色及交互状态。
- 当前工具无法读取该私有插件的内容；阶段 2 依据 Material 3 官方设计说明与上游组件文档核对，插件内容待可访问时复核。不得将来源声明当作实现证据。
- 阶段 2 已选定 `m3-expressive-react@1.6.0` 作为主 React MD3 组件库，集中封装在 `packages/design-system-adapter`。该库社区规模小、单维护者风险高，已锁定版本并通过交互与视觉验收。Token、页面及验收记录见 `18-stage-2-design-system.md`。

## 视觉基线
- 使用 Material Design 3 组件体系；不得把旧版 MD2 作为当前视觉规范。
- 品牌方向：鸭青，固定种子色 `#009688`。使用 MD3 2025 `SchemeVibrant` 生成浅色/深色完整语义角色；不得把源色直接硬编码到各角色，以保留前景与容器的对比关系。
- 语义色：primary、secondary、tertiary、background、surface/surface-container、on-surface、error、success/warning 等状态色。
- 表面层级通过 MD3 语义表面色区分；阴影主要用于菜单、对话框等浮层。
- 字体：界面英文 Roboto；中文 Noto Sans SC；代码使用专用等宽字体。所有文本使用 MD3 Display、Headline、Title、Body、Label 五类各 Large/Medium/Small 共十五个 typescale 角色及其字号、字重、行高、字距 Token；不得另设任意字号。Material Symbols 字形尺寸属于图标 Token，不是文本字号。
- 图标：Material Symbols Rounded，优先本地托管。
- 形状：全局固定矩形 corner Token 使用 32px（`--itools-shape-corner-rectangle`）；Dialog 主表面保留专用 48px token（`--itools-shape-corner-dialog`），其正文中的卡片、输入框等固定矩形继续使用 32px。`none`、`full` 及圆形几何保持各自语义。主题映射由公开 ThemeProvider `style` CSS custom properties 提供，Dialog 通过 adapter 包装器在公开 `style` 入口设置专用形状 token；胶囊形 Chip/Button 继续使用 `full`。
- 信息密度：宽松展示型，允许复杂工具页面有更多滚动。
- 动效：丰富但有秩序；为页面、菜单、对话框、卡片、任务进度和结果展示定义统一时长、缓动、层级与取消规则。尊重 `prefers-reduced-motion`，避免不必要的持续动效。
- 响应式：统一断点、网格、最大内容宽度与间距；复杂工作区随可用空间重排，不维护独立移动页面。
- 交互目标至少 48 px，键盘焦点清楚可见，动效遵循系统 `prefers-reduced-motion`；视觉样式不得覆盖主组件库内部选择器或削弱原生交互。

## 组件实现
- 先评估一个仍维护且符合 MD3 的主 React 组件库；仅在必要时补充经审核的现有库。
- 通过统一适配层封装主题、组件 API 与来源；禁止重写基础 UI 组件。
- 使用组件库官方主题机制、CSS Variables、CSS Modules；禁止局部 CSS 重写基础组件样式。
- 全站禁止随意硬编码品牌色、间距、圆角、阴影和动效参数；必须引用语义 Token。
- 全局导航：840 px 及以上使用持久桌面侧栏，以手风琴展示分类和工具行，多个分类可同时展开；840 px 以下在顶栏最右显示文字“展开”，使用抽屉复用同一手风琴。600/840 px 两侧均需保持不溢出。
- 首页、搜索、最近任务、主题切换和后台入口在不同导航断点下继续可达；工具详情使用主组件库 Dialog，并提供关闭与前往工具操作。
- 全局入口：工具搜索命令面板、最近任务轻量面板；最近任务另有独立管理页面入口。
- 工具页面骨架统一为标题、简介、输入区、主工作区、任务区、结果区、底部规范/开源致谢；不适用区域按统一规则隐藏或折叠。

## 必交付
- 主题 Token 表（light/dark）、字体与图标加载规则、组件适配层目录、断点/间距表、动效 Token 表。
- 首页、分类页、工具页、管理后台桌面/移动端预览。
- 视觉检查记录与组件使用示例。
