# DeepViewer SDD

本目录是 DeepViewer 的规格驱动开发（Spec-Driven Development，SDD）事实来源。它把产品意图、架构决策、功能规格、实施任务和验证证据放进同一条可追踪链路。

## 目录

```text
docs/sdd/
├── README.md                    # 入口、状态和工作流
├── governance.md                # 编号、审批、变更和追踪规则
├── product/
│   ├── vision.md                # 产品愿景、用户和边界
│   ├── principles.md            # 产品与工程原则
│   └── roadmap.md               # 阶段性路线图
├── architecture/
│   ├── overview.md              # 当前架构方向与系统边界
│   ├── constraints.md           # 已知约束和待决事项
│   └── decisions/
│       ├── README.md            # ADR 索引和规则
│       └── ADR-0001-*.md         # 持久架构决策
└── specs/
    ├── README.md                # 功能规格索引
    ├── _template/               # 新规格模板
    │   ├── spec.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── verification.md
    └── DV-NNNN-short-name/       # 一个功能或变更单元
        ├── spec.md               # 为什么做、做什么
        ├── design.md             # 怎么做
        ├── tasks.md              # 实施切片
        └── verification.md       # 验收证据
```

## 状态

| 状态 | 含义 | 是否可实施 |
| --- | --- | --- |
| `Draft` | 问题和范围仍在形成 | 否 |
| `Review` | 已可评审，仍可能发生实质变化 | 否 |
| `Approved` | 范围和方案已获维护者认可 | 是 |
| `Implementing` | 正在实施 | 是 |
| `Verified` | 验收条件已有证据 | 已完成 |
| `Released` | 已进入面向用户的版本 | 已发布 |
| `Superseded` | 已被另一个规格替代 | 否 |

正常流转为：`Draft → Review → Approved → Implementing → Verified → Released`。取消或替代规格时改为 `Superseded`，并链接继任规格。

## 新建规格

1. 在 [`specs/README.md`](specs/README.md) 领取下一个 `DV-NNNN` 编号。
2. 复制 `specs/_template/` 为 `specs/DV-NNNN-short-name/`。
3. 先完成 `spec.md`，为需求和验收条件分配稳定 ID。
4. 在 `design.md` 中逐条说明需求如何落地，并记录被否决的主要方案。
5. 规格进入 `Approved` 后，再在 `tasks.md` 中拆分可验证的实施任务。
6. 实施过程中同步勾选任务；范围变化先更新规格，再更新代码。
7. 在 `verification.md` 中为每条验收条件记录命令、人工检查或其他证据。

详细规则见 [`governance.md`](governance.md)。

## 事实来源优先级

1. 已接受的 ADR 定义长期架构决策。
2. 产品基线定义跨功能的目标、原则和边界。
3. 已批准的功能规格定义单项变更的预期行为。
4. 实现和测试证明当前行为；如果与批准规格不一致，必须在同一变更中修正规格或实现。
