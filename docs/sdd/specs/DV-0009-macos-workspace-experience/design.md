---
id: DV-0009
title: macOS workspace experience refinement - Design
status: Verified
updated: 2026-08-17
---

# DV-0009：设计

## 方案摘要

采用“受控上游覆盖 + 最小 Electron 原生桥”两层实现。布局、欢迎页、输入框座位和品牌组件
由 `upstream-overrides/` 提供可跟踪源码，`sync-upstream-overrides.mjs` 对固定 Harness checkout
执行带断言的同步和重建；macOS 窗口材质、原生控件、侧栏状态和主题同步由桌面主进程、受限
preload bridge 与窗口 chrome 注入层负责。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, R-002 | 结构化安全区 | 安全区进入每一列，统计拥有独立 Chat 座位 |
| R-003 | 稳定输入框座位 | 空态和活动态共享 `32px` 底部基准 |
| R-004 | 新会话欢迎内容 | 欢迎内容独立于 composer 并相对完整 Chat 画布居中 |
| R-005 | 品牌组件 | 受控内联 SVG、`currentColor`、静态非交互 |
| R-006, NFR-004 | 侧栏材质 | 单层原生 vibrancy、失焦纯色和透明淡出遮罩 |
| R-007 | 固定侧栏按钮 | 固定坐标与独立全屏规则，不参与侧栏过渡 |
| R-008, NFR-001 | 原生主题同步 | 枚举受限 preload IPC 更新 `nativeTheme.themeSource` |
| R-009, NFR-002 | 覆盖同步 | 跟踪源码、严格锚点、同步后上游 build 和自动测试 |

## 组件与职责

### `upstream-overrides/ui-layout`

- 为侧栏、Chat 和详情列插入结构化 `48px` 安全区。
- 把侧栏按钮 host 放入侧栏安全区，把模型统计 host 放入 Chat 安全区。
- 安全区背景继承其所属列，避免形成跨窗口顶栏。

### `upstream-overrides/ui-conversation`

- 空态 composer 使用 `--deepviewer-composer-bottom-offset: 32px`。
- 活动会话的 footer 预留相同底部座位，使统计出现不改变 composer 位置。
- 欢迎内容成为 Chat scroll body 的独立兄弟节点，以完整 Chat 画布中心定位。
- 图形复用 DeepViewer logo 和 cursor blink 语义，文案通过上游本地化资源注入。

### `upstream-overrides/ui-primitives/BrandWordmark.tsx`

- 输出 React 内联 SVG，使用 `currentColor` 和固定 viewBox。
- 默认高度 `20px` 并由 `623:127` viewBox 保持比例。
- 组件本身不包含按钮、链接、阴影或主题专用颜色。

### `macos-window-chrome.ts`

- 识别上游结构并只附加状态属性、结构 host 和 macOS 专用样式。
- 把原侧栏按钮移动到固定 host，正常状态固定 `left: 88px; top: 13px`，全屏单独左移。
- 把会话统计镜像到 Chat 安全区；原位置不再占据 composer footer 布局。
- 设置侧栏聚焦/失焦属性并观察主题状态，调用受限 desktop bridge 同步原生主题。

### Electron main / preload / window options

- macOS `BrowserWindow` 使用 `vibrancy: 'sidebar'` 与 `visualEffectState: 'followWindow'`。
- preload 只暴露 `setNativeThemeSource(source)`；主进程再次校验固定枚举。
- 窗口失焦时 Web 侧栏列使用主题纯色，聚焦时由透明 Web 层显示单一原生材质。

### `sync-upstream-overrides.mjs`

- 每个覆盖项声明目标文件、锚点和预期替换次数。
- 复制或替换完成后可显式运行上游 UI build。
- 任一目标不匹配即终止，避免静默生成部分定制版本。

## 接口与事件

Renderer 唯一新增原生接口：

```ts
type NativeThemeSource = 'light' | 'dark' | 'system'

window.deepviewerDesktop.setNativeThemeSource(source: NativeThemeSource): void
```

IPC channel 是内部实现细节；main 进程不信任 Renderer 类型声明，仍在运行时校验枚举。

## 状态与数据模型

```text
window focus: focused -> transparent Web sidebar -> native material visible
              blurred  -> theme solid Web sidebar -> native material covered

conversation: hero | thinking | streaming | complete
              -> shared composer bottom offset = 32px
              -> optional stats only in Chat safe area
```

不新增持久化状态。主题、侧栏和会话状态继续由现有应用/上游页面拥有，桌面层只投影到原生表现。

## 主要流程

1. 开发或构建命令先从 `upstream-overrides/` 同步受控定制并重建上游 UI。
2. Electron 创建两列窗口，macOS 使用原生 sidebar material 和集成交通灯。
3. 页面加载后 chrome 层绑定结构化安全区、侧栏按钮、统计座位和主题观察器。
4. 新会话显示完整 Chat 画布中心欢迎内容，composer 固定在底部基准。
5. 会话状态变化只更新内容与统计，不改变 composer footer 的几何位置。
6. 窗口聚焦或主题变化时只切换材质覆盖和原生主题，不重建页面结构。

## 权限、安全与隐私

- 保留 sandbox、context isolation、最小 preload bridge 与既有导航限制。
- 主题 IPC 无返回数据，只接受三种固定字符串。
- DOM 投影不读取或记录消息正文、模型凭据或工作区文件。
- 覆盖同步只写固定 checkout 内的声明目标，不扫描或上传本机数据。

## 可观察性

- 同步脚本输出覆盖名称、目标和 build 结果，失败包含具体锚点。
- 现有开发 runner 输出 build/restart 结果，不输出主题设置或会话内容。
- UI 不增加遥测或外部请求。

## 兼容、迁移与回滚

- 不改变正式 userData、会话或设置格式，无数据迁移。
- 非 macOS 平台跳过原生材质和交通灯逻辑。
- 回滚时恢复受控覆盖目录和桌面 chrome 源码即可；被忽略的上游 build 不是权威来源。

## 测试策略

- 单元/静态：窗口参数、固定按钮坐标、两列安全区、统计迁移、材质状态、主题 IPC 枚举。
- 覆盖契约：品牌 SVG、欢迎文案/尺寸/动画、composer offset、目标锚点和同步命令。
- 构建：TypeScript、Vitest、Electron main/preload/renderer production build、上游覆盖同步 build。
- 人工：维护者按浅色/深色、聚焦/失焦、新会话/思考/完成、侧栏收起/展开逐轮验收。
- 发布：正式签名、公证、双架构 DMG 和远端摘要由发布记录单独验证。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 全宽顶栏覆盖色 | 实现简单 | 形成第三层结构，侧栏与 Chat 失去独立安全区 | 拒绝 |
| 只在被忽略的上游 checkout 修改 | 反馈快 | 无法追踪、重建或审查 | 拒绝 |
| 纯 CSS 模拟所有侧栏材质 | 跨平台一致 | macOS 聚焦材质和桌面融合度不足 | 拒绝 |
| 受控覆盖 + 原生最小桥 | 可追踪并保留原生体验 | 需要维护固定锚点 | 采用 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-17
