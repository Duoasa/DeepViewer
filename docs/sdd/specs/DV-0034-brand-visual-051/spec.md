# DV-0034 — 新会话品牌动画与 macOS 图标修复、0.5.1 ARM64 发布

Status: Implementing
Owner: Duoasa
Date: 2026-10-04
Approval: 维护者于 2026-10-04 直接要求恢复之前发行版的新会话待机动画（大小、动画、样式），从资源与原生图标链路解决 Dock 图标过大问题，明确拒绝简单缩放；完成后构建 0.5.1 arm64 安装包、推送 Duoasa/DeepViewer 并合并 main。该明确目标指令作为本规格范围认可。

## 范围与基线

当前公开基线为 v0.5.0 / Build 90；新会话视觉以 v0.3.3 / Build 75 的版本化源码为恢复依据。保持 DV-0033 的 DSH 0.2.0-rc.2 固定提交、原生 Conversation/composer、HMR 修复、数据目录及内置模块，不回放旧内核整文件覆盖，不操作真实用户数据或字体权限。

## Requirements

- R-001: 新会话恢复 v0.3.3 鱼标的尺寸、透明度、光标闪烁、间距与文本样式，以及待机区在窗口顶部与底部输入区之间的居中位置；遵循原有 reduced-motion 行为，通过现有品牌槽和局部呈现适配新内核。
- R-002: 排查图标的源资源、画布与透明边界、ICNS 各尺寸、原生 bundle 与运行时 Dock 图标选择链路；修复不正确的图标表示或应用方式，保留原鱼标设计，不以简单缩小整张旧图、CSS scale 或重复套底板消除表象。
- R-003: 版本号为 0.5.1，build 延续既有单调序列；从固定源码和依赖全新生成 arm64 Runtime、staging、app、DMG 与 SHA-256 清单，经签名、公证、最终净化审计后发布到 Duoasa/DeepViewer，推送并合并 main。
- NFR-001: 不改变上游 agent loop、许可证、账户及持久化数据；代码与公开包不包含凭据、个人路径或用户内容。
- NFR-002: 代理完成代码、源码/资源及打包基础验证。实际界面与 Dock 视觉验收继续由维护者完成；Pending Manual 不因授权发布自动成为 Pass。自动更新 feed 仍遵循既有实际安装/更新门禁。

## Acceptance

- AC-001: 恢复的 SVG 几何与旧源码一致；48px 高、50% opacity、1s steps cursor 闪烁、40px 图文间距和 24px/32px 文本规则有源码证据；待机区独立于底部 composer 居中，reduced-motion 禁用动画；既有新会话 composer 回归通过。
- AC-002: 图标根因与修复链路被记录，构建输出中的原生 bundle/Dock 图标表示及选择符合相同原生画布约定；没有对旧整张图做简单缩放或运行时尺寸补丁。
- AC-003: typecheck、相关 smoke、全新 production build、实际包资源检查通过。
- AC-004: 维护者确认新会话视觉及实际 Dock 与邻近 macOS 图标协调（Pending Manual）。
- AC-005: 0.5.1 arm64 的最终来源/build、签名公证、包体审计、DMG 完整性、SHA-256、公开资产 digest、源码推送及 main 合并均有真实证据。

## 回滚

代码与品牌资源可恢复 v0.5.0；版本化修复不写用户存储。已发布 v0.5.0 资产保留，不覆盖旧 Release。
