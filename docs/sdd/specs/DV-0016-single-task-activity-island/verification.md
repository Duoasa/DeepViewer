---
id: DV-0016
title: Single-task activity island - Verification
status: Implementing
updated: 2026-08-28
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
| AC-005 | 静态 + 人工 | 静态 Pass / Pending Manual | 两种 QuotaView WebGL 动画、减少动态效果和隐藏停帧契约通过；视觉差异由维护者确认 |
| AC-006 | 自动 | Pass | IPC validator、有限载荷与设置归一化测试通过 |
| AC-007 | 自动 + 人工 | 自动 Pass / Pending Manual | 普通 child window 参数、禁止原生 `panel`/always-on-top、主内容锚点坐标与 move/resize/show/restore/focus/blur/hide/minimize 生命周期契约通过；契约同时要求失焦隐藏及禁止对可见岛重复 `showInactive()`，实机应用切换由维护者确认 |
| AC-008 | 自动 | Pass | rc.2 覆盖同步、类型检查、目标测试、Harness/Web/Desktop 构建及 Runtime 启动冒烟通过 |
| AC-009 | Git / 远端回读 | Pass | 独立分支、源码标签及仅含 GitHub 自动源码归档的 Pre-release 已发布；`main`、`v0.2.3` 未移动，且未上传安装资产 |
| AC-010 | 静态 + 人工 | 静态 Pass / Pending Manual | `StatsLine` 文字在 Runtime DOM 内镜像到标题栏宿主，composer 来源隐藏；主内容 safe area 保持原有 `48px`，宿主固定于 `96px`、与“对话 / 轨迹”标签文字行垂直对齐且不贴底部分隔线，并且不订阅 presentation；最终位置由维护者确认 |
| AC-011 | 静态 + 人工 | 静态 Pass / Pending Manual | 契约测试确认 surface 无底色、边框、模糊和阴影，并覆盖浅底深字、深底浅字前景令牌；最终观感由维护者确认 |
| AC-012 | 静态 + 人工 | 静态 Pass / Pending Manual | 设置卡片直接实例化岛的 canonical WebGL renderer，契约测试排除 CSS gradient/手绘预览；视觉由维护者确认 |
| AC-013 | 自动 | Pass | 窗口坐标测试确认展开 `444×152` 到紧凑 `270×72` 后纵向中心保持一致 |

## 执行的命令

- `env CI=true node apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs --build`
  - 结果：Pass；第二次运行报告 `DeepViewer upstream overrides are current.`，并完成 Harness
    host/client、预览插件和 Web 构建。
- `./node_modules/.bin/tsc -p apps/deepviewer-desktop/tsconfig.json --noEmit`
  - 结果：Pass
- `pnpm --filter @deepviewer/desktop typecheck`
  - 结果：Pass；锚点 bridge、validator、普通 child window controller 与 renderer 类型通过
- `pnpm --filter @deepviewer/desktop test`
  - 结果：Pass；18 个文件、125 个测试（RuntimeManager 测试在允许绑定回环端口的环境执行）
- `pnpm --filter @deepviewer/desktop exec vitest run test/activity-island-window.test.ts test/activity-island.test.ts test/activity-island-visual-contract.test.ts test/window-options.test.ts test/development-workflow.test.ts`
  - 结果：Pass；5 个文件、52 个与本轮标题栏集成直接相关的测试
- `../../node_modules/.bin/vitest run test/activity-island.test.ts test/activity-island-window.test.ts test/activity-island-visual-contract.test.ts test/development-workflow.test.ts`
  - 结果：Pass；4 个文件、35 个测试
- `env CI=true pnpm exec vitest run packages/client/ui-settings-general/tests/apply.client.spec.ts packages/client/ui-settings-general/tests/shell.client.spec.ts packages/client/ui-conversation/tests/skeleton.client.spec.tsx`
  - 结果：Pass；合计 3 个文件、32 个测试
- `pnpm --config.enable-global-virtual-store=false run build:official`（Harness，Node `24.18.0`）
  - 结果：Pass；记录 201 个 client artifacts，并保留 rc.2 全局设置与覆盖
- `pnpm --config.enable-global-virtual-store=false run release:pack --family vendor --out dist/deepviewer/vendor` 与 `--family dsh --out dist/deepviewer/dsh`
  - 结果：Pass；生成 9 个 vendor 包与 227 个 dsh 包
- `env ... node scripts/build-runtime.mjs --arch=arm64`
  - 结果：Pass；Runtime manifest 为 DeepViewer `0.2.4`、Harness `0.1.1-rc.2`，两个插件均存在
- `vite build --config vite.main.config.ts`、`vite.preload.config.ts`、`vite.renderer.config.ts`
  - 结果：Pass；主进程、两个 preload、主 Renderer 与 island Renderer 均生成
- `pnpm --filter @deepviewer/desktop build`
  - 结果：Pass；附着窗口、锚点 preload 和透明双色前景 island CSS 均进入生产构建
- `DEEPVIEWER_PROFILE=development electron .`
  - 结果：Pass；开发运行器重建并重启，日志记录 `SUBSCRIPTIONS_ENABLED`、`PREVIEW_ENABLED`，
    Harness 从启动到 `runtime ready` 约 0.9 秒；开发版保持开启供维护者检查
- `git ls-remote origin refs/heads/main refs/heads/DV/preview-0.2.4-activity-island refs/tags/v0.2.3 refs/tags/v0.2.3^{} refs/tags/v0.2.4-preview.1 refs/tags/v0.2.4-preview.1^{}`
  - 结果：Pass；远端分支与标签可回读，正式 `main` 和 `v0.2.3` 指针保持不变
- GitHub Pre-release 页面与自动源码归档回读
  - 结果：Pass；Release 标记为 `Pre-release`，ZIP 与 tar.gz 归档均返回 HTTP 200，未附加安装资产

## 人工检查

- [ ] 灵动岛各状态、两种动画及收起节奏的视觉确认（维护者）
- [ ] 灵动岛在主内容标题栏居中、跟随侧栏/详情栏/窗口移动缩放和主窗口显隐（维护者）
- [ ] 无底色内容层的标题栏融合，以及浅底深字、深底浅字下文字与动画对比度（维护者）
- [ ] token 摘要固定在展开态灵动岛下方的标题栏靠下位置，缩略/隐藏时不上移、不侵入对话区域，
  会话顶栏高度与原版一致，且不同宽度下截断正常（维护者）
- [ ] 设置页两种状态球与岛内实际动画一致（维护者）
- [ ] 展开到紧凑态从中心同步收缩四边（维护者）
- [ ] 设置页布局、控件交互和重启恢复的视觉/交互确认（维护者）
- [ ] 刘海屏、无刘海屏与多屏移动的实机位置确认（维护者）
- [ ] 减少动态效果、键盘与无障碍基础检查（维护者）

## 残余风险

- macOS 普通 child window 的实际层级、标题栏覆盖关系、不同窗口宽度和动画观感仍需维护者在开发版中人工确认。
- 本轮按维护者要求只执行冒烟与自动契约检查，未进行截图对比或视觉验收。

## 结论

- 结果：Smoke Pass / Visual Pending Manual
- 验证人：Codex / Duoasa
- 日期：2026-08-28
