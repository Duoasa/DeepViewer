---
id: DV-0007
title: macOS Developer ID signing and notarization - Verification
status: Implementing
updated: 2026-08-16
---

# DV-0007：验证

## 验证环境

- 工作分支：`codex/macos-signing-notarization`
- 平台：macOS 26.5.2，Apple Silicon
- Xcode：`/Applications/Xcode.app/Contents/Developer`
- notarytool：`1.1.2 (41)`
- 当前签名身份：`security find-identity -v -p codesigning` 报告 `0 valid identities found`
- 公证凭据：尚未配置可用 Keychain profile

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | codesign 深度/严格验证 | Blocked | 本机缺少 Developer ID Application 身份 |
| AC-002 | entitlement 自动检查与最终包枚举 | Partial | 最小 plist 与选择器自动测试通过；等待有证书后的最终 Mach-O 枚举 |
| AC-003 | notarytool + stapler | Blocked | 证书与 Keychain profile 尚未配置 |
| AC-004 | GitHub 新下载 + quarantine + spctl | Pending | 等待公证资产 |
| AC-005 | AC-011 隐私审计 + SHA/远端 digest | Pending | 等待全新双架构构建 |
| AC-006 | 缺凭据失败门禁测试 | Pass | `package.mjs --sign` 在清理/构建前因无 Developer ID 退出；`notarize.mjs` 在访问 DMG/网络前因无 Keychain profile 退出 |
| AC-007 | README/SDD/GitHub 一致性 | Pending | 等待资产替换 |

## 执行的命令

```text
security find-identity -v -p codesigning
xcode-select -p
xcrun notarytool --version
node --check apps/deepviewer-desktop/scripts/macos-signing.mjs
node --check apps/deepviewer-desktop/scripts/notarize.mjs
node --check apps/deepviewer-desktop/scripts/package.mjs
pnpm typecheck
pnpm test
pnpm desktop:build
plutil -lint apps/deepviewer-desktop/entitlements/darwin-jit.plist apps/deepviewer-desktop/entitlements/darwin-empty.plist
node apps/deepviewer-desktop/scripts/package.mjs --sign --arch=arm64
node apps/deepviewer-desktop/scripts/notarize.mjs --arch=arm64
```

结果：Xcode 与 notarytool 可用；语法、TypeScript、7 个测试文件/31 项测试、三个 Vite production build 与两个 entitlement plist 全部通过。RuntimeManager 测试在受限沙箱内因 loopback `EPERM` 失败，按既有测试需求在沙箱外复跑后 31/31 通过。Keychain 中没有有效代码签名身份；签名与公证命令均在任何产物清理、Apple 上传或 GitHub 变更前以明确缺失项失败。未尝试 ad-hoc 或其他证书降级。

## 人工检查

- [ ] 维护者从全新 GitHub 下载完成标准安装与首次打开
- [ ] 维护者确认核心界面与 Runtime 在 Hardened Runtime 下正常
- [ ] 维护者确认不再需要“仍要打开”或 `xattr` 绕过
- [ ] 维护者确认签名展示的开发者名称符合预期

## 残余风险

- 本机尚缺 Developer ID Application 身份和 notarytool Keychain profile，Apple 流程无法开始。
- x64 最终交互仍需真实 Intel Mac 或维护者接受的 Rosetta 验收边界。

## 结论

- 结果：Implementing；Apple 账户前置条件阻断最终签名与公证
- 验证人：Codex（代码和基础验证）；Duoasa（后续人工安装/交互）
- 日期：2026-08-16
