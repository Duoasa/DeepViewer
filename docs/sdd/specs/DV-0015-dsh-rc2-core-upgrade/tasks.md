---
id: DV-0015
title: DeepSeek Harness 0.1.1-rc.2 core upgrade and DeepViewer 0.2.3 - Tasks
status: Implementing
updated: 2026-08-23
---

# DV-0015：实施任务

## 规则

- 每项任务引用需求或验收条件；插件或安全范围变化先更新规格。
- 签名候选包必须全新生成，不复用旧 Runtime、staging、应用或 DMG；只有两个候选包完成公证、
  装订和最终回读后才能作为公开资产上传。

## 任务

- [x] T-001 `[R-001, R-002, AC-004]` 更新 rc.2 提交/版本门禁、0.2.3 Build 1 身份和相关测试。
- [x] T-002 `[R-003, R-004, AC-001—AC-003]` 更新预览插件 rc.2 peer 并完成 host/client/Web 构建适配。
- [x] T-003 `[R-003, R-005, AC-002—AC-003]` 为订阅 0.3.1 staging 副本声明 rc.2 兼容并验证 UI adapter、能力和降级。
- [x] T-004 `[R-006, AC-001, AC-004]` 适配受控覆盖锚点并运行桌面测试、类型与 production build。
- [x] T-005 `[R-007, AC-005]` 启动本地 DeepViewer Dev 并记录维护者人工检查项。
- [x] T-006 `[AC-001—AC-005]` 在 `verification.md` 记录自动证据与 Pending Manual 状态。
- [x] T-007 `[R-008, AC-006]` 修复 rc.2 侧栏品牌槽位，拆分 DeepViewer SVG mark 与文本 name，
  补充本地 profile 组合回归并重启开发版供维护者确认。
- [x] T-008 `[R-010, AC-008]` 同步双语 README、SDD 规格、插件登记和候选版本记录。
- [x] T-009 `[R-009, NFR-005, AC-007]` 全新生成并验证 arm64/x64 Runtime、应用和 Developer ID
  签名 DMG，记录大小与 SHA-256。
- [x] T-010 `[R-010, AC-008]` 完成发布分支提交与推送，快进合并到远端 `main` 并回读远端状态。
- [x] T-011 `[R-011, AC-009]` 保存维护者提供的原始 0.2.3 产品图，更新双语 README 顶图、
  下载入口、当前版本说明与最终校验值。
- [x] T-012 `[R-011, NFR-005, AC-009]` 使用 Keychain profile 公证并装订 arm64/x64 DMG，
  完成 Gatekeeper、磁盘镜像和只读挂载应用回读，生成 `SHA256SUMS.txt`。
- [x] T-013 `[R-011, AC-009]` 推送发布源码与 `v0.2.3` tag，创建 Latest GitHub Release，上传并
  回读三个资产，确认发布提交 CI 后补齐最终发布记录。

## 延后事项

| 项目 | 原因 | 后续规格 |
| --- | --- | --- |
| Runtime 包体积优化 | 与核心兼容升级的验收和风险边界不同 | 独立 Runtime footprint 规格 |
