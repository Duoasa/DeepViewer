---
id: DV-0015
title: DeepSeek Harness 0.1.1-rc.2 core upgrade and DeepViewer 0.2.3
status: Implementing
owner: Duoasa
created: 2026-08-22
updated: 2026-08-22
depends_on: [DV-0011, DV-0012, DV-0014]
---

# DV-0015：DeepSeek Harness 0.1.1-rc.2 核心升级与 DeepViewer 0.2.3

## 摘要

将 DeepViewer 内置核心从 DeepSeek Harness `0.1.0-rc.8` 升级到官方不可变标签
`dsh-v0.1.1-rc.2`，发布身份更新为 DeepViewer `0.2.3` Build `1`。升级同时适配并验证全部
Active 插件、受控 UI 覆盖、图片处理链、默认 JSONL 会话和纯核心降级路径。维护者完成本地
视觉检查后，本规格进一步生成双架构 Developer ID 签名候选包，同步文档并合并代码到 `main`。
维护者随后提供 0.2.3 产品图并明确批准公开发布，因此同一规格继续完成 Apple 公证、ticket
staple、`v0.2.3` tag、GitHub Release、双架构资产上传与发布后回读。

## 背景与问题

DeepViewer 0.2.2 Build 2 固定 rc.8。上游 rc.1/rc.2 新增视觉模型、Files API 图片上传复用、
模型约束驱动的图片缩放与转码、提供方授权能力，并修改输入框、Markdown、会话标题与凭据事件。
这些变化覆盖 DeepViewer 的预览插件、订阅插件和受控 UI 覆盖接点，不能只替换版本字符串。

订阅插件 `0.3.1` 的 DSH peer 范围 `^0.1.0-rc.5` 不接受 `0.1.1-rc.2` 预发布版本；预览插件
的九个 DSH peer 则精确固定 rc.8。两个插件都必须在 rc.2 上重新解析、构建和验证。

## 目标

- G-001：提供固定官方 rc.2 核心的 DeepViewer 0.2.3 Build 1 本地开发版。
- G-002：完成 DVP-0001 与 DVP-0002 的自动兼容检查和安全降级检查。
- G-003：保留 DeepViewer 现有窗口、设置、预览、Finder、品牌和启动行为。
- G-004：生成通过净化审计和严格签名验证的 arm64/x64 0.2.3 候选安装包，并将可复现
  源码、README 与 SDD 合并到远端 `main`。
- G-005：以维护者提供的 0.2.3 产品图更新双语 README，发布经过公证的 `v0.2.3` 双架构
  macOS 预览版并验证公开资产、校验值、Latest 状态与 CI。

## 非目标

- NG-001：本规格不将 0.2.3 描述为稳定版；PC-009 与其他 Pending Manual 必须继续显式披露。
- NG-002：不同时升级订阅插件的功能版本或引入其主线新增能力。
- NG-003：不在本规格中实施 Runtime 包体积优化。
- NG-004：不为可选 SQLite 后端编写迁移器。

## 用户与用例

### UC-001：维护者检查 0.2.3 本地开发版

- 参与者：DeepViewer 维护者。
- 前置条件：macOS 开发机具有匹配架构的依赖与本地工作区。
- 主流程：构建 rc.2 核心与两个插件，启动 DeepViewer Dev，检查核心会话、设置、预览和订阅入口。
- 失败/退出流程：任一插件可通过既有环境开关停用；纯核心必须仍能启动并输出可诊断错误。

## 功能需求

- R-001：Runtime 与桌面门禁必须固定 DSH `0.1.1-rc.2` 和提交
  `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。
- R-002：应用版本必须为 `0.2.3` Build `1`，About 与开发版身份必须读取一致版本。
- R-003：必须按插件登记表对 DVP-0001 与 DVP-0002 执行 PC-001—PC-009；自动项不得有 Fail。
- R-004：预览插件必须以 rc.2 DSH peer 重新构建，预览 RPC、静态路由、详情栏与文件打开保持可用。
- R-005：订阅插件必须具有明确的 rc.2 peer 兼容声明，登录状态、模型、工具、用量 UI 和安全禁用路径保持可用。
- R-006：受控上游覆盖必须在干净 rc.2 checkout 上确定性应用，完整 Web production build 必须通过。
- R-007：本地开发版必须继续以 `--port 0 --no-open` 启动唯一内置核心并由 Electron 窗口接管页面。
- R-008：rc.2 新增的 `sidebar.brand.mark` 与 `sidebar.brand.name` 必须分别由 DeepViewer 图标
  和文本名称占用；本地 profile 不得回退为 DSH 鲸鱼或 `DSH Local Build`。
- R-009：arm64 与 x64 必须从固定源码和 release-pack 分别全新生成 Runtime、allowlist staging、
  `.app` 与 DMG，并完成隐私审计、Developer ID 签名、严格嵌套签名和 DMG 完整性验证。
- R-010：双语 README、规格索引、插件登记与验证记录必须反映 0.2.3/rc.2 的实际状态；完成
  自动门禁后代码必须通过发布分支提交并快进合并到远端 `main`。
- R-011：公开发布前必须将维护者提供的原始产品图保存为版本化 `Resources/DeepViewer-0.2.3.png`
  并替换双语 README 顶图；两个最终 DMG 必须 Apple 公证、装订 ticket、通过 Gatekeeper 与只读
  挂载回读，再随校验清单上传 `v0.2.3` GitHub Release 并标记为 Latest。

## 非功能需求

- NFR-001：核心和插件版本必须固定且可复现，不从未固定分支生成运行产物。
- NFR-002：不得扩大 Renderer preload/IPC、工作区文件或网络权限。
- NFR-003：插件失败必须可安全降级，不能阻断纯核心启动。
- NFR-004：构建、测试和开发启动日志不得输出凭据、账户数据或会话正文。
- NFR-005：签名候选包不得包含开发机绝对路径、个人设置、工作区内容、凭据值或逃逸 Runtime
  根目录的符号链接。

## 验收条件

- AC-001：给定干净的官方 rc.2 checkout，同步受控覆盖并构建时 host/client、预览插件和 Web production build 全部通过。
- AC-002：给定两个 Active 插件，PC-001—PC-008 自动检查全部 Pass，PC-009 明确记录维护者人工状态且没有 Fail。
- AC-003：给定 0.3.1 订阅插件和 0.1.0 预览插件，最终解析图中不存在 rc.8 DSH peer，插件启用与分别禁用时均能启动。
- AC-004：给定桌面测试与生产构建，版本显示为 0.2.3 Build 1 / DSH rc.2，受控覆盖锚点和桌面回归全部通过。
- AC-005：给定本地开发启动命令，DeepViewer Dev 打开应用窗口、只启动一个 rc.2 Web Runtime，且不额外唤起系统浏览器。
- AC-006：给定本地或候选 client profile，侧栏展开与折叠时均显示独立 DeepViewer mark，展开态
  名称是文本 `DeepViewer`，且品牌插槽没有 DSH fallback。
- AC-007：给定全新的 arm64/x64 构建输入，两个架构的 Runtime、应用与 DMG 均匹配 0.2.3
  Build 1 / DSH rc.2，通过隐私审计、架构检查、Developer ID 签名、严格验证和 `hdiutil verify`。
- AC-008：给定候选包验证完成，双语 README 与 SDD 证据同步，发布分支提交已推送且远端
  `main` 指向包含该提交的历史。
- AC-009：给定维护者批准公开发布，`v0.2.3` tag 与 GitHub Release 指向包含 0.2.3 产品图和
  最新下载说明的发布源码；arm64/x64 DMG 及 `SHA256SUMS.txt` 均可公开下载，服务器端大小与
  SHA-256 匹配本地最终资产，Release 为 Latest，发布提交 CI 通过。

## 边界与失败行为

- tag、commit、manifest 或插件 peer 不匹配时构建立即失败。
- 订阅或预览插件缺失、版本错误或适配失败时，默认组合不得被误报为成功；对应禁用开关仍须允许纯核心启动。
- Files API 不可用时由上游回退路径处理，DeepViewer 不复制第二套图片上传实现。
- 候选封包前清理两个架构的 Runtime、staging、应用输出和同名 DMG；不得复用旧版本产物。
- 公证配置缺失、任一提交未 Accepted、ticket/DMG/Gatekeeper/只读挂载验证失败，或远端资产
  回读不一致时，停止公开发布或撤回未完成 Release，不得标记为 Latest。

## UX 说明

不新增导航。用户可见变化来自 rc.2 的视觉模型、图片处理、输入框多行提问、Markdown 宽表格和
子代理标题导航。维护者需人工检查输入框 footer、文件引用、右侧预览、订阅设置入口，以及
rc.2 新品牌插槽中的 DeepViewer 图标与文本名称。

## 数据、安全与隐私

默认会话继续使用隔离 DeepViewer DSH home 下的 JSONL。订阅凭据继续遵守 DVP-0001 的原子
`0600` 文件与日志脱敏边界。图片可能由目标模型的 Files API 上传；DeepViewer 不新增上传目的地
或额外副本。预览仍限制于已登记工作区、短期 capability 与 loopback RPC。

## 依赖

- DeepSeek Harness `dsh-v0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。
- [DSH 插件登记与检查表](../../integrations/dsh-plugins.md)。
- Active：`DVP-0001` `dsh-plugin-subscriptions@0.3.1`、`DVP-0002`
  `@deepviewer/dsh-plugin-preview@0.1.0`。

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| 订阅插件 peer 不接受 rc.2 | 安装警告、重复旧核心或运行不兼容 | 对 staging 副本应用最小 manifest 适配，检查解析图并跑真实流程 |
| client 槽位或源码锚点漂移 | Web 构建或预览 UI 失败 | 在干净 rc.2 上同步锚点并完成 host/client/Web 构建 |
| 品牌组件仍接入旧 wordmark 路径 | 侧栏回退为 DSH Local Build | 分别注册 rc.2 mark/name 插槽并用本地 profile 组合测试覆盖 |
| 图片请求链改变 | 大图、透明图或提供方调用失败 | 复用上游测试并补充打包运行时原生依赖检查 |
| 外部 OAuth 服务变化 | 自动测试无法证明真实账户可用 | 保留 PC-009 Pending Manual 与可禁用降级 |
| 双架构包来源或签名漂移 | 资产不可复现、泄露本机信息或无法验证 | 每架构清理重建、allowlist staging、隐私审计和逐 Mach-O 严格验证 |
| README 产品图或公开资产与版本不一致 | 用户下载错误版本或无法核验 | 版本化保存原图、发布前回读链接、发布后比对服务器端大小与 digest |

## 未决问题

- Q-001：PC-009 由维护者在本地开发版中完成登录、状态/用量、至少一次调用和登出检查。

## 审批

- 决策：Approved by direct maintainer instructions；2026-08-22 先追加双架构签名候选包、文档
  同步与 `main` 合并范围，随后追加 0.2.3 产品图、Apple 公证和公开 GitHub Release 范围
- 审批人：Duoasa
- 日期：2026-08-22
