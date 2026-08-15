---
id: DV-0004
title: macOS integrated title bar - Design
status: Released
updated: 2026-08-16
---

# DV-0004：设计

## 方案摘要

DeepViewer 的 `WindowController` 继续拥有唯一 `BrowserWindow`。新增可独立测试的窗口选项构造边界：macOS 使用 Electron 原生 `titleBarStyle: 'hiddenInset'` 与明确的 `trafficLightPosition`，让 Web 内容延伸到标题栏区域并保留原生交通灯；其他平台不获得该专有配置。桌面壳在每次导航后安装 macOS 窗口工具条：它把 Harness 已有面板图标放在交通灯右侧，将顶部 48px 标记为拖动区并将按钮标记为 `no-drag`；同时对侧栏、主栏、详情栏与 shell overlay 统一建立 48px 内容安全区。工具条委托 Harness 原有侧栏切换按钮，监听框架现有的 `data-sidebar-collapsed` 状态，并只在桌面层把收起宽度从缩略轨道覆盖为零，不修改被忽略的上游参考 checkout。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, R-002 | 窗口选项 | 使用 Electron 原生 hiddenInset，隐藏标题文字但保留系统按钮 |
| R-003 | 交通灯安全区 | 固定按钮位置并检查页面顶部内容避让 |
| R-004 | 原生行为与拖动 | 优先保留 hiddenInset 自带行为；仅在实机证明需要时增加最小 drag region |
| R-005 | 窗口生命周期 | BrowserWindow 在任何 `loadURL` 前建立样式，页面切换不重建窗口 |
| R-006 | 整栏收起 | 桌面覆盖层将 Harness 的 collapsed grid 首轨从缩略宽度覆写为 0，并保留原有动画与展开宽度 |
| R-007 | 固定切换入口 | 在窗口级工具条中复用 Harness 面板图标与原始 toggle 事件；使用 24px 点击框与 16px 图标，并与 16px 原生交通灯中心线对齐 |
| R-008 | 单一状态权威 | 不新增持久化 store；按钮点击委托 Harness 原始侧栏控制，DOM 属性作为只读渲染状态 |
| R-009 | 全屏补位 | BrowserWindow 的原生全屏事件同步文档属性；CSS 在全屏态把固定按钮从 88px 移到 16px |
| R-010 | 全宽内容安全区 | 安装器标记 AppFrame 的侧栏、主栏与详情栏；CSS 对三列使用同一 48px 顶部内边距，并把 shell overlay 与列拖拽手柄的顶部边界下移到 48px |
| NFR-001 | 平台边界 | macOS 选项集中在桌面窗口选项模块 |
| NFR-002 | 安全边界 | 不改变 preload、IPC、导航或 webPreferences |
| NFR-003 | 测试与验证 | 开发代理完成选项单元断言、构建和包体检查；维护者在 ARM64 `.app` 手动完成视觉与交互验收 |

## 组件与职责

- `window-options.ts`：生成 BrowserWindow 基础选项，并只在 `darwin` 返回 macOS 标题栏配置。
- `macos-window-chrome.ts`：提供可注入的 CSS 与安装脚本，创建桌面顶部工具条、发现并标记 Harness 的三列容器/框架节点、建立统一内容安全区、委托侧栏切换并同步整栏显隐。
- `WindowController`：使用该选项创建窗口，继续负责 URL 允许列表和页面切换。

## 接口与事件

新增内部纯函数：

```ts
createMainWindowOptions(
  preload: string,
  platform?: NodeJS.Platform,
): BrowserWindowConstructorOptions
```

该函数不是公共 API，不进入 Renderer 或插件契约。

## 状态与数据模型

无新增持久化状态。Harness layout store 继续是侧栏状态权威；桌面工具条只镜像 `data-sidebar-collapsed` 并委托原始切换动作。窗口样式在创建时确定，页面级工具条在每次导航后重新安装。

## 主要流程

1. 主进程创建窗口并根据 `process.platform` 取得选项。
2. macOS 窗口以 hiddenInset 形态创建，原生交通灯进入内容区域。
3. 桌面壳安装全宽 48px 顶部拖动层，并让工具条按钮成为 `no-drag` 交互区。
4. 安装器标记侧栏、主栏、详情栏，将三列页面内容统一下移到安全区下方；shell overlay 和列拖拽手柄的可交互起点也下移到安全区下边缘。
5. Harness surface 就绪后，安装器发现框架、侧栏和原始 toggle；创建交通灯右侧的固定切换入口。
6. 用户切换侧栏时，原始 Harness store 更新；桌面层只把 collapsed 的网格首轨从缩略宽度显示为 0，主栏安全区保持不变。
7. 页面切换只替换内容并重新安装工具条，BrowserWindow 外壳保持不变。
8. `enter-full-screen` / `leave-full-screen` 更新页面的 macOS 全屏属性；按钮据此在 16px 与 88px 之间切换，内容安全区保持不变。

## 权限、安全与隐私

不新增权限。现有受限 BrowserWindow `webPreferences` 和导航策略原样进入选项模块，自动测试同时断言其未退化。

## 可观察性

不新增用户数据或日志。验证记录构建结果、窗口选项断言和 ARM64 截图/人工操作结果。

## 兼容、迁移与回滚

- macOS ARM64/x64 使用同一源码配置。
- 不迁移用户数据。
- 回滚只需删除 macOS `titleBarStyle`/`trafficLightPosition` 配置；Runtime 和 Harness 不受影响。

## 测试策略

- 单元测试：darwin 返回 hiddenInset 与交通灯坐标；非 darwin 不包含 macOS 专有字段；安全 webPreferences 保持不变；注入 CSS/脚本包含全宽 drag、`no-drag`、三列/overlay 统一 48px 安全区、零宽收起和原始 toggle 委托。
- 静态检查：TypeScript、现有桌面测试和生产构建。
- 维护者手动验收：ARM64 `.app` 的展开/收起、按钮位置、顶部拖动、最小化、全屏和 Harness 交互；与用户参考截图对照。开发代理不代替维护者操作界面。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| `titleBarStyle: hiddenInset` + 原生交通灯 | 原生行为、视觉接近 Codex、实现小 | 需检查页面顶部安全区 | 采用 |
| `frame: false` + Web 模拟按钮 | 完全自定义 | 丢失原生语义和系统交互，维护成本高 | 拒绝 |
| 保留默认标题栏并只改颜色 | 风险低 | 仍存在用户明确不需要的独立横条 | 拒绝 |

## 设计决定

- 决策：Approved by direct project instruction；全宽顶部安全区增强正在实施
- 审批人：Duoasa
- 日期：2026-08-16
