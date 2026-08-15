---
id: DV-0001
title: SDD documentation foundation - Design
status: Verified
updated: 2026-08-15
---

# DV-0001：设计

## 方案摘要

采用一个独立的 `docs/sdd/` 文档树：长期基线放在 `product/` 和 `architecture/`，单项变更放在 `specs/DV-NNNN-*`，可复用模板放在 `specs/_template/`。根 `AGENTS.md` 和 `README.md` 只负责导航，减少未来引入上游仓库时的冲突面。

## 需求映射

| 需求 | 设计位置 | 说明 |
| --- | --- | --- |
| R-001 | `docs/sdd/README.md`、`product/`、`architecture/` | 提供入口与长期基线 |
| R-002 | `specs/_template/` | 四文件生命周期模板 |
| R-003 | `governance.md` 和各模板 | 定义 R、NFR、AC、T 与证据映射 |
| R-004 | 根 `AGENTS.md` | 编码 Agent 的流程入口 |
| R-005 | 根 `README.md` | 面向贡献者的入口 |

## 信息架构

- `README.md`：最短可执行路径、目录、状态与事实优先级。
- `governance.md`：跨规格稳定规则，避免模板重复说明。
- `product/`：愿景、原则和路线图，不承载单项实施细节。
- `architecture/`：系统方向、约束和已接受决策。
- `specs/`：索引、编号分配、模板和活动规格。

## 状态一致性

一个规格目录内四个文件共享同一状态。状态变化时同时更新四个文件和规格索引。ADR 使用独立状态集，不与功能发布状态混用。

## 兼容与演进

- 文档使用普通 Markdown 和相对链接，不绑定特定站点生成器。
- 元数据使用简单 YAML front matter，后续可以由脚本解析。
- SDD 目录不假设 DeepSeek Harness 的源码放置位置。
- 未来合并上游 `AGENTS.md` 时保留 SDD 入口，并同时遵守上游针对代码区域的更具体规则。

## 验证策略

- 枚举目录，确认模板和首个规格文件齐全。
- 解析 Markdown 相对链接，确认目标存在。
- 搜索稳定 ID 和状态字段，确认追踪规则可发现。
- 运行 `git diff --check`，确认基础文本质量。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 所有内容放一个 `SDD.md` | 初始文件少 | 难以扩展和单独评审 | 拒绝 |
| 每个功能只用一个文件 | 导航简单 | 需求、设计和验证容易混杂 | 拒绝 |
| 使用外部文档平台 | UI 和协作成熟 | 与代码版本分离，Agent 访问不稳定 | 暂不采用 |
| 仓库内四文件规格 | 可追踪、可独立评审 | 文件数量较多 | 采用 |

## 设计决定

- 决策：Approved
- 审批人：Duoasa
- 日期：2026-08-15
