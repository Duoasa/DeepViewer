---
id: DV-0005
title: DeepViewer desktop app identity - Design
status: Released
updated: 2026-08-16
---

# DV-0005：设计

## 方案

新增无 Electron 运行时依赖的应用身份模块，集中保存 `DeepViewer` 名称和图标文件名。主进程在 `app.ready` 前设置应用名；未打包的 macOS 开发预览从仓库资源设置 Dock 图标，打包后的 `.app` 则由系统直接读取 Bundle ICNS，避免运行时 PNG 覆盖原生图标路径。`WindowController` 拦截网页标题更新并保持原生窗口标题为 DeepViewer。打包脚本使用由用户 PNG 生成的 ICNS。

## 需求映射

| 需求 | 实现 |
| --- | --- |
| R-001, NFR-002 | `app-identity.ts` 作为名称常量事实来源；主进程与窗口选项复用 |
| R-002 | BrowserWindow `page-title-updated` 事件阻止 Harness 标题覆盖 |
| R-003 | 将 macOS 26 工具输出原样保存为 `assets/deepviewer-icon-macos26-1024.png`，不做图像加工，仅编码 `DeepViewer.icns` |
| R-004 | 开发态 `app.dock.setIcon` 与 Electron Packager `icon` 共享同一图标源；打包态只使用 Bundle ICNS |
| NFR-001 | 不改变 preload、IPC、导航和 `webPreferences` |

## 验证策略

- 单元测试应用名称、页面标题同步和窗口选项。
- 检查 PNG/ICNS 尺寸与文件类型。
- 运行 typecheck、test、build。
- 启动 ARM64 Electron 预览，通过 AX、菜单栏和截图检查名称与图标。

## 决策

- 状态：Approved by direct project instruction；macOS 26 图标替换与 ARM64 验收已完成
- 日期：2026-08-16
