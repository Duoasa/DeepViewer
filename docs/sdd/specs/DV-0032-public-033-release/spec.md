# DV-0032 — 0.3.3 ARM64 公开签名发布

Status: Implementing
Approval: 维护者于 2026-09-23 明确要求将最新 0.3.3 源码推送公开 DeepViewer 仓库，更新双语 README 与插件来源说明，并发布经 Apple 签名、公证的纯净 arm64 DMG。

- R-001: 从当前 0.3.3 Build 75 的确切源码和固定依赖生成可复原的 Harness 快照及全新的 ARM64 Runtime、应用和 DMG；版本号、About、Runtime 与 Release 一致。
- R-002: 公开源码与安装包均不得包含个人会话、工作区、日志、设置、凭据、开发机绝对路径或本地交接文件；签名和公证凭据只从本地 Keychain 读取。
- R-003: 双语 README 概述相对于上一公开版本 0.2.5 的功能变化，以维护者提供且已检查隐私元数据的新版截图说明相应功能，并将图片交付截图用作主产品图；移除过时产品图。标明全部集成插件的原开源项目、许可证、固定版本与 DeepViewer 适配内容，明确已移除的 Taskboard。
- R-004: DMG 经 Developer ID 签名、Apple 公证、票据装订及 Gatekeeper 验证；公开 Release 含安装包与 SHA-256 清单，远端内容与本地一致。
- NFR-001: 不修改现有用户数据、开发版安装或旧公开 Release；发布 0.3.3 的新提交和标签，保持历史可回滚。

## Acceptance

- AC-001: 源码 patch 从官方基线还原为记录的 Git tree，公开源码清单通过个人信息及凭据审计。
- AC-002: 固定版本的构建、相关测试、Runtime 版本与插件检查通过；安装包只含 allowlist 输入且包体隐私审计通过。
- AC-003: ARM64 app/DMG 签名、Apple 公证 Accepted、stapler、DMG 完整性和 Gatekeeper 验证通过。
- AC-004: 双语 README 的版本、配图、插件归属、Release 说明、发布记录、校验清单和 GitHub 公共 main/tag/assets 互相一致；旧产品图不再出现在当前分支资源中。

DV-0031 的旧会话、设置与附件最终界面验收仍为维护者负责的 `Pending Manual`；公开版本须在发布说明中明确该边界，不把包体验证等同于人工验收。
