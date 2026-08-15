---
id: DV-0007
title: macOS Developer ID signing and notarization - Tasks
status: Implementing
updated: 2026-08-16
---

# DV-0007：实施任务

## 规则

- 任一签名、公证或隐私门禁失败都阻止公开资产替换。
- 不把证书、密码、API key 或 Keychain 导出文件写入仓库。
- 开发代理只执行代码和命令级基础验证；应用安装与交互由维护者手动验收。

## 任务

- [x] T-001 `[R-001, R-003, R-005]` 建立 DV-0007 与 ADR-0005，明确 Developer ID、最小 entitlement、外层 DMG 公证和 Keychain 边界。
- [x] T-002 `[R-001, R-002, NFR-001]` 为 `package.mjs` 增加显式签名模式、Developer ID 身份解析、应用/DMG 签名和失败门禁。
- [x] T-003 `[R-003, R-005, NFR-002]` 实现只使用 Keychain profile 的 notarytool、日志、staple 和基础策略验收脚本。
- [x] T-004 `[AC-002, AC-006]` 增加签名配置、最小 entitlement 和禁止明文凭据路径的自动测试。
- [ ] T-005 `[R-004, AC-001, AC-005]` 从 `v0.1.1` 应用源码重新生成双架构 Runtime、签名应用/DMG并完成隐私、架构和校验和验证。
- [ ] T-006 `[AC-003]` 提交两个 DMG 公证，保存 Accepted submission ID/日志并 staple。
- [ ] T-007 `[R-006, AC-004, AC-005]` 备份旧资产，替换 GitHub Release，重新下载并完成 quarantine、spctl、SHA-256 与远端 digest 验证。
- [ ] T-008 `[R-007, AC-007]` 更新 README、Release notes、版本发布记录和最终验证证据。
- [ ] T-009 `[NFR-004]` 由维护者手动验收安装、首次打开和核心交互，代理记录结果但不代替执行。

## 延后事项

| 项目 | 原因 | 后续规格 |
| --- | --- | --- |
| 自动更新 | 需要更新签名、回滚和服务端协议 | 可靠更新规格 |
| Windows 签名 | 平台与证书体系不同 | Windows 客户端规格 |
| Mac App Store | 需要 MAS Electron、Sandbox 与审核 | MAS 分发规格 |
