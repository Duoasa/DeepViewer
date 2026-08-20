---
id: DV-0014
title: DeepSeek Harness rc.8 core upgrade and DeepViewer 0.2.2 release - Tasks
status: Implementing
updated: 2026-08-20
---

# DV-0014：实施任务

## 规则

- 每项任务引用需求或验收条件；发现 rc.8 新的数据、安全或插件范围先回写规格。
- 正式资产必须全新构建，不得复制、改名或重传 0.2.1 产物。

## 任务

- [x] T-001 `[R-001, R-002, AC-001]` 更新 rc.8 提交/版本门禁、应用 0.2.2 Build 1 与相关测试。
- [x] T-002 `[R-003, NFR-004, AC-002]` 对 DVP-0001/DVP-0002 执行 PC-001—PC-009 并适配 rc.8 契约；PC-009 记录为 `Pending Manual`。
- [x] T-003 `[R-004, AC-003]` 验证默认 JSONL，记录 SQLite schema 17 无迁移与 0.2.1 回滚边界。
- [x] T-004 `[R-005, NFR-003, AC-004]` 全新构建、审计、签名、公证并检查双架构正式包。
- [x] T-005 `[R-006, AC-005]` 更新 README、插件登记、上游基线、发布记录与版本历史。
- [ ] T-006 `[AC-005]` 推送发布分支、通过 CI、合并 main、发布 `v0.2.2` 并远端回读资产。
- [x] T-007 `[AC-001—AC-005]` 在 `verification.md` 记录全部自动与人工状态证据。

## 延后事项

| 项目 | 原因 | 后续规格 |
| --- | --- | --- |
| SQLite schema 16 → 17 迁移 | 上游 pre-release 明确不提供迁移，DeepViewer 默认不启用 SQLite | 若稳定版需要 SQLite，再建立独立迁移规格 |
| PC-009 人工订阅复验 | 需要维护者真实账户与外部服务 | 由维护者在 0.2.2 包上完成 |
