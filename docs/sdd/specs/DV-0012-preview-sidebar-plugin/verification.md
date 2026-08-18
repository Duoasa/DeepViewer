---
id: DV-0012
title: Code and live web preview sidebar plugin - Verification
status: Implementing
updated: 2026-08-18
---

# DV-0012：验证

## 目标

- DSH：`0.1.0-rc.7`
- 插件：`DVP-0002` / `@deepviewer/dsh-plugin-preview@0.1.0`

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 契约测试 + 人工 | 自动通过；人工待验 | `shell.overlay` 固定开关、24px 控件和 macOS 安全区偏移契约通过；rc.7 客户端构建通过 |
| AC-002 | Host/组件检查 + 人工 | 自动通过；人工待验 | list/read、语言映射、通用 CodeBlock 与全宽标题按钮契约通过 |
| AC-003 | Host 安全测试 | Passed | 越界、symlink、敏感路径和 capability 过期测试通过 |
| AC-004 | 路由/组件检查 + 人工 | 自动通过；人工待验 | opaque-origin 导航桥、站内地址约束、基础浏览器工具栏、系统浏览器显式放行和网页标题栏拖动契约通过 |
| AC-005 | 组件检查 + 人工 | 自动通过；人工待验 | deliverables revision 去抖和手动刷新路径通过类型/构建检查 |
| AC-006 | 集成测试 | Passed | 禁用/缺失/版本不兼容及预览→订阅→核心三级回退通过 |
| AC-007 | 自动检查 + 人工 | 自动通过；人工待验 | 桌面 102 项、typecheck、桌面构建、rc.7 客户端/预览插件/Web 构建通过 |

## 结论

- 结果：自动验证通过；按维护者要求不代做视觉与交互验收，规格保持 Implementing。
- 验证人：Codex（自动）
- 日期：2026-08-18
