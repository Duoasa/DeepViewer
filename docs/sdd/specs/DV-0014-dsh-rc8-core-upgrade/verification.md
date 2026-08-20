---
id: DV-0014
title: DeepSeek Harness rc.8 core upgrade and DeepViewer 0.2.2 release - Verification
status: Implementing
updated: 2026-08-20
---

# DV-0014：验证

## 验证环境

- 提交：Pending release source commit
- 平台：macOS arm64 构建主机；arm64 与 x64 目标包
- 配置：DeepViewer 0.2.2 Build 1，默认 JSONL persistence
- 外部依赖：DeepSeek Harness `dsh-v0.1.0-rc.8` /
  `141eb6fef83422698aef7a981029e843e8161534`
- DSH 插件：DVP-0001 `dsh-plugin-subscriptions@0.3.1`、DVP-0002
  `@deepviewer/dsh-plugin-preview@0.1.0`

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 自动 | Pass | 官方 rc.8 checkout/commit 门禁、host/client、预览插件、Web、`build:official`、release-pack、105 项测试、TypeScript 和桌面 build 通过 |
| AC-002 | 自动 + 人工 | Pass with Pending Manual | 两个 Active 插件 PC-001—PC-008 通过；DVP-0001 PC-009 真实账户完整流程待维护者 |
| AC-003 | 静态 + 集成 | Pass | 最终 rc.8 base bundle 依赖 JSONL persistence；SQLite schema 17 无迁移、失败关闭和 0.2.1 回滚边界已记录 |
| AC-004 | 自动 + 系统工具 | Pass | 0.2.2 Build 1 arm64/x64 正式包通过隐私、架构、严格签名、Apple 公证、staple、Gatekeeper、DMG 与只读挂载复验 |
| AC-005 | GitHub + 回读 | In Progress | README/SDD 与本地资产摘要已一致；main、tag、Release 和远端 digest 待发布 |

## 插件兼容矩阵

| 检查 | DVP-0001 订阅 | DVP-0002 预览 | 证据摘要 |
| --- | --- | --- | --- |
| PC-001 | Pass | Pass | 固定来源/版本/许可、冻结安装、vendor/dsh release-pack 与双架构包体可用 |
| PC-002 | Pass | Pass | 订阅的 rc.5 caret peer 覆盖 rc.8；预览的九个 DeepSeek peer 精确锁定 rc.8，最终 Runtime 无残留预览 rc.7 peer |
| PC-003 | Pass | Pass | bundle patch、manifest、Node 入口、加载顺序、启动图与 Runtime manifest 检查通过 |
| PC-004 | Pass | Pass | rc.8 host/client 先行构建、隔离预览 manifest、两个编译 client 与完整 Web production build 通过 |
| PC-005 | Pass / Pending Manual | Pass | capability 注册、本地化用量适配、预览 RPC/产出链路自动通过；订阅真实调用归入 PC-009 |
| PC-006 | Pass | Pass | OAuth/回环状态、原子 `0600` 凭据边界、日志脱敏、工作区 containment/capability/CSP 测试通过 |
| PC-007 | Pass | Pass | 既有 `DEEPVIEWER_DISABLE_SUBSCRIPTIONS` / `DEEPVIEWER_DISABLE_PREVIEW` 禁用与纯核心降级检查通过 |
| PC-008 | Pass | Pass | arm64/x64 Runtime 各含两个固定插件、编译 client、许可与相同 manifest；不运行时修改已签名核心 |
| PC-009 | Pending Manual | N/A | 需维护者在 0.2.2 使用真实账户复验登录、状态/用量、一次实际调用和登出 |

## 执行的命令

- `pnpm install --frozen-lockfile`，以及上游 frozen install：Pass。
- `node apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs --build`：rc.8 host/client、
  预览插件与 Web build Pass。
- 上游 `pnpm run build`、`pnpm run build:official`，vendor 9 个与 dsh 226 个 release tarball：Pass。
- `pnpm test`：14 个文件、105/105 Pass；`pnpm typecheck`、`pnpm desktop:build`：Pass。
- `pnpm desktop:release` 生成双架构 rc.8 Runtime；随后显式选择已验证 Developer ID
  完成应用/DMG 签名，再以 Keychain profile 完成 Apple 公证：Pass。
- 包体脚本和公证脚本自动执行 allowlist/凭据审计、34 个 Mach-O 签名检查、
  `stapler`、Gatekeeper 与 `hdiutil verify`：两个架构全部 Pass。
- 将两个最终 DMG 只读挂载后，再次执行嵌套 `codesign --verify --deep --strict`、
  Gatekeeper、Info.plist 与 Runtime manifest 回读：Pass。
- `shasum -a 256` 及 `shasum -a 256 -c out/SHA256SUMS.txt`：两个 DMG Pass。

## 人工检查

- [ ] 订阅登录、状态/用量、一次实际调用和登出
- [ ] 代码与静态网页预览主要流程
- [ ] 0.2.2 应用启动与 About 版本
- [ ] 自定义 SQLite 兼容提示/回滚说明可理解性

## 残余风险

- PC-009 依赖维护者真实账户；未完成时规格保持 Implementing。
- 上游 SQLite schema 17 不兼容旧 schema，DeepViewer 默认 JSONL 且不执行自动迁移。

## 结论

- 结果：Automated Pass / Pending Manual / Pending GitHub publish
- 验证人：Codex（自动验证）/ Duoasa（人工验证）
- 日期：2026-08-20
