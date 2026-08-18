# Feature Specifications

## 规格索引

| ID | 标题 | 状态 | 负责人 | 更新时间 |
| --- | --- | --- | --- | --- |
| [DV-0001](DV-0001-sdd-foundation/spec.md) | SDD 文档系统基础 | Verified | Duoasa | 2026-08-15 |
| [DV-0002](DV-0002-upstream-foundation/spec.md) | DeepSeek Harness 基础与 DeepViewer 改造方向 | Review | Duoasa | 2026-08-15 |
| [DV-0003](DV-0003-desktop-packaging-spike/spec.md) | Electron 桌面打包纵向验证 | Implementing | Duoasa | 2026-08-16 |
| [DV-0004](DV-0004-macos-integrated-titlebar/spec.md) | macOS 一体化标题栏 | Released | Duoasa | 2026-08-16 |
| [DV-0005](DV-0005-desktop-app-identity/spec.md) | DeepViewer 桌面应用身份 | Released | Duoasa | 2026-08-16 |
| [DV-0006](DV-0006-branded-loading-surfaces/spec.md) | DeepViewer 品牌加载页面 | Implementing | Duoasa | 2026-08-16 |
| [DV-0007](DV-0007-macos-signing-notarization/spec.md) | macOS Developer ID 签名与公证 | Implementing | Duoasa | 2026-08-16 |
| [DV-0008](DV-0008-local-development-workflow/spec.md) | 本地快速迭代与分级发布工作流 | Implementing | Duoasa | 2026-08-17 |
| [DV-0009](DV-0009-macos-workspace-experience/spec.md) | macOS 工作区体验精修 | Verified | Duoasa | 2026-08-17 |
| [DV-0010](DV-0010-global-settings-experience/spec.md) | 全局设置与关于 DeepViewer 页面 | Implementing | Duoasa | 2026-08-18 |
| [DV-0011](DV-0011-subscription-provider-integration/spec.md) | 订阅模型提供方插件集成 | Implementing | Duoasa | 2026-08-18 |
| [DV-0012](DV-0012-preview-sidebar-plugin/spec.md) | 代码与实时网页预览侧栏插件 | Approved | Duoasa | 2026-08-18 |
| [DV-0013](DV-0013-finder-reveal-generated-files/spec.md) | 在 Finder 中显示生成文件 | Implementing | Duoasa | 2026-08-18 |

## 下一个编号

`DV-0014`

## 目录规则

- 目录名使用 `DV-NNNN-kebab-case`。
- 一个目录只描述一个可独立审批和验证的变更单元。
- `spec.md`、`design.md`、`tasks.md` 和 `verification.md` 使用相同 ID 和状态。
- 大型功能拆分为多个规格，并在依赖章节互相链接。
- 被替代的目录保留在原位置，状态改为 `Superseded`。

新规格从 [`_template/`](_template/spec.md) 开始，完整流程见上级 [`README.md`](../README.md)。

公开版本及其资产证据见 [`releases/README.md`](../releases/README.md)。
