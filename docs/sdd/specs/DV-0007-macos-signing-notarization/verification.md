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
- 当前签名身份：`Developer ID Application: Chenchen Xu (BUUH229D5Q)`，证书
  SHA-1 `E52D0A9C7C377AF77C484155CC0CFCFB27D949D3`
- 公证凭据：Keychain profile `deepviewer-notary` 可用；文档与日志不保存认证值

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | codesign 深度/严格验证 | Pass | 两个 `.app` 的 30 个 Mach-O 均由同一 Developer ID 签署并通过严格验证 |
| AC-002 | entitlement 自动检查与最终包枚举 | Pass | JIT/空 entitlement 选择器测试及最终 30 个 Mach-O 枚举通过；无禁止权限 |
| AC-003 | notarytool + stapler | Pass | arm64 `f8726eaa-cc78-4a9d-81e1-a26e0b6754af`、x64 `6e159a13-49ef-40a6-ab1f-f7121786d6f4` 均 Accepted、0 error、staple 有效 |
| AC-004 | GitHub 新下载 + quarantine + spctl | Pass | 从 Release 重新下载的两个 DMG 加 quarantine 后均为 `accepted / Notarized Developer ID` |
| AC-005 | AC-011 隐私审计 + SHA/远端 digest | Pass | 双架构全新包各 22 个 ASAR 条目通过隐私审计；重新下载 SHA、大小、清单与 GitHub API digest 完全一致 |
| AC-006 | 缺凭据失败门禁测试 | Pass | `package.mjs --sign` 在清理/构建前因无 Developer ID 退出；`notarize.mjs` 在访问 DMG/网络前因无 Keychain profile 退出 |
| AC-007 | README/SDD/GitHub 一致性 | Pass | README、双语 Release notes、SDD、三个公开资产及校验值一致；Release 为 non-draft、non-prerelease、Latest |

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
node apps/deepviewer-desktop/scripts/notarize.mjs --keychain-profile=deepviewer-notary
xcrun stapler validate /absolute/path/to/DeepViewer-0.1.1-macos-{arm64,x64}.dmg
spctl --assess --type open --context context:primary-signature --verbose=4 /absolute/path/to/DeepViewer-0.1.1-macos-{arm64,x64}.dmg
```

结果：语法、TypeScript、7 个测试文件/32 项测试、三个 Vite production build 与两个 entitlement plist 全部通过。RuntimeManager 测试在受限沙箱内因本地进程/loopback 限制失败，按既有测试需求在沙箱外复跑后 32/32 通过。arm64 与 x64 Runtime、应用和 DMG 均为全新构建；每个应用的 27 个内部 Runtime 链接被规范化为包内相对链接，非 Mach-O 资源不会被误签。两个架构均通过隐私、架构、严格签名、DMG 完整性、公证、staple 和 Gatekeeper 基础验证。

本地最终资产：

- arm64：456,147,049 bytes；`1f1a946558ebd3e9b6988b6ce9c8570717e4b7e5a8ec7b43ce51b27ce03dd3bf`
- x64：472,654,669 bytes；`d8cb6983e2bf7d9cef414eca94eabb406f75098dffe863a4f8d9dc27b4331cec`
- `SHA256SUMS.txt`：196 bytes；`af329f7434ab10a22b99d865ac6918013519dedc1362cedf3611311de6122c95`

GitHub 远端验收：旧资产先下载到独立临时目录并核对原 SHA，随后通过浏览器上传三个完整
新资产。GitHub API 报告全部 `uploaded`，大小与上述结果一致，digest 分别为：

- `sha256:1f1a946558ebd3e9b6988b6ce9c8570717e4b7e5a8ec7b43ce51b27ce03dd3bf`
- `sha256:d8cb6983e2bf7d9cef414eca94eabb406f75098dffe863a4f8d9dc27b4331cec`
- `sha256:af329f7434ab10a22b99d865ac6918013519dedc1362cedf3611311de6122c95`

新下载目录中的 `shasum -a 256 -c SHA256SUMS.txt`、两个 `stapler validate` 及带
quarantine 的两个 `spctl` 评估全部通过。

## 人工检查

- [ ] 维护者从全新 GitHub 下载完成标准安装与首次打开
- [ ] 维护者确认核心界面与 Runtime 在 Hardened Runtime 下正常
- [ ] 维护者确认不再需要“仍要打开”或 `xattr` 绕过
- [ ] 维护者确认签名展示的开发者名称符合预期

## 残余风险

- x64 最终交互仍需真实 Intel Mac 或维护者接受的 Rosetta 验收边界。

## 结论

- 结果：Implementing；全部技术验收条件通过，等待维护者完成 T-009 安装与交互验收
- 验证人：Codex（代码和基础验证）；Duoasa（后续人工安装/交互）
- 日期：2026-08-16
