---
title: DeepViewer Architecture Overview
status: Draft
updated: 2026-08-15
---

# 架构概览

本文描述当前方向。桌面框架和当前平台顺序由 [ADR-0003](decisions/ADR-0003-mac-package-before-ui-windows-deferred.md) 确定，macOS 架构产物由 [ADR-0004](decisions/ADR-0004-separate-macos-arm64-x64-artifacts.md) 确定；尚未评估的上游集成机制仍需独立 ADR。

## 系统边界

```text
用户
  │
  ▼
DeepViewer UI / Desktop Shell
  │  typed application API + event stream
  ▼
DeepViewer Application Layer
  │  composition, policy, presentation adapters
  ▼
DeepSeek Harness Runtime
  │
  ├── model providers
  ├── tools and capability plugins
  ├── workspace / subprocess / terminal
  └── session persistence
```

## 计划中的职责

### UI / Desktop Shell

- 展示任务、会话、工具活动、权限、文件差异和产物
- 收集用户输入和明确确认
- 只通过稳定应用接口访问运行时，不直接读取内部数据库
- 使用 Electron 主进程管理窗口和 Harness 生命周期，Renderer 不获得通用 Node 能力
- 首先交付 macOS arm64，但桌面接口、资源定位和进程管理必须保留 Windows 实现边界

### DeepViewer Application Layer

- 把 Harness 事件投影为 UI 可消费状态
- 编排桌面生命周期、窗口、设置、本地集成和平台适配
- 实现 DeepViewer 特有的策略与呈现适配，不复制 Harness 核心能力

### DeepSeek Harness Runtime

- 负责 Agent 循环、会话、工具、插件、模型和能力组合
- 保持上游契约和许可证边界
- 通过公开扩展点承载可复用行为

### Local Persistence

- 保存应用设置、UI 状态和必要索引
- Harness 所有的数据继续由 Harness 的权威存储负责
- 跨存储引用必须有稳定 ID、迁移和删除语义

## 数据流原则

- UI 展示来源于可重建的事件或权威查询，不猜测运行状态。
- 模型可见内容、工具输入和外部传输应能在授权范围内审计。
- 敏感值使用引用或系统凭据存储，不复制进普通配置和日志。
- UI 投影可以丢弃并重建；权威会话数据不能依赖前端缓存。

## 扩展原则

- 新 Agent 行为优先实现为 Harness 插件或能力组合。
- DeepViewer 特有展示通过显式的 UI 元数据或适配器表达。
- UI 呈现契约不应让通用插件依赖某个桌面框架。
- 修改上游 Agent 循环、会话格式或插件协议前必须新建 ADR。

## 桌面进程模型

```text
DeepViewer Electron main
├── BrowserWindow + allowlisted IPC
├── RuntimeManager
│   ├── shared lifecycle and health state machine
│   ├── shared platform boundary
│   └── macOS process adapter
└── packaged resources
    ├── DeepViewer Web surface
    ├── Harness build output and profiles
    └── compatible Node execution strategy
```

- 开发模式和安装模式使用同一 RuntimeManager 契约，只允许资源解析方式不同。
- Harness 仅监听 loopback 随机端口；窗口等待健康检查通过后才加载应用 surface。
- 平台差异集中在进程树、信号、Shell/PTY、路径、安装和签名层，不进入 UI 业务状态。
- macOS 纵向验证完成后直接进入 UI 与功能改造；Windows 适配由后续独立规格实现。
- 共享模块不得散布 macOS 路径和进程假设，但当前阶段不编写未经验证的 Windows 占位实现。

## 待决定事项

- Harness 的源码/依赖接入和上游同步策略
- UI 与 Runtime 之间的传输协议
- 设置、会话索引和凭据的具体存储技术
- macOS/Windows 最低版本、安装格式、签名、自动更新、遥测和诊断导出的默认策略
