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
| [DV-0010](DV-0010-global-settings-experience/spec.md) | 全局设置与关于 DeepViewer 页面 | Verified | Duoasa | 2026-08-19 |
| [DV-0011](DV-0011-subscription-provider-integration/spec.md) | 订阅模型提供方插件集成 | Implementing | Duoasa | 2026-08-18 |
| [DV-0012](DV-0012-preview-sidebar-plugin/spec.md) | 代码与实时网页预览侧栏插件 | Implementing | Duoasa | 2026-08-18 |
| [DV-0013](DV-0013-finder-reveal-generated-files/spec.md) | 在 Finder 中显示生成文件 | Implementing | Duoasa | 2026-08-18 |
| [DV-0014](DV-0014-dsh-rc8-core-upgrade/spec.md) | DeepSeek Harness rc.8 核心升级与 0.2.2 发布 | Implementing | Duoasa | 2026-08-20 |
| [DV-0015](DV-0015-dsh-rc2-core-upgrade/spec.md) | DeepSeek Harness 0.1.1-rc.2 核心升级与 0.2.3 | Implementing | Duoasa | 2026-08-22 |

| [DV-0017](DV-0017-dsh-015-arm64-development/spec.md) | DSH 0.1.5-rc.2 ARM 开发适配 | Implementing | Duoasa | 2026-09-14 |
| [DV-0018](DV-0018-model-reasoning-plugin/spec.md) | 自定义模型思考强度原生插件 | Implementing | Duoasa | 2026-09-16 |

DV-0016 已由既有灵动岛开发分支使用，本次稳定版基线不引入该功能。

| [DV-0019](DV-0019-runtime-web-permission-parity/spec.md) | Runtime 与 DSH Web 权限一致性 | Implementing | Duoasa | 2026-09-19 |
| [DV-0020](DV-0020-better-sidebar-integration/spec.md) | Better Sidebar 原生集成 | Implementing | Duoasa | 2026-09-19 |
| [DV-0021](DV-0021-progressive-process-disclosure/spec.md) | 渐进式过程披露 | Implementing | Duoasa | 2026-09-19 |

| [DV-0023](DV-0023-workspace-free-chat/spec.md) | 无工作区 Chat 与 Work 模式 | Implementing | Duoasa | 2026-09-20 |
| [DV-0024](DV-0024-managed-project-creation/spec.md) | 统一目录与新建项目弹窗 | Implementing | Duoasa | 2026-09-20 |

| [DV-0026](DV-0026-native-taskboard/spec.md) | Taskboard 原生集成（已撤销） | Superseded | Duoasa | 2026-09-21 |

| [DV-0027](DV-0027-default-file-delivery/spec.md) | 默认文件附件交付 | Implementing | Duoasa | 2026-09-21 |
| [DV-0029](DV-0029-system-network/spec.md) | 自动系统网络适配与内网授权 | Implementing | Duoasa | 2026-09-22 |

| [DV-0031](DV-0031-stable-user-data/spec.md) | 固定用户数据目录与升级连续性 | Implementing | Duoasa | 2026-09-22 |

| [DV-0032](DV-0032-public-033-release/spec.md) | 0.3.3 ARM64 公开签名发布 | Implementing | Duoasa | 2026-09-23 |

DV-0022、DV-0025、DV-0028 和 DV-0030 是此前仅用于本地/内部固化的编号，其过程材料不属于公开源码；公开发布证据统一见 DV-0032。

| [DV-0033](DV-0033-scoder-native-rebase/spec.md) | Scoder 原生源码迁回 DeepViewer、白屏修复与 0.5.0 ARM64 发布 | Implementing | Duoasa | 2026-10-03 |

| [DV-0034](DV-0034-brand-visual-051/spec.md) | 新会话品牌动画与 macOS 图标修复、0.5.1 ARM64 发布 | Implementing | Duoasa | 2026-10-04 |

## 下一个编号

`DV-0035`

## 目录规则

- 目录名使用 `DV-NNNN-kebab-case`。
- 一个目录只描述一个可独立审批和验证的变更单元。
- `spec.md`、`design.md`、`tasks.md` 和 `verification.md` 使用相同 ID 和状态。
- 大型功能拆分为多个规格，并在依赖章节互相链接。
- 被替代的目录保留在原位置，状态改为 `Superseded`。

新规格从 [`_template/`](_template/spec.md) 开始，完整流程见上级 [`README.md`](../README.md)。

公开版本及其资产证据见 [`releases/README.md`](../releases/README.md)。
