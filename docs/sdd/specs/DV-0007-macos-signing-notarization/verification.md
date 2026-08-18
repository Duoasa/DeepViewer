---
id: DV-0007
title: macOS Developer ID signing and notarization - Verification
status: Implementing
updated: 2026-08-19
---

# DV-0007：验证

## 验证环境

- 工作分支：`codex/macos-signing-notarization`
- 平台：macOS 26.5.2，Apple Silicon
- Xcode：`/Applications/Xcode.app/Contents/Developer`
- notarytool：`1.1.2 (41)`
- 签名与公证前置条件：本机有效且已完成验证；具体身份、Team ID、证书指纹、公证提交
  标识和 Keychain profile 不写入公开文档

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | codesign 深度/严格验证 | Pass | 两个 `.app` 的 30 个 Mach-O 均由同一 Developer ID 签署并通过严格验证 |
| AC-002 | entitlement 自动检查与最终包枚举 | Pass | JIT/空 entitlement 选择器测试及最终 30 个 Mach-O 枚举通过；无禁止权限 |
| AC-003 | Apple 公证验证 | Pass | arm64 与 x64 两个公开 DMG 均已通过 Apple 公证 |
| AC-004 | GitHub 新下载 + quarantine + 系统安全评估 | Pass | 从 Release 重新下载的两个 DMG 均通过系统安全评估；内部状态字符串不公开 |
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
node apps/deepviewer-desktop/scripts/notarize.mjs --keychain-profile=<private-keychain-item>
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

## v0.1.2 build 2 热修复复验

`v0.1.2-build.2` 的 arm64 与 x64 包均从固定依赖和 allowlist staging 全新构建，应用版本为
`0.1.2`、bundle build number 为 `2`。两个包完成隐私审计、严格签名验证、Apple 公证
`Accepted`、ticket staple、Gatekeeper 与 `hdiutil verify`，维护者在上传前手动验收完整包。

公开资产通过 GitHub 网页上传到独立的 build 2 Release；原 `v0.1.2` 资产保留。GitHub API
报告的大小与服务器端 digest 如下：

- arm64：451,342,321 bytes；`sha256:e7385a3de4b912fadf6154b0ffe682173efa293e4171234ff20566a8c6e30eea`
- x64：464,970,614 bytes；`sha256:02f2dca62d68431db60f355837709d9bc02b0de9522f6254cd6d9e2eb514cc08`
- `SHA256SUMS.txt`：196 bytes；`sha256:8732c524567284f7ccca5d78477eb9d79417e04ca7ea94c00d10e9354f5b58fb`

发布后将三个公开资产重新下载到独立目录；清单校验、逐文件 SHA-256、带 quarantine 的两个
Gatekeeper 评估和两个 DMG 的 `hdiutil verify` 全部通过。公开文档不记录签名身份、证书
指纹、公证提交标识或 Keychain profile。

## v0.2.1 rc.7 正式封包复验

`v0.2.1`（Build `1`）的 arm64 与 x64 Runtime 均从 DeepSeek Harness `0.1.0-rc.7` release-pack
全新构建；两个应用各包含 30 个已验证 Mach-O、唯一包内 Harness，以及固定版本的订阅与预览
插件。两个架构均通过 16 项 ASAR allowlist、个人路径/凭据值审计、严格签名、Apple 公证
`Accepted`、ticket staple、Gatekeeper、`hdiutil verify`、只读挂载、架构、版本与插件清单检查。

本地待发布资产：

- arm64：448,522,849 bytes；`77ac096451d1b0f4a1bd250b1436d0bba15421bfd307c66dcc175bec47ea4003`
- x64：460,537,259 bytes；`f400e321953c4c3e4ac3f84deb503906da53d6eab9f5148d24911c61cff4f8ee`
- `SHA256SUMS.txt`：196 bytes；`397d8c24ea23bb488047800aaeaaf4ed1eefee760857d7ad12ad67fc08098d9f`

GitHub 上传、服务器端 digest 与重新下载核验在 `v0.2.1` Release 创建后补录。

## 人工检查

- [ ] 维护者从全新 GitHub 下载完成标准安装与首次打开
- [ ] 维护者确认核心界面与 Runtime 在 Hardened Runtime 下正常
- [ ] 维护者确认不再需要“仍要打开”或 `xattr` 绕过
- [ ] 维护者确认签名展示的开发者名称符合预期

维护者已完成 build 2 上传前完整软件包验收；以上清单仍保留“从全新 GitHub 下载”的独立
终端用户路径，不用上传前验收代替。

## 残余风险

- x64 最终交互仍需真实 Intel Mac 或维护者接受的 Rosetta 验收边界。

## 结论

- 结果：Implementing；全部技术验收条件通过，等待维护者完成 T-009 安装与交互验收
- 验证人：Codex（代码和基础验证）；Duoasa（后续人工安装/交互）
- 日期：2026-08-16
