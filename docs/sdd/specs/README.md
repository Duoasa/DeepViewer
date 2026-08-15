# Feature Specifications

## 规格索引

| ID | 标题 | 状态 | 负责人 | 更新时间 |
| --- | --- | --- | --- | --- |
| [DV-0001](DV-0001-sdd-foundation/spec.md) | SDD 文档系统基础 | Verified | Duoasa | 2026-08-15 |

## 下一个编号

`DV-0002`

## 目录规则

- 目录名使用 `DV-NNNN-kebab-case`。
- 一个目录只描述一个可独立审批和验证的变更单元。
- `spec.md`、`design.md`、`tasks.md` 和 `verification.md` 使用相同 ID 和状态。
- 大型功能拆分为多个规格，并在依赖章节互相链接。
- 被替代的目录保留在原位置，状态改为 `Superseded`。

新规格从 [`_template/`](_template/spec.md) 开始，完整流程见上级 [`README.md`](../README.md)。
