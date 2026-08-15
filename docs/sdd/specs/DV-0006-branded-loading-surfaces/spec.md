---
id: DV-0006
title: DeepViewer branded loading surfaces
status: Implementing
owner: Duoasa
created: 2026-08-16
updated: 2026-08-16
depends_on: [DV-0003, DV-0005]
---

# DV-0006：DeepViewer 品牌加载页面

## 摘要

把桌面壳等待本地 Runtime 的启动页面和 Harness Runtime 等待插件的加载页面统一为 DeepViewer 品牌体验。视觉以 Figma 节点 `8:104` 与 `8:108` 为权威；启动页的 Logo 横线按输入光标闪烁，插件页 Logo 保持静止，`Loading Plugins...` 使用文字流光。

## 背景与问题

当前桌面启动等待页是通用状态卡，Harness 插件加载页则显示 `HARNESS`、旋转圆环和小号提示文字。两个阶段的视觉语言和品牌不一致，页面切换时会产生明显割裂。

## 目标

- G-001：两个启动阶段使用同一 DeepViewer Logo、背景和居中构图。
- G-002：通过克制且状态明确的动效区分“等待 Runtime”和“加载插件”。
- G-003：保留 Runtime 启动失败后的重试和日志诊断能力。

## 非目标

- NG-001：不重做 Harness 正式工作区页面。
- NG-002：不增加独立的第二个 BrowserWindow 或原生 Splash Window。
- NG-003：不把 Figma 的 1600 × 900 画布尺寸固定到应用窗口。

## 用户与用例

### UC-001：等待本地 Runtime

- 参与者：启动 DeepViewer 的用户。
- 前置条件：桌面进程已创建主窗口，本地 Runtime 尚未就绪。
- 主流程：窗口中央显示 DeepViewer Logo 与名称；鲸鱼左下横线像输入光标一样闪烁；Runtime 就绪后自动进入下一阶段。
- 失败/退出流程：Runtime 启动失败时显示可读错误、重试和打开日志操作。

### UC-002：等待 Harness 插件

- 参与者：Runtime 页面已打开的用户。
- 前置条件：Harness Web 已加载，插件尚未全部激活。
- 主流程：窗口中央显示静止的 DeepViewer Logo，下面的 `Loading Plugins...` 周期性显示文字流光；插件就绪后进入正式工作区。
- 失败/退出流程：Harness 原有插件失败信息继续可见，不被品牌层吞掉。

## 功能需求

- R-001：Runtime 启动等待页必须匹配 Figma 节点 `8:104` 的颜色、Logo、文字层级和 80px 垂直间距。
- R-002：启动等待页只允许 Logo 左下横线闪烁；鲸鱼主体和 `DeepViewer` 文字必须保持稳定。
- R-003：Harness 插件加载页必须匹配 Figma 节点 `8:108`，不得继续显示 `HARNESS` 字样或旋转圆环。
- R-004：插件加载页 Logo 必须整体稳定；`Loading Plugins...` 必须显示 Codex 风格的横向文字流光。
- R-005：Runtime 启动失败时必须保留用户可见错误、重试和打开日志入口。
- R-006：两个页面的 Logo 与文字组合必须相对当前窗口居中；不得依赖 Figma 画布的固定像素宽高定位。
- R-007：首次启动页在窗口显示且连续完成两次渲染帧后必须至少保持可见 2000ms，避免窗口合成时间吞掉可见阶段。
- R-008：Harness 插件加载品牌层必须在 runtime 文档就绪后立即覆盖上游加载页，不得依赖成功修改上游 wordmark、spinner 或 CSS module DOM 才能呈现。
- R-009：生产构建的启动 Renderer 必须使用适用于 `file://` 的相对 JS、CSS 和字体资源 URL，不得生成指向磁盘根目录的 `/assets/...`。

## 非功能需求

- NFR-001：动效必须只使用合成友好的透明度或背景位置变化，不得引入持续布局抖动。
- NFR-002：`prefers-reduced-motion: reduce` 下必须停止闪烁和流光，同时保留完整可读内容。
- NFR-003：不得扩大 Renderer、IPC、导航、文件系统或网络权限。
- NFR-004：开发代理只执行代码与基础验证；视觉和动效节奏按 SDD 验证职责由维护者手动验收。

## 验收条件

- AC-001：Given Runtime 尚在启动，When 启动等待页可见，Then DeepViewer Logo 与名称按 Figma 构图居中，只有横线周期性闪灭。
- AC-002：Given Harness 插件尚在加载，When 插件加载页可见，Then DeepViewer Logo 静止且 `Loading Plugins...` 呈横向文字流光，不显示 `HARNESS` 或圆环。
- AC-003：Given 任意受支持窗口尺寸，When 页面布局完成，Then Logo 与文字组合保持在窗口中心，不以 1600 × 900 固定定位。
- AC-004：Given 用户启用减少动态效果，When 任一加载页可见，Then Logo 和文字稳定可见且没有循环动效。
- AC-005：Given Runtime 启动失败，When 错误状态呈现，Then 用户仍可重试或打开日志。
- AC-006：Given 自动化基础验证，When 运行 typecheck、test、build 与 ARM64 package，Then 全部成功且安全边界没有扩大。
- AC-007：Given 本地 Runtime 在 2000ms 内就绪，When 窗口首次显示，Then 启动等待页在连续完成两次渲染帧后仍保持至少 2000ms，之后才进入插件加载阶段。
- AC-008：Given runtime 文档已就绪但上游加载 DOM 尚未出现或结构发生变化，When 品牌脚本执行，Then DeepViewer 插件加载覆盖层仍立即出现，并在正式 AppFrame 或失败状态出现后移除。
- AC-009：Given 生产 Renderer 已构建，When 检查输出 `index.html`，Then JS/CSS URL 使用 `./assets/...`，并且启动页脚本、样式和字体均存在于同一打包目录。

## 边界与失败行为

- 插件加载品牌层在 runtime 文档内使用独立覆盖层，不修改 React 管理的加载卡节点；正式 AppFrame 或失败状态出现后必须移除。
- 若未来 Harness 加载 DOM 结构变化导致无法识别 settled/failed 状态，覆盖层最多等待 15 秒后安全移除，恢复上游页面。
- Runtime 失败状态不播放等待动效。

## UX 说明

- Figma：<https://www.figma.com/design/HplonApWyLhUzBg1wdYg4s/DeepViewer?node-id=8-100>
- 启动等待页：节点 `8:104`；Logo 150.374 × 160，名称为 Figtree Bold 48/40，Logo 与名称间距 80px。
- 插件加载页：节点 `8:108`；同尺寸 Logo，提示为 Figtree Medium 24/40、60% 白色，Logo 与提示间距 80px。
- 背景统一为 `#151517`。
- Figma 的 1600 × 900 仅用于视觉比例参考；实际布局使用窗口视口居中。

## 数据、安全与隐私

不新增数据采集、持久化或外部传输。Figma 导出的 Logo 与字体资源随应用本地打包。

## 依赖

- [DV-0003](../DV-0003-desktop-packaging-spike/spec.md)
- [DV-0005](../DV-0005-desktop-app-identity/spec.md)
- Figma 文件 `HplonApWyLhUzBg1wdYg4s` 的节点 `8:104`、`8:108`

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| Harness 加载页 CSS module 类名变化 | settled 检测可能失效 | 品牌层不依赖上游结构安装；使用加载/失败文案、AppFrame 与 15 秒超时多重退出条件 |
| 字体未随包分发 | 与 Figma 字形和宽度不一致 | 本地打包 Figtree 可变字体并保留许可 |
| 动效引发注意力或可访问性问题 | 用户不适 | 支持 reduced motion；动效仅作用于横线透明度和文字流光 |
| 启动失败操作被简化页面隐藏 | 无法自助恢复 | 错误状态独立保留重试和日志按钮 |
| Vite 默认根路径用于 `file://` 页面 | 启动页资源全部 404，只显示黑色背景 | Renderer 构建固定 `base: './'`，并对生产 HTML 增加相对 URL 断言 |

## 未决问题

- 无；页面范围、视觉稿、居中规则和两种动效已由维护者明确。

## 审批

- 决策：Approved by direct project instruction；实施中
- 审批人：Duoasa
- 日期：2026-08-16
