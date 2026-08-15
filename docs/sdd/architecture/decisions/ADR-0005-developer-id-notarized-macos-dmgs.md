---
id: ADR-0005
title: Developer ID signed and notarized macOS DMGs
status: Accepted
date: 2026-08-16
supersedes: []
---

# ADR-0005：使用 Developer ID 签名并公证 macOS DMG

## 背景

DeepViewer 通过 GitHub Release 直接分发 macOS DMG。未签名、未公证的公开包会被 Gatekeeper 阻止，并可能显示泛化的“已损坏”提示；要求用户移除 quarantine 只能用于早期测试，不能作为长期正式分发路径。

## 决策

1. macOS 直接分发使用有效的 `Developer ID Application` 身份，对 Electron 应用、Helpers、Frameworks、内置 Runtime 可执行文件和最终 DMG 从内到外签名。
2. 所有可执行签名启用 Hardened Runtime 和安全时间戳；默认只授予 Electron/V8 运行必需的 JIT entitlement，不启用 `get-task-allow`、未签名可执行内存、禁用库校验或无关设备权限。
3. Apple Silicon 与 Intel 继续独立构建、签名和公证。最终分发的 UDZO DMG 使用 `notarytool` 提交 Apple 公证，只公证最外层 DMG，并把票据 staple 到该 DMG。
4. 签名私钥保留在 macOS Keychain。公证认证只通过 `notarytool` Keychain profile 读取；仓库、命令行参数、日志、CI 输出和 Release 说明不得保存 Apple ID 密码、API 私钥或其他认证值。
5. 只有两个架构均通过代码签名、隐私审计、公证、staple、DMG 完整性和 Gatekeeper 基础验收后，才允许替换公开 Release 资产。远端替换失败时使用事先保留的资产回滚。

## 后果

### 正面

- 用户可通过标准 macOS 安装流程打开应用，不再依赖移除 quarantine。
- Hardened Runtime、Apple 公证记录和 stapled ticket 提供可验证的发布者身份与完整性。
- 密钥与构建产物分离，签名流程可复现但不会把认证材料带入仓库或应用包。

### 代价与风险

- 需要有效 Apple Developer Program 会员、Developer ID 证书和公证权限。
- 每个架构都要独立提交公证，发布耗时和 Apple 服务依赖增加。
- Hardened Runtime 可能暴露内置 Runtime 或原生模块的签名兼容问题，必须在发布前以代码和基础验证阻断。

## 备选方案

### 继续提供 quarantine 绕过命令

拒绝作为正式分发方案。它降低用户信任，也绕过了 Gatekeeper 提供的来源与恶意软件检查。

### 只签名应用、不公证 DMG

拒绝。macOS 10.15 及以后对新签名的直接分发软件要求公证，且最终分发容器应携带 stapled ticket。

### 使用 Mac App Store 签名

暂不采用。当前分发渠道是 GitHub Release，不使用 MAS Electron 构建、App Sandbox 或 App Store 审核流程。

## 后续行动

- 由 [DV-0007](../../specs/DV-0007-macos-signing-notarization/spec.md) 实现并验证双架构签名、公证和 Release 资产替换。
- Windows 代码签名与自动更新由后续独立规格处理。
