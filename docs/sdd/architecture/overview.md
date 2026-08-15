---
title: DeepViewer Architecture Overview
status: Draft
updated: 2026-08-15
---

# 架构概览

本文描述当前方向，不提前锁定尚未评估的桌面框架或上游集成机制。具体选择必须由 ADR 决定。

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

### DeepViewer Application Layer

- 把 Harness 事件投影为 UI 可消费状态
- 编排桌面生命周期、窗口、设置和本地集成
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

## 待决定事项

- 桌面框架和前后端进程模型
- Harness 的源码/依赖接入和上游同步策略
- UI 与 Runtime 之间的传输协议
- 设置、会话索引和凭据的具体存储技术
- 自动更新、遥测和诊断导出的默认策略
