---
id: DV-0008
title: Local development and release-tier workflow
status: Implementing
owner: Duoasa
created: 2026-08-17
updated: 2026-08-17
depends_on: [DV-0003, DV-0007]
---

# DV-0008：本地快速迭代与分级发布工作流

## 摘要

把小功能的日常开发验证、本机打包验收和正式双架构发布拆成三个明确层级。默认工作只修改
代码并运行基础检查；只有维护者明确要求时才生成本机 ARM 预览 `.app` 或进入正式发布
流水线，从而减少重复 Runtime 构建、DMG、签名、公证和上传成本。

## 背景与问题

当前 `desktop:start` 每次都会执行 production build，但正式封包命令还会重建 Runtime、
生成两个架构、创建 DMG，并在发布时执行签名和公证。若每个小 UI 功能都生成正式包，既
延长反馈周期，也会产生无意义的版本、构建和发布开销。维护者已经明确：日常交互验收由其
手动完成，代理默认只负责代码和基础验证。

## 目标

- G-001：小功能保存后可在不封包、不重建 Runtime 的情况下自动重建并重启本地应用。
- G-002：开发应用的数据、Harness home、工作区和日志与正式版隔离。
- G-003：需要验证封包行为时，只生成本机 ARM 开发 `.app`，不生成 DMG 或公开资产。
- G-004：正式双架构签名、公证流程保持显式、完整且不被日常命令隐式触发。
- G-005：同一已批准里程碑内的小改动不重复创建或更新 Markdown，文档在明确边界批量同步。
- G-006：Pull Request 与 `main` 推送自动执行可复现的基础代码验证，不触发封包或外部发布。

## 非目标

- NG-001：不为上游 Harness 页面建立新的前端 HMR 架构。
- NG-002：不自动执行应用点击、视觉或交互验收。
- NG-003：不自动创建版本号、GitHub Release 或上传公开资产。
- NG-004：不改变正式安装包的数据目录、Bundle ID 或安全门禁。
- NG-005：不在 CI 中构建 Runtime、应用包或 DMG，也不读取签名、公证与发布凭据。

## 用户与用例

### UC-001：日常小功能迭代

- 参与者：维护者、开发代理。
- 前置条件：项目依赖和固定 Harness checkout 已准备好。
- 主流程：运行开发命令；源码变化触发 Vite build；构建成功后 Electron 自动重启；维护者
  手动验收。
- 失败/退出流程：构建失败时保留 watcher，输出错误并等待下一次修改；不得触发封包或发布。

### UC-002：本机封包验收

- 参与者：维护者。
- 前置条件：本机 arm64 Runtime 已存在且 manifest 匹配。
- 主流程：显式运行预览命令，生成独立的 `DeepViewer Dev.app` 并打印路径。
- 失败/退出流程：Runtime 缺失或不匹配时明确停止，不回退为正式封包或自动重建双架构。

### UC-003：正式发布

- 参与者：维护者、发布代理。
- 前置条件：维护者明确要求正式发布，签名与公证前置条件可用。
- 主流程：显式运行正式命令，重建双架构 Runtime 和安装资产，完成现有安全门禁。
- 失败/退出流程：任一步失败即停止；上传和 Release 变更仍需要独立的明确发布指令。

### UC-004：持续集成

- 参与者：GitHub Actions。
- 前置条件：Pull Request、`main` 推送或维护者手动触发工作流。
- 主流程：以冻结锁文件安装依赖，执行类型检查、Vitest 和 production build，报告状态检查。
- 失败/退出流程：返回非零状态并阻止该次检查通过；不得提交代码、修改 Release 或生成安装包。

## 功能需求

- R-001：系统必须提供 `desktop:dev`，初次执行 production build 后启动 Electron，并在受控
  源码变化后自动重新构建和重启；不得重建 Runtime、生成 `.app`/DMG、签名、公证或联网发布。
- R-002：系统必须提供 `desktop:dev:restart`，只向当前项目正在运行的开发 runner 请求一次
  受控重建和重启；没有 runner 时必须明确失败且不得杀死其他 Electron 应用。
- R-003：未封包开发模式与 `DeepViewer Dev.app` 必须使用独立 `DeepViewer Dev` userData；
  正式版路径保持不变。
- R-004：系统必须提供 `desktop:preview`，只使用现有 arm64 Runtime 生成独立名称、Bundle ID
  和输出目录的 `.app`；不得生成 DMG、签名、公证或上传。
- R-005：系统必须提供显式 `desktop:release` 入口，复用现有双架构 Runtime、签名与公证
  流水线，但不得自动上传或修改 GitHub Release。
- R-006：默认代理工作只执行代码修改、相关测试、类型检查和 production build；只有用户明确
  使用“本地验收包”“正式发布”或等价指令时，才允许进入对应打包层级。
- R-007：同一已批准规格范围内的日常代码切片不得强制逐项更新 SDD 或 README；只有明确
  文档同步、里程碑验收、正式发布或实质性范围变化才触发批量同步。
- R-008：系统必须提供 GitHub Actions CI，在 Pull Request、`main` 推送和手动触发时使用
  Node.js 24 与 manifest 固定的 pnpm，依次执行冻结锁文件安装、类型检查、测试和 production build。

## 非功能需求

- NFR-001：开发 runner 不增加第三方依赖，并正确回收 Electron、watcher 与本项目控制 socket。
- NFR-002：开发重启控制必须按项目路径隔离，禁止使用 `killall` 或按进程名杀死其他应用。
- NFR-003：预览封包继续使用 allowlist staging、Runtime 链接规范化和隐私审计，但不声称代表
  正式签名发行物。
- NFR-004：开发与预览数据不得进入 Git、正式 staging 或公开安装资产。
- NFR-005：CI 必须使用仓库只读权限，不持久化 checkout 凭据，不读取发布秘密，且不得调用
  runtime、preview、package、release、sign、notarize 或 upload 流程。

## 验收条件

- AC-001：Given 已准备的本地环境，When 运行 `desktop:dev`，Then 只执行 build、watch 和
  Electron 启动，源码变化后自动重启且命令链不包含 runtime/package/sign/notarize/upload。
- AC-002：Given 活跃开发 runner，When 运行 `desktop:dev:restart`，Then 只有当前项目的
  Electron 子进程被重建和重启；runner 不存在时返回非零状态。
- AC-003：Given 开发模式或预览应用，When 初始化 Electron，Then userData 为 appData 下的
  `DeepViewer Dev`，正式模式仍使用 Electron 默认正式路径。
- AC-004：Given 有效 arm64 Runtime，When 运行 `desktop:preview`，Then 只生成
  `DeepViewer Dev.app`，Bundle ID 为开发专用值，不存在该命令生成的新 DMG 或公证操作。
- AC-005：Given 明确正式发布指令，When 运行 `desktop:release`，Then 才会调用双架构 Runtime、
  `--sign` 和公证脚本，且不包含 GitHub 上传命令。
- AC-006：Given 项目规则，When 检查 governance、脚本和 SDD，Then默认不打包规则及三个
  层级可以双向追踪。
- AC-007：Given 同一已批准里程碑，When 进行小功能或缺陷修复，Then 总规范允许只修改代码
  和运行基础验证，并要求在明确同步边界前补齐累计文档。
- AC-008：Given GitHub 上的 Pull Request、`main` 推送或手动触发，When CI 运行，Then 冻结锁
  文件安装、类型检查、52 项测试和三个 Vite production build 全部执行，且工作流不具备写入
  仓库或发布安装包的能力。

## 边界与失败行为

- 开发 build 失败时不启动新 Electron，也不退出 watcher；下一次相关文件变更可恢复。
- watcher 合并短时间内的连续事件，避免一次保存触发多个并发重启。
- 预览 Runtime 不存在时提示先显式构建 arm64 Runtime，不自动扩大为双架构工作。
- 开发 runner 退出时必须终止其 Electron 子进程并移除控制 socket。

## UX 说明

本规格不改变正式应用 UI。开发和预览应用仍显示 DeepViewer 产品 UI，但使用独立数据空间；
维护者继续负责所有视觉和交互验收。

## 数据、安全与隐私

- `DeepViewer Dev` 目录允许保存本机开发会话，但属于非公开本地数据，不进入 Git 或 Release。
- 正式包继续执行 DV-0003 的全新构建和隐私门禁。
- 控制 socket 只承载固定的 restart 指令，不传递设置、凭据、工作区或日志内容。

## 依赖

- [DV-0003](../DV-0003-desktop-packaging-spike/spec.md)
- [DV-0007](../DV-0007-macos-signing-notarization/spec.md)
- Electron 43、Vite 8、Node.js 24

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| 自动重启遗漏新文件类型 | 维护者看到旧代码 | watcher 覆盖 `src/`、Vite 配置、manifest 与 TypeScript 配置，并提供显式 restart |
| 开发数据误用正式路径 | 污染正式设置 | 在 `app.setName` 和 single-instance lock 前显式设置开发 userData |
| 预览命令被误认为正式发行 | 绕过签名与发布门禁 | 使用 `DeepViewer Dev` 名称、开发 Bundle ID、独立输出，并在文档标记仅供本机验收 |
| 正式命令被日常脚本间接调用 | 产生昂贵或外部操作 | 三层命令不互相隐式升级；正式命令只能显式调用 |
| PR 中的不可信代码借 CI 扩大权限 | 仓库或发布资产被修改 | `contents: read`、关闭 checkout 凭据持久化、不注入发布秘密且不运行封包发布命令 |

## 未决问题

- 无。

## 审批

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-17
