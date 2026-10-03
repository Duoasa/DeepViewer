# DV-0033 Tasks

Status: Implementing

- [x] T-001 (R-001, R-005, NFR-001; D-001): 固定并导入 Scoder 源码、清单与原生适配层。
- [x] T-002 (R-002, R-003; D-002): 恢复 DeepViewer 品牌、图标、渠道/数据和更新身份。
- [x] T-003 (R-004; D-002): 保留数据布局与迁移隔离，核对退休插件/模型能力配置承接。
- [x] T-004 (AC-001–AC-004, AC-006; D-003): 依赖、静态检查、隔离测试、契约及生产构建。
- [ ] T-005 (AC-005, AC-006; NFR-002): 维护者视觉、交互、迁移与真实账户验收（Pending Manual）。

- [x] T-006 (R-006, AC-007; D-004): 修复 watcher 的 metadata/相同字节噪声和 client artifact ctime-only 热卸载，验证真实 metadata/HMR 链路及 Build 88 的 180 秒运行观察。
- [x] T-007 (R-007, NFR-002; D-005): 在本次发布同步边界更新累计验证、规格索引和 0.5.0 候选发布记录；保留 Implementing 与 Pending Manual。
- [ ] T-008 (R-007, AC-008, NFR-001; D-005): 全新 0.5.0 Build 90 arm64 core/renderer/runtime 与 staging、实际 ASAR 库存/净化审计已通过，runtime Developer ID 签名已验证；应用/DMG 签名、公证、安装完整性、资产 SHA-256 与最终源提交仍 Pending。
- [ ] T-009 (R-007, AC-008; D-005): 已推送阶段源码并创建 [PR #7](https://github.com/Duoasa/DeepViewer/pull/7)，旧候选 HEAD CI success；当前 draft 尚未合并，最终源提交、安装资产发布与远端 digest 核验 Pending。
- [x] T-010 (R-007, AC-008, NFR-001; D-005a): 在封存前使用实际 builder transformer 规范化依赖清单；755 份清单中 268 份变化，实际 ASAR 逐文件库存验证通过，原验证器保持严格；完整 bounded smoke 17 文件/118 项通过。
