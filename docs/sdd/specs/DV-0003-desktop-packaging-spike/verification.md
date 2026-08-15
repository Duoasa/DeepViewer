---
id: DV-0003
title: Electron desktop packaging spike - Verification
status: Implementing
updated: 2026-08-15
---

# DV-0003：验证

## 验证环境

- DeepViewer 提交：工作树实现，尚未提交
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

- 结果：Partial pass。双架构自包含 macOS 封包、真实 Web surface 启动和生命周期纵向路径通过；DV-0003 保持 `Implementing`，等待剩余验收项。
- 验证人：Codex（自动化与本机 GUI 冒烟）
- 日期：2026-08-15
