---
id: DV-0007
title: macOS Developer ID signing and notarization - Design
status: Implementing
updated: 2026-08-16
---

# DV-0007：设计

## 方案摘要

扩展现有 `package.mjs`，通过显式 `--sign` 模式调用 Electron Packager 集成的 `@electron/osx-sign`。签名模式先解析 Keychain 中唯一或显式指定的 Developer ID Application 身份，对 `.app` 内全部代码启用 Hardened Runtime 与时间戳，再创建并签署 UDZO DMG。独立 `notarize.mjs` 只接受 Keychain profile，提交最终 DMG、保存结果与日志、staple 并运行基础策略验收。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, R-002 | 签名边界与 entitlement | osx-sign 从内到外签名；自定义最小 entitlement |
| R-003 | 公证与 staple | notarytool 提交外层 DMG，Accepted 后 staple |
| R-004, R-006 | 全新构建与发布事务 | 复用 AC-011 清理/审计，双架构全过后替换 |
| R-005, NFR-002 | 凭据边界 | 私钥与公证认证只从 Keychain 读取 |
| R-007, AC-007 | 证据与文档 | 远端核验后更新 README、Release 与 SDD |
| NFR-001, NFR-003 | 失败门禁与验证 | 明确前置检查和 codesign/stapler/spctl 命令 |

## 组件与职责

### `scripts/macos-signing.mjs`

- 解析 `security find-identity` 输出，只接受 Developer ID Application。
- 提供 Electron Packager 的 `osxSign` 配置和最小 entitlement 选择器。
- 对 DMG 使用同一身份、独立 identifier 与安全时间戳签名。
- 验证应用/DMG 签名和禁止的 entitlement。

### `scripts/package.mjs`

- 保持未签名开发封包兼容；只有显式 `--sign` 才访问 Keychain。
- 在每个架构继续清理 staging、应用输出与 DMG并执行隐私审计。
- 签名应用后创建 DMG，再签名与验证 DMG；任一步失败则不生成可上传完成标记。

### `scripts/notarize.mjs`

- 要求 `DEEPVIEWER_NOTARY_PROFILE` 或显式 `--keychain-profile=<name>`，不接受明文密码参数。
- 对每个架构先调用 `xcrun notarytool submit --output-format json` 并立即保存 submission ID，再用 `notarytool wait --timeout 2h` 等待结果；超时后仍可按 ID 恢复查询。
- 保存 submission JSON 与 `notarytool log` 至 `out/notarization/v0.1.1/`。
- 仅在 `Accepted` 后调用 `stapler staple`、`stapler validate`、`hdiutil verify` 与 `spctl`。

## 接口与事件

```text
node scripts/package.mjs --sign [--arch=arm64|x64]
node scripts/notarize.mjs [--arch=arm64|x64] [--keychain-profile=<keychain item>]
```

可选环境：

- `DEEPVIEWER_CODESIGN_IDENTITY`：完整 Developer ID Application common name；未提供时必须恰好发现一个有效身份。
- `DEEPVIEWER_CODESIGN_KEYCHAIN`：非默认 Keychain 路径。
- `DEEPVIEWER_NOTARY_PROFILE`：由 `notarytool store-credentials` 创建的 Keychain item 名称。

这些值只有身份/profile 名称，不是密码；脚本仍不得打印任何 Keychain 内容。

## 状态与数据模型

```text
clean build → app signed → app verified → privacy audit
            → DMG created → DMG signed → local verified
            → submitted → Accepted → stapled → policy verified
            → both architectures ready → Release replacement → remote verified
```

每个公证结果记录 `arch`、DMG 文件名、submission ID、状态和日志路径。任何状态都不持久化认证值。

## 主要流程

### 成功

1. 验证证书、Xcode 工具与 Keychain profile。
2. 为 arm64/x64 分别清理并重建 Runtime、Renderer 和 `.app`。
3. 从内到外签名应用，验证 Hardened Runtime、时间戳与 entitlement。
4. 执行隐私审计，创建并签名 DMG。
5. 双架构分别提交公证；Accepted 后 staple 并验证。
6. 生成新 SHA-256 清单；两个架构全部就绪后备份并替换 GitHub 资产。
7. 从 GitHub 重新下载，附加 quarantine，执行 digest 与 `spctl` 基础验收。
8. 更新 README、Release notes 与 SDD 证据。

### 缺少证书或凭据

在构建或 Apple 上传前报告缺少的身份/profile 名称要求并退出。禁止自动创建自签名证书、ad-hoc 降级或要求把密码写入仓库环境文件。

### Apple 拒绝或超时

保存 submission ID；下载公证日志。`Invalid` 视为失败；超时保留为可恢复状态，后续使用相同 profile 查询，不替换 Release。

## 权限、安全与隐私

- `codesign` 只从指定/默认 Keychain 使用私钥；脚本不导出 `.p12`。
- `notarytool` 只使用 Keychain profile；不实现 `--apple-id`/`--password` 明文路径。
- entitlement allowlist 为 `com.apple.security.cs.allow-jit`；普通 Runtime 二进制使用空 plist。
- `get-task-allow`、`allow-unsigned-executable-memory`、`disable-library-validation`、DYLD 环境变量和无关设备/个人信息权限均为发布阻断项。
- 公证上传的 DMG 已先通过隐私审计，且正是拟公开文件。

## 可观察性

- 输出架构、阶段、公开签名身份名称、submission ID 和 Apple 状态。
- 公证原始 JSON/日志写入被忽略的 `out/notarization/`；终端不输出认证值。
- SDD 只记录可公开证据，不记录 Apple ID 邮箱、Keychain 内容或本地个人路径。

## 兼容、迁移与回滚

- 应用版本和数据格式保持 `0.1.1`，用户无需迁移。
- `--sign` 是新增的发布模式，现有未签名本地开发封包仍可用。
- 替换 GitHub 资产前下载并验证当前三个资产作为回滚副本；新资产远端核验失败时恢复旧资产。
- 不移动公开 `v0.1.1` tag；发布记录分别保存应用源码提交和签名流水线提交。

## 测试策略

- 单元/静态：身份解析、签名模式门禁、entitlement allowlist、公证参数不支持明文凭据。
- 构建：现有 typecheck、Vitest、production build、双架构 Runtime 与隐私审计。
- 签名：codesign 深度严格验证、authority/team/timestamp/runtime 与 entitlement 枚举。
- 公证：notarytool Accepted、日志检查、stapler validate。
- 分发：hdiutil、SHA-256、远端 digest、quarantine 后 spctl。
- 人工：安装、首次打开和核心交互由维护者执行，本规格不由开发代理替代。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| Packager + osx-sign，DMG 显式 notarytool | 贴合现有构建，可控制外层 DMG/staple | 需要维护少量发布脚本 | 采用 |
| Packager 自动公证 `.app` | 配置较少 | 最终分发物是 DMG，仍需外层签名、公证和 staple | 拒绝 |
| electron-builder/Forge 迁移 | 生态集成完整 | 为单一发布能力更换现有封包体系，扩大风险 | 延后评估 |
| 手工 codesign `--deep` | 命令少 | `--deep` 签名不透明、entitlement 难以精确控制 | 拒绝 |

## 设计决定

- 决策：Approved by direct project instruction；实施中
- 审批人：Duoasa
- 日期：2026-08-16
