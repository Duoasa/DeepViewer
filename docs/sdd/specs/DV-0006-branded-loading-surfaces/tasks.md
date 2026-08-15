---
id: DV-0006
title: DeepViewer branded loading surfaces - Tasks
status: Implementing
updated: 2026-08-16
---

# DV-0006：实施任务

- [x] T-001 `[R-001, R-002, R-005, R-006, AC-001, AC-003, AC-005]` 按 Figma 实现响应式居中的 Runtime 启动等待页和光标横线动效。
- [x] T-002 `[R-003, R-004, R-006, AC-002, AC-003]` 在桌面边界实现 Harness 插件加载品牌层、稳定 Logo 和文字流光。
- [x] T-003 `[NFR-001, NFR-002, NFR-003, AC-004]` 打包本地资产，增加 reduced-motion 和安全边界断言。
- [x] T-004 `[NFR-004, AC-006]` 运行类型检查、测试、构建、ARM64 打包与 DMG 基础验证。
- [x] T-006 `[R-007, R-008, AC-007, AC-008]` 修正启动页过快跳过与上游 spinner 未替换回归，改用实际可见计时和独立品牌覆盖层。
- [x] T-007 `[R-008, R-009, AC-008, AC-009]` 修正生产 Renderer 的绝对资源 URL 黑屏，并在 runtime 导航完成后确定性安装插件加载覆盖层。
- [ ] T-005 `[AC-001, AC-002, AC-003, AC-004, AC-005, AC-007, AC-008, AC-009]` 由维护者手动验收视觉、居中、动效和失败状态；`v0.1.1` 已确认正常启动路径，剩余 reduced-motion 与 Runtime 失败态。

## 延后事项

| 项目 | 原因 | 后续规格 |
| --- | --- | --- |
| Windows 原生启动外壳 | 当前桌面路线仍以 macOS 为主 | Windows 客户端规格 |
