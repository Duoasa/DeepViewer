# DV-0034 Tasks

Status: Implementing

- [x] T-001 (R-001, AC-001; D-001): 恢复 v0.3.3 的 SVG、动画与样式；4 项旧版源码基线检查、175 项 fresh-source 契约/两次幂等及 178 项原生 DOM 回归通过，包含 resident composer/draft 连续性。
- [x] T-002 (R-002, AC-002; D-002): 保留鱼标 SVG，Apple actool 编译分层 catalog 与完整 ICNS、删除运行时 Dock override；本机图标/compiler 与 identity 6 项通过。最终包中的实际资源仍由 T-003 核验。
- [ ] T-003 (R-003, AC-003, AC-005; D-003): 更新 0.5.1 版本，全新 arm64 构建，验证最终包、签名公证与 SHA-256。
- [ ] T-004 (R-003, AC-005; D-003): 推送源码、CI、GitHub 公开 Release/远端 digest 核验与 main 合并，同步发布文档。
- [ ] T-005 (AC-004, NFR-002): 维护者实际新会话与 Dock 视觉验收（Pending Manual）。
