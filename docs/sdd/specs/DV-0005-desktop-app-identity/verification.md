---
id: DV-0005
title: DeepViewer desktop app identity - Verification
status: Released
updated: 2026-08-16
---

# DV-0005：验证

## 验收证据

| 验收条件 | 状态 | 证据 |
| --- | --- | --- |
| AC-001 | Pass | 打包后的 ARM64 Harness surface 加载后，macOS AX 窗口标题为 `DeepViewer`；页面的 `DeepSeek Harness` title 不再覆盖原生标题 |
| AC-002 | Pass | 打包应用的 AX 进程名为 `DeepViewer`，菜单栏为 `Apple, DeepViewer, File, Edit, View, Window`；打包态不再以 `app.dock.setIcon` 覆盖 Bundle 图标；Dock 截图 `/tmp/deepviewer-dv0005-macos26-native-dock-crop.png` 中图标与 Messages、Icon Composer 尺寸一致 |
| AC-003 | Pass | macOS 26 源 PNG 为 1024 × 1024、8-bit RGBA，仓库副本 SHA-256 与用户文件同为 `2fed65407833ae1ff677783c3885838a3db9116192ec440ccc8025fecb48323d`；应用内 `electron.icns` 与仓库 ICNS SHA-256 同为 `e70e7aae72a23e71621d8c31bea14db18a21408ae1b811ebdd803e01a6fc8f5b` |
| AC-004 | Pass | `typecheck`、4 个测试文件共 14 项测试和 main/preload/renderer production build 全部通过；DMG `hdiutil verify` 有效 |

## 产物

- ARM64 应用：`out/DeepViewer-darwin-arm64/DeepViewer.app`
- x64 应用：`out/DeepViewer-darwin-x64/DeepViewer.app`
- 公开 DMG：[arm64](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.1/DeepViewer-0.1.1-macos-arm64.dmg) / [x64](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.1/DeepViewer-0.1.1-macos-x64.dmg)
- 二进制：`Mach-O 64-bit executable arm64` / `Mach-O 64-bit executable x86_64`
- 图标源：`apps/deepviewer-desktop/assets/deepviewer-icon-macos26-1024.png`
- 打包图标：`apps/deepviewer-desktop/assets/DeepViewer.icns`

## 发布证据

- `v0.1.1` 的两个架构包均验证 `CFBundleDisplayName=DeepViewer`、`CFBundleShortVersionString=0.1.1`。
- 应用图标、README 产品图和下载入口随 [GitHub Release `v0.1.1`](https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.1) 公开。
- 完整资产大小、SHA-256 与发布隐私审计见 [`releases/v0.1.1.md`](../../releases/v0.1.1.md)。

## 结论

- 结果：Released；AC-001 至 AC-004 全部通过并随 `v0.1.1` 公开发布
- 验证人：Codex
- 日期：2026-08-16
