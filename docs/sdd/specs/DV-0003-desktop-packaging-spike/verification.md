---
id: DV-0003
title: Electron desktop packaging spike - Verification
status: Implementing
updated: 2026-08-16
---

# DV-0003：验证

## 验证环境

- 初始封包基线提交：`4b4bae91a1fd75a5247a0ece26a027c8046fbdd7`
- 公开预览：[GitHub Release `v0.0.1`](https://github.com/Duoasa/DeepViewer/releases/tag/v0.0.1) 与 [`v0.1.1`](https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.1)；`v0.1.1` tag 指向 `3ecfb426634619c7464b082ebaa3928a8b7e1db5`
- Harness：`47f943859bef60e4160492346772ded9b24f765a` / `0.1.0-rc.5`
- Electron/Packager：Electron `43.4.0` / Node `24.18.1`；Electron Packager `20.3.0`；pnpm `11.19.0`
- macOS：`26.5.2`，Apple Silicon；arm64 原生，x64 使用 Rosetta。真实 Intel Mac 尚未验证
- 配置：Harness 遥测关闭；GUI 启动使用隔离 `--user-data-dir`，未配置真实模型密钥

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | macOS clean-environment 打包冒烟 | Partial | arm64 原生与 x64 Rosetta 均从 `.app` 双击进入 Web surface；尚未在删除全局 Node/pnpm 的账户验证，x64 尚缺真实 Intel |
| AC-002 | RuntimeManager 集成测试 | Pass | 4 个 Vitest 测试通过；GUI 日志记录 `starting → ready`，只接受自有子进程报告的 `127.0.0.1` 随机端口 |
| AC-003 | 桌面 E2E | Pending | 已加载真实 Web surface；无密钥 fixture 的会话/流式回复尚未执行 |
| AC-004 | 进程树与端口回收测试 | Pass | fake Harness 孙进程回收测试通过；arm64/x64 GUI 退出日志均记录 `stopping → stopped`，PID 随后不存在 |
| AC-005 | 故障注入 + 人工 UI | Partial | 自动测试覆盖启动前退出；实际发现并记录 45/120 秒超时；失败 UI、重试和日志入口尚未完整人工走查 |
| AC-006 | 端口冲突集成测试 | Pass | Harness 使用 `--port 0`，各次 GUI 启动获得不同系统分配端口，无固定候选端口被劫持 |
| AC-007 | 安全配置自动/人工检查 | Partial | 代码固定 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，限制 IPC/导航/新窗口；缺少自动安全配置测试 |
| AC-008 | 特殊路径打包冒烟 | Partial | 仓库与 `.app` 路径包含空格并通过双架构启动；非 ASCII 路径和流式任务尚未验证 |
| AC-009 | 架构与源码检查 | Pass | Darwin 进程行为集中在 `platform/darwin.ts`，资源在 ResourceLocator/打包脚本；未创建 Windows 占位实现 |
| AC-010 | 构建兼容门禁 | Pass | ResourceLocator 检查 Node engine；封包前检查 manifest platform/arch；runtime 构建强制检查 PTY/Koffi Mach-O 和内部符号链接 |
| AC-011 | 双架构全新封包 + 最终包净化审计 + GitHub 远端核验 | Pass | `v0.1.1` 的 Runtime/staging/`.app`/DMG 分架构清理重建；ASAR 仅含 allowlist；两个最终包均通过路径、敏感文件名和环境凭据值扫描；GitHub 完整 DMG digest 与本地 SHA-256 一致 |

## 基线指标

| 指标 | macOS arm64 | macOS x64 | 说明 |
| --- | --- | --- | --- |
| 安装产物大小 | DMG 425 MiB；`.app` 约 1.0 GiB | DMG 432 MiB；`.app` 约 1.0 GiB | 当前包含完整 230 包发布集，后续需要 runtime closure 裁剪 |
| 冷启动到 `ready` | 0.702 秒（1 次） | 31.880 秒（1 次，Rosetta，仅从 RuntimeManager starting 计） | 尚未达到 5 次统计要求；x64 还存在 Rosetta 应用初始化开销 |
| 正常退出耗时 | 0.024 秒（1 次） | 1.444 秒（1 次，Rosetta） | 从 `stopping` 到 `stopped` 日志时间 |
| 强制回收次数 | 0 | 0 | 成功 GUI 冒烟期间 |

## 执行的命令

```sh
# 上游固定基线
pnpm --dir upstream/deepseek-harness install
pnpm --dir upstream/deepseek-harness run build
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh

# DeepViewer 检查与双架构运行时
pnpm install
pnpm --dir apps/deepviewer-desktop runtime:arm64
pnpm --dir apps/deepviewer-desktop runtime:x64
pnpm --dir apps/deepviewer-desktop typecheck
pnpm --dir apps/deepviewer-desktop test
pnpm --dir apps/deepviewer-desktop build

# 最终封包与 DMG 完整性
node apps/deepviewer-desktop/scripts/package.mjs
hdiutil verify out/DeepViewer-0.0.1-macos-arm64.dmg
hdiutil verify out/DeepViewer-0.0.1-macos-x64.dmg
file out/DeepViewer-darwin-arm64/DeepViewer.app/Contents/MacOS/DeepViewer
file out/DeepViewer-darwin-x64/DeepViewer.app/Contents/MacOS/DeepViewer
```

最终结果：2 个测试文件、4 个测试通过；TypeScript 与三个 Vite 构建通过；两个 DMG 的 `hdiutil verify` 均为 `VALID`。

SHA-256：

- arm64：`9c76101b7b7b7cb8bf8cfed30b422927851e674f3092650388d58c8164ef0314`
- x64：`6a24dbb6100edd804fd58167fde8c77326ddb65c09bc4497d5ed58212313681c`

## 公开预览发布证据

- Release：[DeepViewer 0.0.1 — macOS Packaging Preview](https://github.com/Duoasa/DeepViewer/releases/tag/v0.0.1)
- 状态：公开、非草稿、pre-release
- 发布时间：2026-08-16 00:54:53 +08:00
- `DeepViewer-0.0.1-macos-arm64.dmg`：445,185,427 bytes，状态 `uploaded`，GitHub digest 与本地 SHA-256 一致
- `DeepViewer-0.0.1-macos-x64.dmg`：468,506,506 bytes，状态 `uploaded`，GitHub digest 与本地 SHA-256 一致
- `SHA256SUMS.txt`：196 bytes，状态 `uploaded`，GitHub digest 与本地 SHA-256 一致
- 英文 [`README.md`](../../../../README.md) 与简体中文 [`README.zh-CN.md`](../../../../README.zh-CN.md) 已记录安装、架构选择、校验和未签名/未公证限制
- 发布事实、资产 URL 和验证边界见 [`releases/v0.0.1.md`](../../releases/v0.0.1.md)

本次公开预览只证明资产已经上传并可供兼容性测试，不补足 AC-001、AC-003、AC-005、AC-007 与 AC-008 的剩余证据，因此 DV-0003 仍保持 `Implementing`。

## v0.1.1 全新封包与公开发布证据

- Release：[DeepViewer 0.1.1 — macOS UI Preview](https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.1)，公开、非草稿、正式发布并标记为 Latest；tag 指向 `3ecfb426634619c7464b082ebaa3928a8b7e1db5`。
- 构建输入提交 `a1cd702` 与 tag 提交的 Git tree 均为 `68e0dd3e2190b4b347ade99e176bfc5bb57fe5ca`。
- `pnpm typecheck`、6 个测试文件/27 项测试、main/preload/renderer production build 全部通过。
- arm64 与 x64 封包分别清理并重新生成 Runtime、allowlist staging、`.app`、DMG 和校验清单；没有复用 `v0.0.1` 资产。
- `release-audit.mjs` 对两个最终 `.app` 均报告通过：ASAR 共 19 个条目且只有 `.desktop`、`assets`、`package.json` 顶层输入；没有个人设置、工作区、会话、日志、敏感文件名、开发机/主目录绝对路径或当前环境凭据值。
- `DeepViewer-0.1.1-macos-arm64.dmg`：447,398,592 bytes；本地与 GitHub digest 均为 `3eea789d36458272cee469a80167d09badb1abea1723abd88f118da465d406b9`。
- `DeepViewer-0.1.1-macos-x64.dmg`：462,527,510 bytes；本地与 GitHub digest 均为 `f7b70f7fcdf8641f7228a2df42242e444688b8ac3ec1865c27029be9624dd561`。
- `SHA256SUMS.txt`：196 bytes；本地与 GitHub digest 均为 `3354300bcde8ef5434dae3b2aa8bd4c370b71718da50303c5681b40f0a1e1fbc`；`shasum -a 256 -c` 通过。
- 两个 DMG 均通过 `hdiutil verify`；主二进制分别为原生 `arm64` 与 `x86_64`；Bundle 名称为 `DeepViewer`，版本为 `0.1.1`。
- GitHub Release 最终只保留两个完整 DMG 和校验清单，不包含临时上传分片。
- 完整历史记录见 [`releases/v0.1.1.md`](../../releases/v0.1.1.md)。

AC-011 已完成；它是后续所有公开 stable、pre-release 与资产重传必须持续满足的门禁，不会因其他 DV-0003 验收项仍在实施而降级。

## 人工检查

- [x] arm64 与 x64 `.app` 均通过 `open -n` 启动，无需人工执行 Node、pnpm 或 Harness 命令
- [x] arm64 与 x64 产物名称、主程序/PTY/Koffi Mach-O 架构和 runtime manifest 正确
- [ ] 启动、失败、断开、重试和退出状态清晰
- [x] 现有 Web surface 在 arm64 原生与 x64 Rosetta 中加载
- [ ] 现有 Web surface 可完成无密钥流式任务
- [ ] 日志入口已可用且脱敏单元测试通过；仍需真实 UI 打开与凭据样例人工复核
- [ ] 键盘可操作重试和日志入口，状态不只依赖颜色
- [ ] 外部导航、非允许列表 IPC 和非 loopback 访问被拒绝
- [x] 退出后无 Harness 或 fake Harness 孙进程残留
- [x] macOS 专有逻辑边界与 Windows 后续入口已记录

## 残余风险

- 正式签名、公证、自动更新、全部 Windows 适配和长期上游同步不在本规格内，必须由后续规格承接。
- Intel 产物目前只在 Apple Silicon + Rosetta 完成 GUI/Runtime 冒烟；真实 Intel Mac 仍是发行前门禁。
- 完整发布集使 `.app` 约 1.0 GiB；开始正式分发前应按真实运行闭包裁剪。
- 无密钥流式会话、失败/重试 UI、安全自动测试、非 ASCII 路径和无全局开发工具账户仍未完成。

## 结论

- 结果：Partial pass。双架构自包含封包、真实 Web surface 启动和生命周期纵向路径通过；`v0.1.1` 的全新构建与零个人数据/凭据发布门禁（AC-011）已通过并形成公开资产。DV-0003 保持 `Implementing`，等待 AC-001、AC-003、AC-005、AC-007 与 AC-008 的剩余证据。
- 验证人：Codex（自动化与本机 GUI 冒烟）
- 日期：2026-08-16
