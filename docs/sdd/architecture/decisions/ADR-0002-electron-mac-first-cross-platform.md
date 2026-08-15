---
id: ADR-0002
title: Electron desktop shell with a macOS-first cross-platform delivery path
status: Superseded
date: 2026-08-15
supersedes: []
superseded_by: [ADR-0003]
---

# ADR-0002：Electron 桌面壳与 macOS 优先的双平台路线

> 本决策已由 [ADR-0003](ADR-0003-mac-package-before-ui-windows-deferred.md) 替代。本文保留原始决策历史。

## 背景

DeepViewer 的首要产品目标是成为可以像普通桌面软件一样安装和运行的 Agent 客户端，而不是要求用户通过 npm/pnpm 命令启动 Harness 和 Web UI。产品最终必须支持 macOS 和 Windows，但首个完整客户端以 macOS 为优先目标。

DeepSeek Harness 与现有 Web UI 使用 Node.js、TypeScript 和 React。桌面封装必须管理 Harness 及其子进程、静态资源、loopback 连接、日志、退出回收和平台安装，同时尽量复用上游 Web surface 和插件能力。

## 决策

1. DeepViewer 使用 Electron 作为首个桌面壳技术栈，复用现有 TypeScript/React/Node 工程与 Web UI。
2. 产品架构从第一天支持 macOS 和 Windows，但按以下顺序交付：
   - macOS arm64 桌面打包纵向验证；
   - macOS DeepViewer MVP；
   - Windows 构建/启动冒烟验证紧随桌面骨架完成；
   - Windows 完整客户端；
   - 双平台签名、自动更新和稳定发行。
3. Electron 主进程通过 RuntimeManager 启动、监控和停止本地 Harness。共同生命周期状态机与平台适配器分离。
4. Renderer 禁用 Node integration，启用 context isolation 和 sandbox；操作系统能力只通过允许列表 IPC 暴露。
5. Harness 仅绑定 loopback 随机端口。v0.1 继续使用上游 HTTP/WebSocket 协议，不另造 Electron IPC 数据协议。
6. 桌面安装包必须自包含运行 Harness 所需的兼容执行环境，最终用户无需安装 Node、pnpm 或使用终端。
7. macOS 验证优先生成本地可运行的未签名产物；签名、公证、自动更新和 Windows 代码签名在产品路径稳定后完成，但资源布局必须为后续签名保留可行路径。

## 后果

### 正面

- 可以最大程度复用 Harness Web UI、协议和 TypeScript 工具链。
- 桌面生命周期和打包风险会在大规模 UI 改造之前暴露。
- Mac-first 缩短首个可安装版本路径，同时通过平台适配边界避免把 Windows 变成重写项目。
- 现有浏览器端测试和无密钥回放能力可以继续使用。

### 代价与风险

- Electron 安装体积和常驻内存通常高于轻量原生壳。
- ASAR 只读资源、可执行依赖、Node 版本和工作目录需要专门打包策略。
- Windows 的进程树、PowerShell/CMD、路径、编码、权限和 PTY 行为必须独立验证。
- macOS 正式分发需要 Apple Developer 证书、签名和公证；Windows 公开分发也需要代码签名策略。
- Electron 与 Harness 支持的 Node 版本需要在每次升级中共同验证。

## 备选方案

### 完成全部 UI/功能改造后再打包

拒绝。资源定位、进程生命周期和运行时兼容问题可能迫使产品层返工，风险暴露过晚。

### 先完整建设正式发布体系

拒绝。签名、自动更新和双平台安装流水线会在产品路径尚未稳定时放大工作量。先验证可安装纵向切片，再补全发行能力。

### Tauri + Node sidecar

当前拒绝。它可以减小壳体积，但 Harness 仍需要 Node sidecar，并引入 Rust、额外跨进程接口和两套工具链；对首个可运行版本的收益不足。

### 两套平台原生客户端

拒绝。会重复 UI、协议和产品逻辑，无法发挥现有 Web surface 的复用价值。

## 后续行动

- 按 [DV-0003](../../specs/DV-0003-desktop-packaging-spike/spec.md) 实施桌面打包纵向验证。
- 通过独立规格确定上游源码集成与同步策略。
- 在 macOS RuntimeManager 打通后立即建立 Windows 构建/启动冒烟证据。
- 在正式公开发行前建立签名、公证、自动更新和回滚规格。
