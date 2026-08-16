---
title: DeepViewer Roadmap
status: Draft
updated: 2026-08-16
---

# 路线图

路线图表达阶段顺序和验证目标，不代表固定发布日期。每个阶段在开发前仍需拆成独立的 `DV-NNNN` 规格。

## Phase 0：项目与上游基线

- 建立 SDD、贡献和决策记录体系
- 评估 DeepSeek Harness 的接入与更新策略
- 采用 Electron、macOS 优先和 Windows 必须支持的桌面方向
- 建立许可证、第三方通知和品牌边界

退出条件：桌面外壳方案已有批准 ADR，上游集成策略有明确的后续规格。

## Phase 1：macOS 桌面打包纵向验证

- 建立 Electron 主进程、受限 Renderer 和本地 Harness 生命周期管理
- 打包自包含运行时，使用户无需安装 Node、pnpm 或使用终端
- 分别生成可双击运行的 macOS arm64 与 x64 `.app` 和未签名测试安装包
- 验证启动、健康检查、异常重启、日志和退出时的完整进程回收

退出条件：Apple Silicon 与 Intel 产物的架构和资源检查通过；至少 arm64 原生完成现有 Web surface 确定性测试任务，退出后不残留 Harness 进程，并且没有阻断后续 UI/功能改造的 macOS 封包问题。

当前证据：arm64 原生与 Intel x64（Rosetta）自包含 DMG 已先后作为 [`v0.0.1`](../releases/v0.0.1.md) 和 [`v0.1.1`](../releases/v0.1.1.md) 公开预览版发布。`v0.1.1` 的两个架构包均从对应源码树重新生成，通过 allowlist staging、个人路径/凭据净化审计、Developer ID 签名、Apple 公证、staple、Gatekeeper 和 DMG 完整性检查。DV-0003 的无密钥流式任务、特殊路径/clean environment、安全 UI 走查与真实 Intel Mac 验证继续收尾；Windows 适配继续后置。

## Phase 2：DeepViewer macOS MVP

- 建立 DeepViewer 品牌、主题和首次启动流程
- 选择工作区、配置模型并创建会话
- 展示流式输出、运行状态和基础错误
- 安全保存非敏感设置，并通过系统凭据能力保存密钥

退出条件：macOS 用户不借助终端即可安装、配置、完成并复查一个端到端本地任务。

当前证据：`v0.1.1` 已公开交付 DeepViewer 应用身份、macOS 一体化标题栏、Codex 式侧栏与顶部安全区，以及两阶段品牌加载页面；维护者已对当前版本的主要窗口与加载体验作初步验收。减少动态效果和 Runtime 失败态仍保留专项人工验收项。

## Phase 3：可观察、可控制的 Agent 工作区

- 任务时间线和工具活动视图
- 文件变更、终端输出和产物预览
- 权限请求、暂停、取消、重试和失败恢复
- 会话搜索、命名和历史管理
- 模型、插件、预设和工作流管理
- UI 扩展点、可导入配置和插件故障隔离

退出条件：关键执行状态和高影响操作具有清晰 UI 与自动化验证；至少一个扩展无需修改 DeepViewer 核心即可安装和使用。

## Phase 4：Windows 客户端

- 完成 Windows RuntimeManager、路径、Shell、PTY、权限和进程树适配
- 提供 Windows x64 安装程序并覆盖与 macOS 相同的核心用户流程

退出条件：macOS 与 Windows 核心流程行为一致，平台差异有明确测试和诊断证据。

## Phase 5：可靠发行

- macOS 与 Windows 安装包、签名和自动更新
- 崩溃恢复、诊断导出和隐私控制
- 性能、无障碍与安全基线
- 稳定版迁移和兼容承诺

退出条件：发布、升级和回滚路径均有重复验证的证据。
