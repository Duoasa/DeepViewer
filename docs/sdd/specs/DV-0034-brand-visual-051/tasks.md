# DV-0034 Tasks

Status: Implementing

- [x] T-001 (R-001, AC-001; D-001): 恢复 v0.3.3 的 SVG、动画与样式；4 项旧版源码基线、175 项 fresh-source 契约 / 两次幂等、178 项原生 DOM 回归及最终 ASAR 17 项静态检查通过，包含 resident composer / draft 连续性。
- [x] T-002 (R-002, AC-002; D-002): 保留鱼标 SVG，Apple actool 编译 native catalog 与完整 ICNS、移除 full-bleed PNG runtime Dock override；本机图标 / compiler 与 identity 6 项通过，最终 bundle 的 catalog 外观 / vector、10 个有效 ICNS renditions / 原生 alpha 边界、About 字节与图标身份及无旧 DockThemes 检查通过。
- [x] T-003 (R-003, AC-003, AC-005; D-003): 统一 0.5.1 / Build 91，从本版本固定源码与依赖全新构建 arm64 runtime / staging / app / DMG；typecheck、121 项 bounded smoke、严格 ASAR 库存与最终净化审计、实际 signed payload、runtime / app / DMG 签名、双公证 Accepted、stapling / Gatekeeper、DMG 完整性 / 只读挂载身份及新 SHA-256 清单通过。
- [x] T-004 (R-003, AC-005; D-003): 构建源与最终 tag 源均已推送且 CI success；PR #9 已合并 main，main merge CI success，tag v0.5.1 已推送；v0.5.1 Release 已正式公开为 Latest，DMG 与 SHA 两资产远端 digest 匹配，公开下载检查通过。本次变更同步发布记录、累计验证与任务证据；最终来源、时间、资产和 CI 见发布记录。
- [ ] T-005 (AC-004, NFR-002): 维护者实际新会话与 Dock 视觉验收（Pending Manual）。
