---
id: DV-0014
title: DeepSeek Harness rc.8 core upgrade and DeepViewer 0.2.2 release
status: Implementing
owner: Duoasa
created: 2026-08-20
updated: 2026-08-20
depends_on: [DV-0007, DV-0008, DV-0010, DV-0011, DV-0012, DV-0013]
---

# DV-0014：DeepSeek Harness rc.8 核心升级与 DeepViewer 0.2.2 发布

## 摘要

将 DeepViewer 包内唯一核心从 DeepSeek Harness `0.1.0-rc.7` 升级到官方不可变标签
`dsh-v0.1.0-rc.8`，重新验证全部 Active 插件、受控 UI 覆盖、默认 JSONL 会话兼容边界与
双架构正式发布门禁，并以 DeepViewer `0.2.2`（Build `1`）公开发布。

## 背景与问题

上游于 2026-08-19 发布 rc.8，标签提交为
`141eb6fef83422698aef7a981029e843e8161534`。该版本新增多模态输入、可安装子代理 bundle、
工具与布局优化，并修复流式取消、图片载荷和自定义 OpenAI 兼容网关问题。

rc.8 同时把可选 SQLite 会话后端升级到无原地迁移的 schema 17。DeepViewer 基础 bundle
默认使用 JSONL，因此普通配置不受 SQLite 物理格式变化影响；手动改用旧 SQLite schema 的
高级配置必须失败关闭并使用 0.2.1 回滚或显式创建新数据库，不得静默改写历史数据。

## 目标

- G-001：发布固定官方 rc.8 核心的 DeepViewer 0.2.2 双架构安装包。
- G-002：按插件登记表复核订阅与预览插件在 rc.8 上的兼容性、可用性和降级路径。
- G-003：保留默认 JSONL 会话数据，并明确旧 SQLite 配置的失败关闭与回滚边界。

## 非目标

- NG-001：不为上游 pre-release SQLite schema 16 编写或执行原地迁移器。
- NG-002：不在运行时下载、切换或修改签名应用内的 Harness 核心。
- NG-003：不升级 `dsh-plugin-subscriptions@0.3.1` 或
  `@deepviewer/dsh-plugin-preview@0.1.0`，除非 rc.8 契约检查证明现有版本无法兼容。
- NG-004：不把 rc.8 的全部新功能重新设计为 DeepViewer 专属界面。

## 用户与用例

### UC-001：从 0.2.1 升级到 0.2.2

- 参与者：现有 DeepViewer macOS 用户。
- 前置条件：使用默认 JSONL 持久化，或已自行管理自定义存储配置。
- 主流程：安装与 CPU 架构匹配的 0.2.2，应用启动唯一 rc.8 Runtime，原有默认会话与插件继续可用。
- 失败/退出流程：插件可由既有环境开关禁用并回退纯核心；旧 SQLite schema 被上游拒绝时不改写
  数据，用户可回滚 0.2.1 或切换到新数据库。

## 功能需求

- R-001：正式 Runtime 必须固定 DeepSeek Harness `0.1.0-rc.8` 与提交
  `141eb6fef83422698aef7a981029e843e8161534`，每个应用只包含一个
  `Contents/Resources/harness`。
- R-002：应用版本必须为 `0.2.2`、Build `1`，关于页必须显示相同应用、Build 与核心版本。
- R-003：必须按 [`dsh-plugins.md`](../../integrations/dsh-plugins.md) 对 DVP-0001 与 DVP-0002
  执行 PC-001 至 PC-009；任一自动检查为 Fail 时不得发布。
- R-004：默认基础 bundle 必须继续使用 JSONL；不得自动迁移、删除或覆盖旧 SQLite 数据。
- R-005：正式发布必须重新生成 arm64/x64 Runtime、allowlist staging、应用、DMG 和 SHA-256
  清单，并完成签名、公证、隐私、架构与远端回读验证。
- R-006：中英文 README、上游基线、插件登记和发布记录必须同步到 0.2.2，并保留 0.2.1
  下载与回滚入口。

## 非功能需求

- NFR-001：核心来源必须是官方不可变标签；构建不得从未固定的 master 或本地改写核心取包。
- NFR-002：rc.8 适配不得扩大 Renderer 的 preload/IPC、文件系统或网络权限。
- NFR-003：发布资产继续执行零个人数据、零凭据和零开发者绝对路径门禁。
- NFR-004：已登记插件必须能被安全禁用；失败时不得阻断纯 rc.8 核心启动。

## 验收条件

- AC-001：给定干净的官方 checkout，运行同步与 build 时，版本/提交门禁接受 rc.8 且桌面、
  client、两个插件和完整 Web production build 通过。
- AC-002：给定全部 Active 插件，执行 PC-001 至 PC-008 自动检查时均为 Pass，PC-009 记录
  真实账户人工复验状态且没有 Fail。
- AC-003：给定默认应用配置，检查 release-pack 与最终 Runtime 时使用 JSONL persistence，
  不启用 SQLite；旧 SQLite schema 的边界在文档中明确为失败关闭、无自动迁移。
- AC-004：给定 arm64 与 x64 正式包，两个应用均显示 0.2.2 Build 1 / rc.8，只含唯一 Harness
  和两个固定插件，并通过签名、公证、Gatekeeper、DMG、架构及净化审计。
- AC-005：给定 GitHub `main` 与 `v0.2.2` Release，中英文 README、SDD 记录、DMG 下载、
  SHA-256 清单和远端 digest 相互一致。

## 边界与失败行为

- rc.8 checkout、版本、提交或 release-pack 不匹配时构建立即失败。
- 订阅或预览插件缺失、版本错误或预检失败时既有禁用开关仍可启动纯核心；正式封包仍视为失败。
- 自定义旧 SQLite 数据库由上游 schema ownership 检查拒绝，不执行原地迁移或删除。
- 签名、公证、隐私审计、上传或远端摘要任一步失败时停止发布，不复用旧资产。

## UX 说明

本规格不增加新的 DeepViewer 导航或设置入口。About 页面版本更新为 0.2.2 / Build 1 / rc.8；
rc.8 上游已有布局与交互优化随固定 Web Runtime 提供。自定义 SQLite 用户的兼容边界通过
发行说明说明，不增加未经设计的数据迁移对话框。

## 数据、安全与隐私

默认 JSONL 会话继续位于隔离的 DeepViewer DSH home，升级不复制到外部位置。订阅凭据维持
DV-0011 已批准的预览版边界。SQLite schema 16 不被读取后重写；用户必须自行保留或回滚。
正式资产沿用允许列表 staging 和凭据值扫描，不写入任何本机会话、设置、日志或工作区。

## 依赖

- DeepSeek Harness `dsh-v0.1.0-rc.8` /
  `141eb6fef83422698aef7a981029e843e8161534`。
- [ADR-0006](../../architecture/decisions/ADR-0006-version-pinned-dsh-plugin-integration.md)。
- [DSH 插件登记与检查表](../../integrations/dsh-plugins.md)。
- Active：`DVP-0001` `dsh-plugin-subscriptions@0.3.1`、`DVP-0002`
  `@deepviewer/dsh-plugin-preview@0.1.0`。

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| rc.8 client 槽位或源码锚点漂移 | 预览、设置或 Finder 覆盖构建失败 | 确定性锚点检查、rc.8 类型与完整 Web build；失败先适配再发布 |
| 订阅插件外部协议变化 | 登录或实际调用失败 | 自动 capability 检查、可禁用降级、PC-009 人工复验 |
| 旧 SQLite schema 不兼容 | 自定义用户无法打开历史会话 | 默认继续 JSONL、上游失败关闭、保留 0.2.1 回滚，不执行自动迁移 |
| 正式包混入本机状态 | 隐私或凭据泄漏 | allowlist staging、环境凭据值扫描、双架构独立净化审计 |

## 未决问题

- Q-001：PC-009 的真实订阅登录、状态/用量、实际调用与登出由维护者在 0.2.2 包上复验；
  未完成时本规格保持 Implementing，发行说明标记 Pending Manual。

## 审批

- 决策：Approved by direct maintainer instruction
- 审批人：Duoasa
- 日期：2026-08-20
