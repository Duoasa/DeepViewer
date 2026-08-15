---
id: DV-0002
title: DeepSeek Harness foundation and DeepViewer customization direction
status: Review
owner: Duoasa
created: 2026-08-15
updated: 2026-08-15
depends_on: [DV-0001]
---

# DV-0002：DeepSeek Harness 基础与 DeepViewer 改造方向

## 摘要

以官方 DeepSeek Harness 为运行时和 Web 客户端基础，评估 DeepViewer 的品牌、UI、桌面封装和功能扩展应落在哪些架构层，并选择一个尽量减少上游分叉的初始方向。

## 上游分析基线

- 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
- 分支：`master`
- 提交：`47f943859bef60e4160492346772ded9b24f765a`
- 版本：`0.1.0-rc.5`
- 本地参考副本：`upstream/deepseek-harness/`

## 背景与问题

DeepViewer 需要在 DeepSeek Harness 上提供独立品牌、明显不同的 UI 和面向桌面用户的功能。上游仍处于 RC 阶段，Host、Browser、插件、会话和 UI 均有严格分层。如果直接改写核心或整套 React 页面，短期直观但会持续承担上游同步和行为回归成本。

## 目标

- G-001：复用 Harness 的 Agent、会话、工具、权限、模型和插件能力。
- G-002：让 DeepViewer 拥有独立品牌、桌面入口和可持续演进的 UI。
- G-003：把功能改造放在最接近其职责的插件、事件、Remote 或投影层。
- G-004：保留定期吸收上游更新的可行路径。

## 非目标

- NG-001：本规格不立即把上游源码合并进 DeepViewer 主分支。
- NG-002：本规格不实现已由 ADR-0002 选定的 Electron 桌面壳。
- NG-003：本规格不定义尚未提出的具体业务功能。
- NG-004：本规格不修改 Agent Loop 或会话格式。

## 功能需求

- R-001：DeepViewer 必须记录可复现的上游来源和分析提交。
- R-002：DeepViewer 应通过独立 profile/bundle 组合上游能力和自身插件。
- R-003：纯展示变化应优先通过品牌入口、主题 token 和客户端 UI 插件完成。
- R-004：需要 Host 能力的功能应通过 Service、Typert Remote、Host frame 或会话投影暴露，不允许 UI 直接读取 Host 内部存储。
- R-005：影响模型或 Agent 行为的功能应优先使用 preset、工具、能力 seam 和 `agent/*`、`tools/*` 扩展点。
- R-006：桌面应用必须负责本地 Harness 生命周期、窗口和打包，不复制 Harness 的会话与 Agent 业务逻辑。

## 非功能需求

- NFR-001：默认只绑定 loopback；在独立认证层完成前不得对不可信网络暴露 Web API。
- NFR-002：DeepViewer 自有代码应集中在清晰目录和包命名空间内，避免散布式修改上游文件。
- NFR-003：UI 改动应保持上游的无密钥组件测试与 Web replay 测试路径。
- NFR-004：上游更新必须可通过固定 remote、版本或提交进行比较和审计。
- NFR-005：凭据不得进入浏览器普通存储、日志或桌面 IPC 的宽泛消息通道。

## 验收条件

- AC-001：官方仓库已在本地形成独立、可更新的参考 checkout，并记录提交 SHA。
- AC-002：架构分析覆盖 Host/Browser 双插件树、Web 连接、会话投影、UI slot 和 profile/bundle。
- AC-003：方案明确区分品牌/UI、桌面壳、Host 功能和 Agent 行为的改造位置。
- AC-004：至少比较直接分叉、插件覆盖层和独立客户端三种路线。
- AC-005：提供一个可以分阶段评估、且不要求立刻重写核心的简化方案。

## 边界与失败行为

- 替换拥有子 slot 的 UI 根组件会连带撤销其子 slot；未重新声明完整子树时，已有功能会消失。
- Web API 当前的 trust fence 不是用户认证；桌面封装必须限制在 loopback。
- 上游客户端插件卸载仍有未实现部分；v0.1 不把运行时无刷新启停所有插件作为承诺。
- 上游仍允许兼容性破坏；升级前必须运行固定回放和 UI 测试。

## 数据、安全与隐私

桌面壳只应获得窗口、文件选择、系统通知和进程管理等最小能力。WebView 关闭 Node integration；敏感操作通过窄接口进入 Host，凭据继续使用 Harness 的 credentials/settings 能力或系统凭据存储。

## 依赖

- [ADR-0001](../../architecture/decisions/ADR-0001-sdd-as-source-of-truth.md)
- [ADR-0002](../../architecture/decisions/ADR-0002-electron-mac-first-cross-platform.md)
- [ADR-0003](../../architecture/decisions/ADR-0003-mac-package-before-ui-windows-deferred.md)
- [官方架构说明](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.zh.md)
- [Web 客户端规则](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/AGENTS.md)

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| 上游 RC 快速变化 | 定制代码频繁冲突 | 固定分析提交；自有包集中；按周期吸收上游 |
| 过早重写 UI | 丢失审批、回放、流式和插件能力 | 先复用对象层与现有功能插件，逐块替换 |
| 桌面壳与 Node 运行时打包复杂 | 安装包或升级失败 | 先完成 macOS 纵向验证和进程生命周期测试；Windows 由后续独立规格适配 |
| Web API 对外可达 | 本地数据和执行能力暴露 | 仅 loopback，随机端口，禁止任意远程导航 |
| 自有包名与上游仓库门禁冲突 | 构建约束失败 | 单独调整 workspace/naming gate，并用最小变更记录 |

## 未决问题

- Q-002：首版 UI 是“重新视觉设计但保留信息架构”，还是“改变主导航和任务模型”？
- Q-003：除品牌和桌面化外，首批三个功能差异是什么？
- Q-005：DeepViewer 采用 GitHub fork/upstream merge，还是独立仓库内定期导入上游快照？

## 已解决问题

- Q-001：目标仍为 macOS 与 Windows 双平台；macOS arm64 封包通过后先进行 UI/功能改造，Windows 适配后置。
- Q-004：采用 Electron，详见 ADR-0002。

## 审批

- 决策：Review；路线 B、Electron 与平台顺序已批准，其余 UI 范围和上游同步策略待决定
- 审批人：Duoasa（已批准部分）
- 日期：2026-08-15
