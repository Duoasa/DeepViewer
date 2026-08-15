---
id: DV-0003
title: Electron desktop packaging spike - Tasks
status: Implementing
updated: 2026-08-16
---

# DV-0003：实施任务

## 规则

- 每个任务完成时同步在 `verification.md` 写入真实命令或人工证据。
- 第一个代码任务开始时把本规格四个文件状态改为 `Implementing`。
- 技术验证若改变共享进程边界、安全模型或双平台承诺，先把规格退回 `Review`。
- 不在被忽略的 `upstream/deepseek-harness/` 参考 checkout 中保留唯一实现。

## 任务

- [x] T-001 `[R-001, NFR-003]` 建立独立 Electron/Packager 应用骨架、单实例入口、受限 BrowserWindow、preload 和 launch surface，并固定工具版本。
- [x] T-002 `[R-003, NFR-004, AC-010]` 建立 runtime manifest 与构建资源流水线，校验 Harness SHA、Node engine、入口和必需资源，禁止安装产物引用开发机路径。
- [x] T-003 `[R-002, R-008, NFR-002, NFR-006]` 实现 RuntimeManager 状态机、由自有子进程 readiness 触发的 loopback 健康检查、随机端口、有界超时、用户重试和稳定错误码。
- [x] T-004 `[R-005, R-007, AC-004]` 实现 PlatformProcessAdapter 和 macOS 进程树两阶段回收，并用 fake Harness 孙进程 fixture 验证。
- [ ] T-005 `[R-004, R-006, NFR-007, AC-005]` 实现启动/失败/断开 UI、重试、固定日志入口、日志轮转和敏感字段脱敏。
- [ ] T-006 `[NFR-003, AC-007]` 实现 IPC allowlist、origin/导航/新窗口限制，并增加安全配置自动检查。
- [ ] T-007 `[R-009, AC-002, AC-003]` 打包固定 Harness 基线与无密钥 fixture，完成 health、现有 Web surface 和流式会话的集成测试。
- [ ] T-008 `[R-001, R-003, NFR-001, NFR-005, AC-001, AC-008]` 分别生成 macOS arm64 与 x64 产物，检查 Mach-O 架构，并在无全局 Node/pnpm，以及空格/非 ASCII 安装路径下完成可用架构的 clean-environment 冒烟测试。
- [ ] T-009 `[R-005, R-008, AC-004, AC-006]` 验证正常退出、启动超时、Runtime 崩溃、端口冲突、重复实例和强制回收路径。
- [x] T-010 `[R-007, NFR-001, AC-009]` 检查 macOS 专有逻辑只存在于平台/资源边界，记录 Windows 后续规格入口，不实现 Windows 占位适配器。
- [ ] T-011 `[AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-010]` 记录产物大小、启动/退出时间和全部验收证据，更新开发说明并将通过的规格状态改为 `Verified`。
- [x] T-012 `[R-001, NFR-001]` 创建 `v0.0.1` 公开预览版，上传 arm64/x64 DMG 与 SHA-256 清单，补充双语安装、安全限制和 SDD 发布记录。

## 建议实施顺序

```text
T-001 → T-002 → T-003 → T-004
                    ├── T-005 → T-006
                    └── T-007 → T-008 → T-009 → T-010 → T-011
```

## 延后事项

| 项目 | 原因 | 后续规格 |
| --- | --- | --- |
| DeepViewer 品牌、主题与信息架构 | 与打包风险正交；等待项目负责人方案 | DV-0005（计划） |
| macOS 签名、公证与自动更新 | 先稳定资源和生命周期 | 可靠发行规格（待创建） |
| Windows Runtime、UI/功能与安装器 | 当前先完成 macOS 产品路径 | Windows 客户端规格（待创建） |
| 长期上游同步方式 | 需要独立评估 fork/import 策略 | DV-0004（计划） |
| 性能、体积和最低系统版本承诺 | 先收集真实基线 | 可靠发行规格（待创建） |
