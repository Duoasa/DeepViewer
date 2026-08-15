---
id: DV-0006
title: DeepViewer branded loading surfaces - Design
status: Implementing
updated: 2026-08-16
---

# DV-0006：设计

## 方案摘要

复用唯一 BrowserWindow 和现有两阶段启动流程。桌面 Renderer 将启动 surface 改为 Figma 构图，并继续监听 RuntimeStatus；Harness 页面不修改上游参考 checkout，而由 DeepViewer 主进程在 runtime `dom-ready` 后注入品牌 CSS 与安装脚本，将上游加载卡识别并标记为 DeepViewer 插件加载页。两个阶段复用同一份 Figma SVG 和 Figtree 字体资产。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, R-002, R-005 | 启动 Renderer | 视口居中 Logo/名称，横线路径独立闪烁；错误时显示诊断操作 |
| R-003, R-004, R-008 | Harness 品牌注入 | runtime 文档就绪后立即安装独立品牌覆盖层；正式 AppFrame/失败态出现后移除 |
| R-006 | 响应式居中 | 使用 `min-height: 100vh` 与 grid/flex 居中，不使用 Figma 画布绝对坐标 |
| R-007 | 启动页可见性 | BrowserWindow 显示后等待两次 `requestAnimationFrame`，再计算 2000ms 最短可见时间并允许导航到 runtime |
| R-009 | 生产资源寻址 | Vite Renderer 固定使用相对 `base`，让构建产物从 `file://.../.desktop/renderer/index.html` 加载同目录 assets |
| NFR-001, NFR-002 | CSS 动效 | 透明度光标与 background-position 流光；reduced motion 禁用 |
| NFR-003 | 桌面边界 | 只增加本地静态资源和受信任主进程注入，不改变 preload/IPC |
| NFR-004 | 验证 | 自动化覆盖结构、样式与构建；维护者手动检查视觉和动效 |

## 组件与职责

- `renderer/index.html`：启动等待页语义结构与错误操作容器。
- `renderer/main.ts`：从 Figma SVG 创建 DOM，标记横线路径，映射 RuntimeStatus。
- `renderer/styles.css`：Figma 布局、启动光标闪烁、错误态和 reduced-motion。
- `harness-loading-brand.ts`：导出 Harness 加载覆盖层 CSS/安装脚本，嵌入同一 SVG，并观察 AppFrame、失败文案与安全超时。
- `launch-surface-timing.ts`：提供可单元测试的最短可见时间计算。
- `WindowController`：从窗口实际显示时刻计算启动页停留时间；在 runtime `loadURL` 完成后确定性安装 Harness 加载覆盖层。
- `vite.renderer.config.ts`：为本地 `file://` 启动页生成 `./assets/...` 相对资源 URL。

## 接口与事件

不新增公共 API。继续使用 `runtime:get-status`、`runtime:retry`、`desktop:open-log-directory` 和 `runtime:status`。

## 状态与数据模型

不新增持久化状态。启动 Renderer 继续以 `RuntimeStatusView.phase` 为权威；Harness 插件加载态继续以上游 AppRoot 是否 settled 为权威，品牌脚本只改变呈现。

## 主要流程

1. BrowserWindow 加载本地启动 surface，中央显示 DeepViewer Logo/名称，横线闪烁。
2. RuntimeStatus 更新只改变无障碍状态和失败操作，不改变等待页构图。
3. Runtime ready 后等待启动页从窗口显示并完成两次渲染帧起达到 2000ms，再由同一窗口导航到 Harness URL。
4. runtime `loadURL` 完成后安装品牌 CSS并立即创建独立覆盖层，不等待上游加载卡匹配成功。
5. 覆盖层显示稳定 Logo 及 `Loading Plugins...` 流光，位于网页内容之上、macOS 原生工具栏之下。
6. 脚本观察上游加载文案、失败文案和正式 AppFrame；settled/failed 后移除覆盖层，识别失效时 15 秒安全退出。

## 权限、安全与隐私

SVG 和字体均为本地静态资源。注入脚本只查询/标记当前文档 DOM，不读取用户会话、凭据或文件，不增加 IPC。

## 可观察性

不增加遥测。启动失败继续通过现有日志入口诊断。

## 兼容、迁移与回滚

- 视口居中适配当前 macOS ARM64/x64，并避免依赖固定窗口尺寸。
- 无数据迁移。
- 回滚可恢复旧 Renderer HTML/CSS，并移除 Harness loading 注入，不影响 Runtime。

## 测试策略

- 单元/静态：验证 Figma 几何、Logo 横线路径、Harness 文案替换、流光/reduced-motion、失败按钮与注入边界。
- 基础：typecheck、test、production build、ARM64 package、DMG verify。
- 手动：由维护者检查两阶段居中、横线闪烁、Logo 稳定、文字流光及切换无闪回。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 修改上游 AppRoot | 结构直接 | 唯一实现落入上游参考 checkout，升级易丢失 | 拒绝 |
| 新建独立 Splash Window | 完全独立 | 增加窗口生命周期和切换复杂度 | 拒绝 |
| 本地启动 Renderer + runtime 独立覆盖层 | 保持单窗口、不依赖修改 React DOM、易回滚 | 需维护退出状态识别 | 采用 |

## 设计决定

- 决策：Approved by direct project instruction；实施中
- 审批人：Duoasa
- 日期：2026-08-16
