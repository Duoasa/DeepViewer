---
id: DV-0006
title: DeepViewer branded loading surfaces - Verification
status: Implementing
updated: 2026-08-16
---

# DV-0006：验证

## 验证环境

- 平台：macOS 26.5.2，Apple Silicon ARM64
- 配置：Electron 43.4.0，DeepViewer ARM64
- 设计：Figma 节点 `8:104`、`8:108`

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | 本地 Figma SVG 的 `Vector_2` 独立使用 steps 光标动效；等待确认视觉节奏 |
| AC-002 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | runtime 注入隐藏 HARNESS/spinner，Logo 静止，文字使用独立 shimmer；等待视觉确认 |
| AC-003 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | 两页使用 `place-items: center`、`min-height: 100vh`，测试禁止 1600/900 固定画布值；等待窗口尺寸确认 |
| AC-004 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | 两种循环动效均有 `prefers-reduced-motion: reduce` 静态分支 |
| AC-005 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | 启动失败面板继续调用既有 `retryRuntime` 与 `openLogDirectory`；等待失败态交互确认 |
| AC-006 | 自动化基础验证 | Pass | typecheck、24 tests、production build、ARM64 package、Mach-O 架构与 DMG CRC 校验通过 |
| AC-007 | 单元测试 + 维护者手动验收 | Pending Manual（代码通过） | 纯函数验证 2000/1500/0ms 剩余时间；WindowController 在 `show` 后等待两次 `requestAnimationFrame` 再开始 2000ms 计时 |
| AC-008 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | runtime `loadURL` 完成后确定性执行包内覆盖脚本；脚本立即 `document.body.append(overlay)`，以 AppFrame、失败文案或 15 秒超时移除 |
| AC-009 | 生产构建检查 + 维护者手动验收 | Pending Manual（代码通过） | Vite 固定 `base: './'`；已从最终 ASAR 提取确认 script/link 均为 `./assets/...`，且包内无 `/assets/...` |

## 基础验证记录

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript | Pass | `pnpm --filter @deepviewer/desktop typecheck` |
| 单元/静态测试 | Pass | `pnpm --filter @deepviewer/desktop test`：5 files、24 tests |
| 生产构建 | Pass | `pnpm --filter @deepviewer/desktop build`；主进程、preload、renderer 全部完成 |
| ARM64 打包 | Pass | `pnpm --filter @deepviewer/desktop package:arm64` |
| 应用架构 | Pass | 主可执行文件为 `Mach-O 64-bit executable arm64` |
| 本地资产 | Pass | ASAR 包含 Figtree 字体；主进程内嵌同源 Logo/字体；包含 `assets/licenses/Figtree-OFL.txt` |
| 应用图标 | Pass | 包内 `electron.icns` 与 `assets/DeepViewer.icns` SHA-256 相同 |
| DMG | Pass | `hdiutil verify`：checksum VALID |
| DMG SHA-256 | Pass | `16a850131b1214cfee5bcb13df164e11faf8578e9f3ad5980eda17c49f9df215` |

## 人工检查

- [ ] 启动等待页只有 Logo 横线闪烁
- [ ] 插件加载页 Logo 静止且文字流光自然
- [ ] 两阶段组合在不同窗口尺寸下始终居中
- [ ] 页面切换不闪回 HARNESS 品牌
- [ ] 减少动态效果下内容稳定可读
- [ ] Runtime 失败时重试和日志仍可使用

## 结论

- 结果：T-007 黑屏根因修正与基础验证通过；Pending Manual，保持 Implementing
- 验证人：Pending
- 日期：2026-08-16
