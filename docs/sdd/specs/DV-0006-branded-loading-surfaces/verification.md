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
| AC-001 | 代码检查 + 维护者手动验收 | Pass | 本地 Figma SVG 的 `Vector_2` 独立使用 steps 光标动效；维护者在最终 ARM64 候选包确认启动页面可见并反馈当前版本初步通过 |
| AC-002 | 代码检查 + 维护者手动验收 | Pass | runtime 覆盖层隐藏 HARNESS/spinner，Logo 静止，文字使用独立 shimmer；维护者在修正黑屏与上游转圈回归后确认最终候选包初步通过 |
| AC-003 | 代码检查 + 维护者手动验收 | Pass | 两页使用 `place-items: center`、`min-height: 100vh`，测试禁止 1600/900 固定画布值；维护者已确认忽略 Figma 画布尺寸的窗口居中方案 |
| AC-004 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | 两种循环动效均有 `prefers-reduced-motion: reduce` 静态分支 |
| AC-005 | 代码检查 + 维护者手动验收 | Pending Manual（代码通过） | 启动失败面板继续调用既有 `retryRuntime` 与 `openLogDirectory`；等待失败态交互确认 |
| AC-006 | 自动化基础验证 | Pass | typecheck、24 tests、production build、ARM64 package、Mach-O 架构与 DMG CRC 校验通过 |
| AC-007 | 单元测试 + 维护者手动验收 | Pass | 纯函数验证 2000/1500/0ms 剩余时间；WindowController 在 `show` 后等待两次 `requestAnimationFrame` 再开始 2000ms 计时；维护者最终候选包可稳定观察启动页 |
| AC-008 | 代码检查 + 维护者手动验收 | Pass | runtime `loadURL` 完成后确定性执行包内覆盖脚本；修正后维护者可见 DeepViewer 插件加载层，不再只看到上游 HARNESS 转圈 |
| AC-009 | 生产构建检查 | Pass | Vite 固定 `base: './'`；从最终 ASAR 提取确认 script/link 均为 `./assets/...`，包内无 `/assets/...`；`v0.1.1` 两个架构包均通过发布审计 |

## 基础验证记录

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript | Pass | `pnpm --filter @deepviewer/desktop typecheck` |
| 单元/静态测试 | Pass | `pnpm --filter @deepviewer/desktop test`：6 files、27 tests |
| 生产构建 | Pass | `pnpm --filter @deepviewer/desktop build`；主进程、preload、renderer 全部完成 |
| ARM64 打包 | Pass | `pnpm --filter @deepviewer/desktop package:arm64` |
| 应用架构 | Pass | 主可执行文件为 `Mach-O 64-bit executable arm64` |
| 本地资产 | Pass | ASAR 包含 Figtree 字体；主进程内嵌同源 Logo/字体；包含 `assets/licenses/Figtree-OFL.txt` |
| 应用图标 | Pass | 包内 `electron.icns` 与 `assets/DeepViewer.icns` SHA-256 相同 |
| DMG | Pass | `hdiutil verify`：checksum VALID |
| ARM64 DMG SHA-256 | Pass | 签名公证刷新包：`1f1a946558ebd3e9b6988b6ce9c8570717e4b7e5a8ec7b43ce51b27ce03dd3bf`；GitHub 远端 digest 一致 |
| x64 DMG SHA-256 | Pass | 签名公证刷新包：`d8cb6983e2bf7d9cef414eca94eabb406f75098dffe863a4f8d9dc27b4331cec`；GitHub 远端 digest 一致 |

## 人工检查

- [x] 启动等待页只有 Logo 横线闪烁
- [x] 插件加载页 Logo 静止且文字流光自然
- [x] 两阶段组合按当前窗口居中，不使用 Figma 固定画布尺寸
- [x] 页面切换不闪回 HARNESS 品牌
- [ ] 减少动态效果下内容稳定可读
- [ ] Runtime 失败时重试和日志仍可使用

## 结论

- 结果：主要正常启动路径已由维护者在 `v0.1.1` 候选包初步验收；AC-004（减少动态效果）与 AC-005（Runtime 失败态）仍为 Pending Manual，保持 Implementing
- 验证人：Duoasa（正常启动路径人工验收）/ Codex（代码与基础验证）
- 日期：2026-08-16
