---
id: DV-0002
title: DeepSeek Harness foundation and DeepViewer customization direction - Tasks
status: Review
updated: 2026-08-15
---

# DV-0002：评估与后续任务

## 已完成的评估工作

- [x] T-001 `[R-001, AC-001]` 克隆官方 `master` 的浅层参考 checkout，并记录提交 SHA。
- [x] T-002 `[AC-002]` 阅读总体架构、Cordis 组合、Web client、slot、RPC、session projection 和 bundle 配置。
- [x] T-003 `[AC-003, AC-004]` 区分 UI、Host、Agent 和桌面改造面，并比较三种路线。
- [x] T-004 `[AC-005]` 形成分阶段简化方案。

## 产品决定与后续规格

- [x] T-005 `[Q-001]` 确认 macOS 与 Windows 双平台目标，以及 macOS 封包 → UI/功能 → Windows 适配的优先顺序。
- [ ] T-006 `[Q-002, Q-003]` 确认 UI 改造级别和首批三个差异化功能。
- [x] T-007 `[Q-004]` 建立并批准 Electron 桌面框架 ADR-0002。
- [ ] T-008 `[Q-005, NFR-004]` 建立并批准上游同步策略 ADR。
- [x] T-009 `[R-006]` 把桌面打包纵向验证拆分为 DV-0003 实施规格。

## 批准后建议拆分

| 建议规格 | 范围 |
| --- | --- |
| `DV-0003` | Electron 桌面打包纵向验证、进程生命周期与安全模型 |
| `DV-0004` | 上游源码集成与同步策略 |
| `DV-0005` | DeepViewer Web 品牌与主题基线 |
| 后续 | 每个 UI 区域或差异化功能一个独立规格 |

## 实施限制

本规格仍处于 `Review`，因为 UI 范围和上游同步策略尚未决定。桌面工作可在已批准的 DV-0003 范围内开始；上游主线合并和大范围 UI 替换仍需对应批准规格。
