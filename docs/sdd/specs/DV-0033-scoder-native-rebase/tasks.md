# DV-0033 Tasks

Status: Implementing

- [x] T-001 (R-001, R-005, NFR-001; D-001): 固定并导入 Scoder 源码、清单与原生适配层。
- [x] T-002 (R-002, R-003; D-002): 恢复 DeepViewer 品牌、图标、渠道/数据和更新身份。
- [x] T-003 (R-004; D-002): 保留数据布局与迁移隔离，核对退休插件/模型能力配置承接。
- [x] T-004 (AC-001–AC-004, AC-006; D-003): 依赖、静态检查、隔离测试、契约及生产构建。
- [ ] T-005 (AC-005, AC-006; NFR-002): 维护者视觉、交互、迁移与真实账户验收（Pending Manual）。

- [x] T-006 (R-006, AC-007; D-004): 修复 watcher 的 metadata/相同字节噪声和 client artifact ctime-only 热卸载，验证真实 metadata/HMR 链路及 Build 88 的 180 秒运行观察。
- [x] T-007 (R-007, NFR-002; D-005): 在本次发布同步边界更新累计验证、规格索引和 0.5.0 发布记录；保留 Implementing 与 Pending Manual。
- [x] T-008 (R-007, AC-008, NFR-001; D-005): 完成全新 0.5.0 Build 90 arm64 构建、严格 ASAR 库存与最终净化审计、runtime/app/DMG Developer ID 签名、app/DMG 公证及 stapling/Gatekeeper、DMG 完整性与只读挂载检查；本地 DMG/ZIP/blockmap SHA-256 及仅含 DMG 的新 SHA256SUMS.txt 已核验。构建源提交与本地资产证据见发布记录；公开发布仍由 T-009 跟踪。
- [x] T-009 (R-007, AC-008; D-005): 最终发布源提交 `01e6903b54e0b5c80a3ff4e6d9a6319d173cbd54` 对应 CI `37131406670` success；[PR #7](https://github.com/Duoasa/DeepViewer/pull/7) 已合并为 `02ea5612b2b0daaeebf33aab0a8078b252d7611f`，main merge CI `37132108558` success。`v0.5.0` 已公开为 Latest，DMG 与 SHA256SUMS.txt 共 2 个资产的远端 digest 与本地 SHA-256 全部匹配；ZIP/blockmap/feed 未发布。
- [x] T-010 (R-007, AC-008, NFR-001; D-005a): 在封存前使用实际 builder transformer 规范化依赖清单；755 份清单中 268 份变化，实际 ASAR 逐文件库存验证通过，原验证器保持严格；完整 bounded smoke 17 文件/118 项通过。
- [x] T-011 (R-007, AC-008, NFR-001; D-005b): production ASAR 的源码 payload smoke 与最终已签名 app 的 prepared runtime smoke 在真正隔离的 HOME/XDG/TMPDIR 下通过；原 120 秒限值保留，源码 smoke 约 12 秒完成。真实用户 HOME 与字体权限仍在 T-005 的 Pending Manual 范围内。
