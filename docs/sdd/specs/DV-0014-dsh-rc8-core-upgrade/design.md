---
id: DV-0014
title: DeepSeek Harness rc.8 core upgrade and DeepViewer 0.2.2 release - Design
status: Implementing
updated: 2026-08-20
---

# DV-0014：设计

## 方案摘要

沿用固定上游 checkout → 受控覆盖同步 → rc.8 release-pack → 插件注入 → 双架构 Runtime →
allowlist staging → 签名、公证与远端验证的现有发布链。升级只替换固定的官方核心版本与兼容
锚点；不改写签名应用内核心，也不引入运行时下载器。默认 base bundle 的 JSONL 持久化保持不变。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, NFR-001 | 固定核心与构建门禁 | 同时校验 tag 对应提交、manifest 版本和唯一 Runtime |
| R-002 | 应用身份 | manifest、About 注入、包体 Info.plist 统一为 0.2.2 Build 1 |
| R-003, NFR-004 | 插件兼容 | 对两个 DVP 执行 PC-001—PC-009 并保留禁用开关 |
| R-004 | 数据边界 | base bundle 继续 JSONL；旧 SQLite schema 失败关闭且不迁移 |
| R-005, NFR-003 | 正式发布链 | 双架构全新构建、签名公证、净化与远端摘要复验 |
| R-006 | 文档与回滚 | README、插件登记、发布记录和 0.2.1 回滚入口同步 |

## 组件与职责

- `build-runtime.mjs` / `package.mjs`：锁定 rc.8 提交与版本，验证 release-pack、插件和包体。
- `sync-upstream-overrides.mjs`：在官方 rc.8 源码上确定性应用受控覆盖并构建 client、插件和 Web。
- `dsh-plugins/preview`：peer 版本更新到 rc.8，业务版本保持 0.1.0。
- `dsh-plugin-subscriptions@0.3.1`：复用宽松 rc peer 范围，继续在 staging 应用本地化用量适配。
- SDD/README：记录存储边界、插件矩阵、安装包与回滚证据。

## 接口与事件

不新增 DeepViewer preload/IPC。插件仍通过 DSH bundle patch、client inject、Connection RPC、
slots 与 settings 扩展点加载。任何 rc.8 API 漂移必须在受控覆盖或第一方插件内部适配，不能
绕过 DSH 公共扩展路径。

## 状态与数据模型

DeepViewer 默认 base bundle 继续注册 `@deepseek-ai/dsh-session-persistence-jsonl`。rc.8 的
SQLite schema 17 是可选后端的新物理格式；上游不提供 schema 16 迁移，DeepViewer 也不创建
第二套迁移事实来源。0.2.1 安装包和 Release 保持不变，作为自定义 SQLite 用户的回滚执行面。

## 主要流程

1. 核对官方 rc.8 标签与提交并生成 vendor/dsh release-pack。
2. 同步 DeepViewer 受控覆盖，编译第一方预览插件和完整 Web。
3. 验证订阅插件 manifest、peer 图、客户端本地化适配、能力和禁用降级。
4. 分架构重新生成 Runtime、staging、应用与 DMG；执行净化、签名、公证及系统检查。
5. 更新 README/SDD，提交发布分支，通过 CI 后合并 main。
6. 从合并提交创建 `v0.2.2`，上传两个 DMG 与校验清单并独立下载回读。

## 权限、安全与隐私

核心、插件和包体仅从固定源码与允许列表输入产生。订阅 OAuth/凭据边界不变；预览 capability
和工作区 containment 不变。构建扫描个人路径、敏感文件名和当前环境凭据值。SQLite 旧格式
只允许失败关闭，避免隐式历史重写或静默丢失。

## 可观察性

启动诊断继续只记录核心/插件版本与启用结果，不记录 token、账户、会话正文或文件内容。
正式发布记录保存命令结果摘要、大小、SHA-256、签名、公证与远端 digest，不保存签名身份和
公证凭据标识。

## 兼容、迁移与回滚

- 默认 JSONL：0.2.1 → 0.2.2 原位兼容，不做格式迁移。
- 自定义 SQLite schema 16：rc.8 明确拒绝；保留数据文件，用户可重装 0.2.1 读取，或明确
  选择新的 schema 17 数据库。
- 插件：版本保持不变；任一插件可通过既有环境开关禁用并退回纯核心。
- 应用：不移动或替换 `v0.2.1` tag/资产；`v0.2.2` 使用独立 tag、Release 和 SHA 清单。

## 测试策略

- 静态：版本/提交、manifest、peer、受控锚点、默认 JSONL、唯一 Harness 和包体 allowlist。
- 自动：桌面单元测试、TypeScript、三段 Vite build、rc.8 client/插件/Web production build。
- Runtime：两个架构启动健康、插件启用/禁用、About 版本、架构和资源树检查。
- 发布：签名、公证、staple、Gatekeeper、DMG verify、挂载、隐私审计、SHA 与远端回读。
- 人工：维护者复验订阅登录、状态/用量、一次模型或工具调用和登出；必要时复验主要预览流程。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 直接替换 rc.7 文件 | 快 | 绕过固定 release-pack、插件与隐私门禁 | 拒绝 |
| 为 SQLite schema 16 自动迁移 | 表面连续 | 上游明确无迁移，历史重写风险高且缺乏权威格式 | 拒绝 |
| 默认继续 JSONL并让自定义 SQLite 失败关闭 | 无数据改写、与上游边界一致、可回滚 | 自定义 SQLite 用户需显式处理 | 采用 |
| 运行时下载 rc.8 | 安装包小 | 破坏签名不可变性、离线与供应链边界 | 拒绝 |

## 设计决定

- 决策：Approved by direct maintainer instruction
- 审批人：Duoasa
- 日期：2026-08-20
