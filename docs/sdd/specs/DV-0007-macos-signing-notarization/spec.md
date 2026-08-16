---
id: DV-0007
title: macOS Developer ID signing and notarization
status: Implementing
owner: Duoasa
created: 2026-08-16
updated: 2026-08-16
depends_on: [DV-0003, ADR-0004, ADR-0005]
---

# DV-0007：macOS Developer ID 签名与公证

## 摘要

为 DeepViewer `v0.1.1` 的 Apple Silicon 与 Intel 公共 DMG 建立可复现、最小权限、失败即阻断的 Developer ID 签名与 Apple 公证流水线。只有全新构建、隐私审计、双架构公证、staple 和 Gatekeeper 基础验收全部通过后，才替换 GitHub Release 中的未签名资产。

## 背景与问题

`v0.1.1` 最初作为未签名、未公证的 GitHub Latest Release 发布。带 quarantine 的下载文件会被 Gatekeeper 拒绝，README 中曾使用“仍要打开”和 `xattr` 作为早期测试过渡方案。直接补签历史 DMG 会违反公开发布必须全新构建的安全基线，因此本规格从版本源码和固定依赖重新生成 Runtime、应用与 DMG，并用通过公证的全新资产替换原包。

## 目标

- G-001：让两个 macOS 架构的官方 DMG 通过标准 Gatekeeper 分发路径。
- G-002：建立不在仓库或日志中保存 Apple 凭据的可复现发布流程。
- G-003：在启用 Hardened Runtime 时使用满足 Electron 运行的最小 entitlement 集。
- G-004：替换 Release 资产时继续满足全新构建、隐私净化、校验和及可回滚要求。

## 非目标

- NG-001：不实现 Mac App Store 分发、App Sandbox 或 MAS provisioning profile。
- NG-002：不实现 Windows 代码签名、自动更新或通用二进制。
- NG-003：不把 Apple Developer 会员开通、身份验证或私钥生成自动化；这些账户动作由维护者完成。
- NG-004：不由开发代理执行应用 UI、点击或视觉交互验收；维护者继续负责手动验收。

## 用户与用例

### UC-001：从 GitHub 安装正式 macOS 包

- 参与者：macOS 用户。
- 前置条件：用户从官方 `v0.1.1` Release 下载与 CPU 架构匹配的 DMG。
- 主流程：用户校验 SHA-256、打开 DMG、复制 DeepViewer 到 Applications，并由 Gatekeeper 确认已识别的开发者与 Apple 公证状态。
- 失败/退出流程：签名、公证或完整性任一验证失败时，资产不得进入公开 Release，保留或恢复上一组资产。

### UC-002：维护者执行发布签名

- 参与者：DeepViewer 维护者。
- 前置条件：Keychain 中有有效 Developer ID Application 身份，`notarytool` Keychain profile 可用。
- 主流程：流水线重建两个架构，签名应用与 DMG，提交公证，staple，生成校验清单并验证远端资产。
- 失败/退出流程：缺身份、凭据、Apple 拒绝或任一架构失败时立即停止，不上传部分成功的正式资产，也不输出秘密值。

## 功能需求

- R-001：流水线必须用有效 `Developer ID Application` 身份从内到外签署 Electron 应用、Helpers、Frameworks、内置 Runtime 可执行文件和 DMG。
- R-002：所有可执行签名必须启用 Hardened Runtime 与安全时间戳；Electron/V8 进程只使用 `com.apple.security.cs.allow-jit`，其他可执行文件使用空 entitlement，且任何目标都不得包含 `com.apple.security.get-task-allow=true`。
- R-003：每个架构的已签名 UDZO DMG 必须通过 `notarytool` 提交 Apple，结果为 `Accepted` 后 staple 并验证票据。
- R-004：arm64 与 x64 必须分别从 `v0.1.1` 对应应用源码和固定依赖重新生成 Runtime、allowlist staging、`.app`、DMG 与 SHA-256 清单，继续通过 DV-0003 AC-011 隐私门禁。
- R-005：签名私钥必须只由 Keychain 持有；公证只允许引用 Keychain profile，禁止在仓库、命令参数、日志或 Release 文本中保存 Apple 密码、API 私钥和认证值。
- R-006：只有两个架构全部通过本地验证后才可改变公开 Release；替换前必须保留当前远端资产和 digest 作为回滚输入，替换后必须重新下载并核对 SHA-256。
- R-007：README 与 SDD 发布记录必须在新资产通过后移除“未签名”事实描述，只公开
  “已通过 Apple 公证”、校验值和剩余限制；不得公开签名身份、Team ID、证书指纹、
  公证提交标识、Keychain profile 或系统内部状态字符串。

## 非功能需求

- NFR-001：签名与公证脚本必须非交互、路径安全、架构显式，并在缺少证书或 Keychain profile 时于上传前失败。
- NFR-002：脚本输出不得打印 Keychain 密码、Apple ID 密码、API key 内容、私钥内容或敏感环境变量值。
- NFR-003：发布验收必须包含 `codesign --verify --deep --strict`、entitlement 检查、`hdiutil verify`、`stapler validate` 和 `spctl` 基础策略评估。
- NFR-004：不执行应用 UI 交互自动化；开发代理只做代码、包体、签名、公证和 Gatekeeper 命令级验证。

## 验收条件

- AC-001：Given 两个全新 `.app`，When 检查所有嵌套代码签名，Then authority 为同一 Developer ID Application 团队、签名有效、包含安全时间戳并启用 Hardened Runtime。
- AC-002：Given 最终 `.app`，When 枚举主进程、Helpers 与 Runtime entitlement，Then 只有需要 V8 JIT 的进程包含 `allow-jit`，没有 `get-task-allow`、未签名可执行内存、禁用库校验或无关设备权限。
- AC-003：Given 两个已签名 DMG，When 分别提交公证并 staple，Then Apple 状态为 `Accepted`、公证日志无阻断问题且 `stapler validate` 通过。
- AC-004：Given 从 GitHub 新下载并带 quarantine 的最终 DMG，When 执行 `spctl` 评估和挂载后应用评估，Then arm64 与 x64 均被接受为 Developer ID/notarized 来源。
- AC-005：Given 最终公开资产，When 执行隐私审计、DMG 校验、SHA-256 清单和 GitHub 远端 digest 核对，Then两个架构全部通过且不含个人设置或凭据。
- AC-006：Given 缺失证书、公证 profile 或 Apple 拒绝，When 执行流水线，Then 在公开资产变更前失败，错误只说明缺失项或提交 ID，不显示认证值。
- AC-007：Given Release 资产替换完成，When 检查 README、SDD 与 GitHub Release，Then状态、下载链接、签名/公证事实和 SHA-256 一致。

## 边界与失败行为

- 不接受 ad-hoc、Apple Development、Apple Distribution 或 Developer ID Installer 身份替代 Developer ID Application。
- 任一架构失败时不得把另一架构单独标记为完成；已公证的本地产物可以保留用于诊断，但不能形成部分公开替换。
- Apple 公证超时不等于拒绝；保存 submission ID 后可恢复查询，但在状态明确为 `Accepted` 前不得 staple 或上传。
- GitHub 替换失败时使用替换前下载并校验的原资产回滚，且在 SDD 记录中说明实际公开状态。

## UX 说明

本规格不改变应用内 UI。用户可观察变化是 Gatekeeper 不再显示未签名应用的“已损坏”阻断；维护者继续负责最终安装与打开流程的手动验收。

## 数据、安全与隐私

- 签名证书私钥与公证凭据只存在于维护者 Keychain，不复制到项目目录、临时 staging 或 GitHub。
- 公证会把最终 DMG 上传至 Apple Notary Service；上传内容仅为拟公开的安装资产。
- 公证 JSON、提交标识与日志只保存在被忽略的 `out/notarization/`，不提交进 README、
  Release notes、SDD 或其他公开文件；公开记录只保留是否通过 Apple 公证。
- 发布资产继续执行 DV-0003 AC-011 的个人路径、敏感文件名和当前环境凭据值扫描。

## 依赖

- [ADR-0005](../../architecture/decisions/ADR-0005-developer-id-notarized-macos-dmgs.md)
- [ADR-0004](../../architecture/decisions/ADR-0004-separate-macos-arm64-x64-artifacts.md)
- [DV-0003](../DV-0003-desktop-packaging-spike/spec.md) AC-011
- Apple Developer Program、有效 Developer ID Application 证书、Xcode `notarytool` 与公证权限

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| Hardened Runtime 阻止内置 Node/原生模块 | 应用或 Harness 无法启动 | 从内到外签名所有 Mach-O；只在有证据时增加最小 entitlement；由维护者补充手动启动验收 |
| 本机缺少 Developer ID 身份或公证凭据 | 无法完成 Apple 流程 | 流水线先只读检查并停在明确交接点，不降级为 ad-hoc 签名 |
| Release 资产替换不是原子操作 | 短暂不一致或部分上传 | 替换前保留旧资产；本地双架构全部通过后再执行；远端逐项核验并支持回滚 |
| 公证服务延迟或拒绝 | 发布被延后 | 保存 submission ID 与完整日志，区分超时和拒绝，修复后重新全量验证 |

## 已解决问题

- Q-001：维护者已安装有效 Developer ID Application 证书并创建可用的 `notarytool`
  Keychain profile；双架构签名和公证已于 2026-08-16 完成。

## 审批

- 决策：Approved by direct project instruction；实施中
- 审批人：Duoasa
- 日期：2026-08-16
