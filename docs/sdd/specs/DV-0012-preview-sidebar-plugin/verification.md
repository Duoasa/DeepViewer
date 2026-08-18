---
id: DV-0012
title: Code and live web preview sidebar plugin - Verification
status: Implementing
updated: 2026-08-19
---

# DV-0012：验证

## 目标

- DSH：`0.1.0-rc.7`
- 插件：`DVP-0002` / `@deepviewer/dsh-plugin-preview@0.1.0`

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 契约测试 + 人工 | Pass | `shell.overlay` 固定开关、macOS 安全区、默认三分之一宽度与边框拖动通过；维护者完成入口、宽度和视觉验收 |
| AC-002 | Host/组件检查 + 人工 | Pass | list/read、语言映射、通用 CodeBlock、工作区标题整行折叠和上下区域拖动通过维护者迭代验收 |
| AC-003 | Host 安全测试 | Passed | 越界、symlink、敏感路径和 capability 过期测试通过 |
| AC-004 | 路由/组件检查 + 人工 | Pass | 隔离网页、站内地址约束、基础浏览器工具栏、系统浏览器放行、标题栏拖动及图标适配完成维护者验收 |
| AC-005 | 组件检查 + 人工 | 自动通过；自动刷新人工待验 | deliverables revision 去抖和手动刷新路径通过类型/构建检查；维护者已使用手动刷新 |
| AC-006 | 集成测试 | Passed | 禁用/缺失/版本不兼容及预览→订阅→核心三级回退通过 |
| AC-007 | 自动检查 + 人工 | Pass | 桌面 103 项、typecheck、桌面构建、rc.7 客户端/预览插件/Web 构建及维护者多轮可视交互验收通过 |

## 正式 Runtime 证据

- 0.2.1 arm64/x64 Runtime 均固定 DSH `0.1.0-rc.7`，包含
  `@deepviewer/dsh-plugin-preview@0.1.0`，并且包内只有唯一 `Contents/Resources/harness`。
- 两个架构通过 allowlist staging、隐私审计、签名、公证、票据装订、架构和只读挂载检查。

## 结论

- 结果：自动验证、主要视觉/交互与正式封包通过；DSH 之外的编辑器写入不在承诺内，DSH 产出
  自动刷新仍保留专项人工复验，规格保持 `Implementing`。
- 验证人：Codex（自动与封包）；Duoasa（视觉与交互）
- 日期：2026-08-19
