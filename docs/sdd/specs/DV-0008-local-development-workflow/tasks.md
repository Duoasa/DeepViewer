---
id: DV-0008
title: Local development and release-tier workflow - Tasks
status: Implementing
updated: 2026-08-17
---

# DV-0008：实施任务

## 规则

- 默认只进入开发层；预览或正式层必须来自维护者明确指令。
- 代理只做代码和基础验证，实际应用交互继续由维护者手动验收。
- 不修改或提交工作区中用户已有的未跟踪文件。

## 任务

- [x] T-001 `[R-001, R-002, NFR-001, NFR-002]` 实现项目隔离的开发 runner、文件监控和 restart 控制。
- [x] T-002 `[R-003, AC-003]` 实现未封包与预览应用的独立 userData profile 并增加单元测试。
- [x] T-003 `[R-004, NFR-003, AC-004]` 实现只生成 arm64 `DeepViewer Dev.app` 的预览模式。
- [x] T-004 `[R-005, AC-005]` 增加显式正式发布入口，确认不包含 GitHub 上传。
- [x] T-005 `[R-006, R-007, AC-006, AC-007]` 更新 governance、package aliases、文档批处理规则和开发文档。
- [x] T-006 `[AC-001..AC-007]` 运行基础验证并记录证据；交互项保留维护者人工验收。
- [x] T-007 `[R-008, NFR-005, AC-008]` 增加只读 GitHub Actions CI，执行冻结安装、类型检查、
  测试和 production build，并同步 README 与验证证据。

## 延后事项

| 项目 | 原因 | 后续规格 |
| --- | --- | --- |
| Renderer HMR | 当前 UI 主要由主进程注入，快速 build + restart 已满足反馈目标 | 出现大型本地 Renderer 后再评估 |
| 自动上传 Release | 公开外部变更必须继续独立授权 | 发布自动化规格 |
