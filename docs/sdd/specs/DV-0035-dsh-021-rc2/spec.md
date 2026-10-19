# DV-0035 — DSH 0.2.1 RC 内核与适配层升级

Status: Implementing
Owner: Duoasa
Date: 2026-10-19
Approval: 维护者明确批准“升级内核，适配层升级，前端保留”。

## Scope

从 0.5.1 Build 91 / DSH 0.2.0-rc.2 升至 DSH 0.2.1-rc.2，固定提交 687f282e8625c6b8d11ff58211a90524be2e4317。保留 DeepViewer 前端产品行为、布局、品牌与资源。Active 模块为 DVP-0001 subscriptions 0.3.1、DVP-0006 model-capabilities 1.0.2、DVP-0007 adapter；逐项执行 PC-001 至 PC-009。维护者于同日追加授权推送 GitHub 并合并 main；维护者随后确认“界面没问题”，并授权 0.7.1 arm64 签名公证安装包、GitHub Release、main 合并和双语 README 更新。真实账户与未明确覆盖的交互仍保留人工验收；安装包发布沿用既有机制，不发布自动更新 feed。

## Requirements

- R-001: 固定新内核、依赖与 CI；保留原开发目录及未提交改动。
- R-002: 使用上游原生端口、更新通道和构建接口；仅保留必要的局部适配，不修改 Agent loop。
- R-003: 保留 Work/Chat 隔离、无工作区 Chat、历史/附件、Synapse、顶部统计与 0.5.1 品牌视觉；不覆盖新内核的数据语义。
- R-004: 全部 Active 模块满足 PC-001 至 PC-008 自动验证，PC-009 真实账户人工验证保留。
- R-005: 以 0.7.1 / Build 92 全新构建 arm64 签名公证 DMG，发布 SHA-256 清单，更新双语 README，推送并合并 main；核验公开资产与最终 CI。
- NFR-001: 不写真实用户 profile，不复用已签名包；隔离测试数据，保留许可和更新来源隔离。

## Acceptance

- AC-001: 固定提交/版本一致，干净上游适配两次幂等，Agent loop 未改变。
- AC-002: 类型检查、生产构建与适配/模块 smoke 通过；验证新版客户端构建接口。
- AC-003: 会话创建/复用、冷历史、Work/Chat 搜索、Synapse 与底部输入框回归通过，前端品牌资源不变。
- AC-004: 三个 Active 模块逐项登记 PC 证据，禁用可退回核心，桌面端口/更新渠道隔离通过。
- AC-005: 界面由维护者于 2026-10-19 确认通过；真实账户及未明确覆盖的交互保留 Pending Manual。
- AC-006: 0.7.1 / Build 92 DMG 的签名、公证、净化、搬迁 payload、只读挂载、SHA-256 与公开资产验证通过；README、源码、main CI 和 Release 同步。

## Rollback

原项目和旧内核工作目录保持原样；升级仅在独立 checkout 的 codex/dsh-021-rc2 分支实施。未进行真实用户数据迁移，无需回退用户目录。
