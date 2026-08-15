---
id: DV-0005
title: DeepViewer desktop app identity
status: Released
owner: Duoasa
created: 2026-08-16
updated: 2026-08-16
depends_on: [DV-0003, DV-0004]
---

# DV-0005：DeepViewer 桌面应用身份

## 摘要

把 macOS 桌面应用在窗口标题、系统应用名、Dock 和安装产物中的身份统一为 `DeepViewer`，并使用用户提供的 1024px macOS 图标。Harness 继续作为内置运行时，但不得再把 `DeepSeek Harness` 文档标题覆盖到原生窗口外壳。

## 目标

- G-001：macOS 用户在窗口、系统菜单和 Dock 中只看到 DeepViewer 产品身份。
- G-002：正式打包产物与开发预览使用同一份应用图标源文件。

## 非目标

- NG-001：本规格不替换 Harness 页面内部的 DeepSeek 品牌内容。
- NG-002：本规格不处理签名、公证、自动更新或 Windows 图标格式。

## 功能需求

- R-001：应用的 Electron 名称、BrowserWindow 标题和 macOS 系统应用名必须为 `DeepViewer`。
- R-002：Harness 页面更新 `document.title` 时，不得把原生窗口标题改回 `DeepSeek Harness`。
- R-003：用户提供的 macOS 26 工具输出 1024px PNG 必须作为仓库内权威图标源；桌面壳和 ICNS 必须直接使用该图像，不得再次缩放、补边距、重绘或改变颜色。
- R-004：开发预览的 Dock 图标与打包后的 `.app` 图标必须使用同一 DeepViewer 图标。

## 非功能需求

- NFR-001：名称与图标变更不得扩大 Renderer、IPC、导航或文件系统权限。
- NFR-002：应用身份常量应集中定义，窗口生命周期不得散布多个不一致名称。

## 验收条件

- AC-001：Given Harness surface 已加载，When 用户查看原生窗口标题，Then 显示 `DeepViewer`，不显示 `DeepSeek Harness`。
- AC-002：Given ARM64 开发预览已启动，When 用户查看 macOS 应用菜单和 Dock，Then 应用名与图标均为 DeepViewer。
- AC-003：Given ARM64 打包配置，When 检查打包脚本和图标资源，Then Packager 使用由 `icon-macOS26-1024@1x.png` 原样转换的 DeepViewer ICNS，源 PNG 保持 1024 × 1024 RGBA。
- AC-004：Given 自动化检查，When 运行 typecheck、test 和 build，Then 应用身份逻辑及现有桌面功能全部通过。

## 风险与回滚

| 风险 | 缓解方式 |
| --- | --- |
| Harness 页面标题覆盖原生窗口 | 拦截 BrowserWindow `page-title-updated` 并恢复权威名称 |
| 开发预览仍显示 Electron 图标或名称 | 在 `ready` 前设置应用名，并在 macOS ready 后设置 Dock 图标 |
| ICNS 缺少必要尺寸 | 从 macOS 26 工具输出的原始 1024px 图像编码标准 16–1024px 尺寸，并检查打包后图标哈希；不修改源图边距 |

回滚时移除身份同步和 Packager `icon` 选项；不影响 Harness 数据与运行时。

## 审批

- 决策：Approved by direct project instruction；macOS 26 图标替换与 ARM64 验收已完成
- 审批人：Duoasa
- 日期：2026-08-16
