---
id: DV-0004
title: macOS integrated title bar - Verification
status: Released
updated: 2026-08-16
---

# DV-0004：验证

## 验证环境

- 发布提交：`3ecfb426634619c7464b082ebaa3928a8b7e1db5`
- 平台：macOS 26.5.2，Apple Silicon ARM64
- 配置：Electron 43.4.0，DeepViewer `v0.1.1` ARM64
- 外部依赖：DV-0003 固定 Harness Runtime

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | ARM64 应用截图对照 | Pass | 独立标题文字横条消失；`/tmp/deepviewer-dv0004-codex-final-expanded.png` 与 Codex 参考并排检查通过 |
| AC-002 | macOS AX 原生控件检查与操作 | Pass | Close/Minimize/FullScreen 均为 enabled 原生 `AXButton`；最小化后为 true 并恢复；全屏进入为 true，最终恢复为 false |
| AC-003 | ARM64 真实窗口拖动 + 控件交互 | Pass | 顶部中部真实拖动产生 `48 × 32` 点位移并恢复；工具条为 `drag`，按钮为 `no-drag` |
| AC-004 | 启动 surface → Harness surface 切换 | Pass | 同一 `BrowserWindow` 完成页面切换；`dom-ready` 在每次导航重新安装一致桌面外壳 |
| AC-005 | 窗口选项单元测试 | Pass | 3 个测试文件、10 项测试通过；darwin/非 darwin、全屏事件映射与受限 webPreferences 均有断言 |
| AC-006 | ARM64 侧栏展开 → 整栏收起 → 展开 | Pass | 网格从 `280px 1160px 0px` 切到 `0px 1440px 0px`，再恢复 `280px`；无 56px rail |
| AC-007 | 两种侧栏状态下检查固定切换按钮 | Pass | 固定按钮两态均唯一可见；原侧栏按钮 `display: none`；普通窗口按钮为 `24 × 24`、图标为 `16 × 16`，按钮中心 Y=25 与三枚原生交通灯中心 Y=25 完全对齐；收起态截图为 `/tmp/deepviewer-dv0004-codex-final-collapsed.png` |
| AC-008 | 全宽顶部拖动 + 工具条按钮点击 | Pass | 顶部中部拖动成功；固定按钮委托原 Harness toggle，`aria-expanded` 与标签同步更新 |
| AC-009 | 原生全屏进入/退出 + 按钮位置检查 | Pass | 普通窗口为 `x=88, y=13, 24 × 24`；原生 `enter-full-screen` 后文档全屏态为 true、交通灯隐藏且按钮补位到 `x=16`；`leave-full-screen` 后全屏态为 false 且按钮回到 `x=88`；截图为 `/tmp/deepviewer-dv0004-final-aligned-fullscreen.png` 与 `/tmp/deepviewer-dv0004-final-aligned-windowed-clean.png` |
| AC-010 | 维护者手动检查 ARM64 侧栏展开态布局与点击 | Pass | 维护者在 `v0.1.1` 候选包检查顶部按钮避让后反馈当前版本初步通过；`Session log` 等操作位于 48px 安全区下方 |
| AC-011 | 维护者手动检查 ARM64 侧栏收起态布局与点击 | Pass | 维护者在侧栏完整收起与主栏左上避让修正后反馈当前版本初步通过；主栏内容不再被交通灯或侧栏按钮遮挡 |
| AC-012 | 维护者手动检查 ARM64 原生全屏态布局 | Pass | 维护者已检查全屏按钮补位及内容安全区，并在 `v0.1.1` 候选包反馈当前版本初步通过 |

## 执行的命令

```text
pnpm --dir apps/deepviewer-desktop typecheck
pnpm --dir apps/deepviewer-desktop test
pnpm --dir apps/deepviewer-desktop build
file node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
node /tmp/deepviewer-cdp.mjs <page-websocket> <verification-expression>
swift /tmp/deepviewer-window-qa.swift <pid> inspect
swift /tmp/deepviewer-window-qa.swift <pid> minimize
swift /tmp/deepviewer-window-qa.swift <pid> fullscreen
swift /tmp/deepviewer-window-qa.swift <pid> drag
```

- `typecheck`：通过。
- `test`：3 个测试文件、10 项测试全部通过。
- `build`：main、preload、renderer 三个 Vite production build 通过。
- `file`：Electron 主二进制为 `Mach-O 64-bit executable arm64`。

## 本次顶部安全区增强基础验证

- `typecheck`：通过。
- `test`：4 个测试文件、15 项测试全部通过；新增断言覆盖侧栏、主栏、详情栏、shell overlay 和列拖拽手柄的统一 48px 安全区。
- `build`：main、preload、renderer 三个 production build 通过。
- `package:arm64`：完成，生成 `out/DeepViewer-darwin-arm64/DeepViewer.app` 和 `out/DeepViewer-0.0.1-macos-arm64.dmg`。
- 包体检查：应用主二进制为 `Mach-O 64-bit executable arm64`；最终 DMG 通过 `hdiutil verify`。
- 交互测试：依据 SDD `验证职责`，本阶段基础验证未由开发代理操作应用；维护者随后在 `v0.1.1` 候选包完成验收。

## v0.1.1 发布验证

- 维护者于 2026-08-16 对包含侧栏展开、整栏收起、全屏补位与 48px 全宽安全区的 ARM64 候选包反馈“当前版本初步通过”，据此完成 AC-010 至 AC-012 的人工证据。
- 发布收尾只运行代码与基础检查，没有由开发代理代替维护者重复执行交互验收。
- `pnpm typecheck`、6 个测试文件/27 项测试和 main/preload/renderer production build 通过。
- arm64 与 x64 `v0.1.1` DMG 均通过完整性与发布隐私审计，并已作为 [GitHub Release `v0.1.1`](https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.1) 的完整资产公开。

## 人工检查

- [x] 独立系统标题文字横条消失
- [x] 原生红黄绿按钮位于应用左上区域且无遮挡
- [x] 窗口可以拖动、最小化、缩放和进入/退出全屏
- [x] Harness 常用按钮与输入仍可交互
- [x] 启动页与 Harness surface 使用一致外壳
- [x] 侧栏收起后没有缩略轨道，主内容扩展到窗口左边缘
- [x] 侧栏切换按钮在展开和收起状态都固定于交通灯右侧
- [x] 顶部除按钮区域外均可拖动，按钮点击不触发拖动
- [x] 权限、导航和 IPC 边界未扩大
- [x] 全屏时按钮补位到左侧 16px，退出全屏后恢复到 88px
- [x] 维护者确认侧栏展开时 `Session log` 与其他顶部按钮均位于安全区下方且可点击
- [x] 维护者确认侧栏收起时主栏左上内容不与交通灯或侧栏按钮重叠
- [x] 维护者确认全屏时安全区保留且侧栏按钮补位不遮挡内容

## 残余风险

- 桌面壳通过 Harness 插件样式标签发现 CSS module 当前类名；未来上游重命名样式资源时需要重新运行 DV-0004 验收。
- `v0.1.1` 仍未签名、公证；该分发限制由 DV-0003/后续可靠发行规格负责，不影响本规格窗口行为验收。

## 结论

- 结果：Released；AC-001 至 AC-012 全部通过并随 `v0.1.1` 公开发布
- 验证人：Duoasa（人工交互验收）/ Codex（代码与基础验证）
- 日期：2026-08-16
