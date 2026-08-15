# Architecture Decision Records

ADR 记录影响多个功能、难以逆转或会持续影响上游同步的架构选择。

## 状态

- `Proposed`：等待评审
- `Accepted`：当前有效
- `Deprecated`：仍可能存在，但不再推荐
- `Superseded`：被后续 ADR 替代

## 索引

| ADR | 标题 | 状态 | 日期 |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-sdd-as-source-of-truth.md) | 使用仓库内 SDD 作为开发事实来源 | Accepted | 2026-08-15 |

## 模板

```markdown
---
id: ADR-NNNN
title: Decision title
status: Proposed
date: YYYY-MM-DD
supersedes: []
---

# ADR-NNNN：标题

## 背景

## 决策

## 后果

### 正面

### 代价与风险

## 备选方案

## 后续行动
```

接受后的 ADR 不重写历史。新信息通过新 ADR 替代旧决策，并在双方文件中建立链接。
