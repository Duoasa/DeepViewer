---
id: DV-0016
title: Single-task activity island - Verification
status: Implementing
updated: 2026-08-24
---

# DV-0016：验证

## 验证环境

- 提交：工作区开发版本
- 平台：macOS
- 配置：DeepViewer `0.2.4` Build `1` development，源代码基线 `v0.2.3`，固定 Harness
  `0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- Runtime 验证：不配置 QuotaView/Codex Hook 或额外连接；仅使用 DeepViewer 自带 Harness 连接

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 自动 + 人工 | 自动 Pass / Pending Manual | 单会话状态投影测试通过；岛实际状态切换由维护者确认 |
| AC-002 | 自动 + 人工 | 自动 Pass / Pending Manual | 待确认优先级与不自动隐藏测试通过；交互流程由维护者确认 |
| AC-003 | 自动 | Pass | 协调器 fake-timer 测试覆盖 20 秒缩小、其后 100 秒隐藏及新活动重置 |
| AC-004 | 自动 + 人工 | 自动 Pass / Pending Manual | 设置默认值、归一化、持久化接口与无连接文案契约通过；页面由维护者确认 |
| AC-005 | 静态 + 人工 | 静态 Pass / Pending Manual | 两种 QuotaView 动画、减少动态效果和隐藏停帧契约通过；视觉差异由维护者确认 |
| AC-006 | 自动 | Pass | IPC validator、有限载荷与设置归一化测试通过 |
| AC-007 | 静态 + 人工 | 静态 Pass / Pending Manual | panel 参数、主屏定位与显示变化重定位测试通过；多屏实机移动由维护者确认 |
| AC-008 | 自动 | Pass | rc.2 覆盖同步、类型检查、目标测试、Harness/Web/Desktop 构建及 Runtime 启动冒烟通过 |
| AC-009 | Git / 远端回读 | Pass | 独立分支、源码标签及仅含 GitHub 自动源码归档的 Pre-release 已发布；`main`、`v0.2.3` 未移动，且未上传安装资产 |

## 执行的命令

- `node apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs`
  - 结果：Pass；第二次运行报告 `DeepViewer upstream overrides are current.`
- `./node_modules/.bin/tsc -p apps/deepviewer-desktop/tsconfig.json --noEmit`
  - 结果：Pass
- `../../node_modules/.bin/vitest run test/activity-island.test.ts test/activity-island-window.test.ts test/activity-island-visual-contract.test.ts test/development-workflow.test.ts`
  - 结果：Pass；4 个文件、35 个测试
- `pnpm --filter @deepseek-ai/dsh-client-ui-settings-general exec vitest run tests/apply.client.spec.tsx tests/shell.client.spec.tsx` 以及 `pnpm --filter @deepseek-ai/dsh-client-ui-conversation exec vitest run tests/skeleton.client.spec.tsx`
  - 结果：Pass；合计 3 个文件、32 个测试
- `pnpm --config.enable-global-virtual-store=false run build:official`（Harness，Node `24.18.0`）
  - 结果：Pass；记录 201 个 client artifacts，并保留 rc.2 全局设置与覆盖
- `pnpm --config.enable-global-virtual-store=false run release:pack --family vendor --out dist/deepviewer/vendor` 与 `--family dsh --out dist/deepviewer/dsh`
  - 结果：Pass；生成 9 个 vendor 包与 227 个 dsh 包
- `env ... node scripts/build-runtime.mjs --arch=arm64`
  - 结果：Pass；Runtime manifest 为 DeepViewer `0.2.4`、Harness `0.1.1-rc.2`，两个插件均存在
- `vite build --config vite.main.config.ts`、`vite.preload.config.ts`、`vite.renderer.config.ts`
  - 结果：Pass；主进程、两个 preload、主 Renderer 与 island Renderer 均生成
- `DEEPVIEWER_PROFILE=development electron .`
  - 结果：Pass；日志记录 `SUBSCRIPTIONS_ENABLED`、`PREVIEW_ENABLED`，Harness 从启动到 `runtime ready` 约 2.4 秒；随后主动停止并确认监听端口关闭
- `git ls-remote origin refs/heads/main refs/heads/DV/preview-0.2.4-activity-island refs/tags/v0.2.3 refs/tags/v0.2.3^{} refs/tags/v0.2.4-preview.1 refs/tags/v0.2.4-preview.1^{}`
  - 结果：Pass；远端分支与标签可回读，正式 `main` 和 `v0.2.3` 指针保持不变
- GitHub Pre-release 页面与自动源码归档回读
  - 结果：Pass；Release 标记为 `Pre-release`，ZIP 与 tar.gz 归档均返回 HTTP 200，未附加安装资产

## 人工检查

- [ ] 灵动岛各状态、两种动画及收起节奏的视觉确认（维护者）
- [ ] 设置页布局、控件交互和重启恢复的视觉/交互确认（维护者）
- [ ] 刘海屏、无刘海屏与多屏移动的实机位置确认（维护者）
- [ ] 减少动态效果、键盘与无障碍基础检查（维护者）

## 残余风险

- macOS panel 的实际层级、不同刘海屏位置、多屏移动和动画观感仍需维护者在开发版中人工确认。
- 本轮按维护者要求只执行冒烟与自动契约检查，未进行截图对比或视觉验收。

## 结论

- 结果：Smoke Pass / Visual Pending Manual
- 验证人：Codex / Duoasa
- 日期：2026-08-24
