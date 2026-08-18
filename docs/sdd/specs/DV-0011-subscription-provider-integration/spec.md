---
id: DV-0011
title: Subscription provider plugin integration
status: Implementing
owner: Duoasa
created: 2026-08-18
updated: 2026-08-19
depends_on: [DV-0003, DV-0007, DV-0008, DV-0010, ADR-0006]
---

# DV-0011：订阅模型提供方插件集成

## 摘要

把 `dsh-plugin-subscriptions` 作为固定版本的 DSH 扩展接入 DeepViewer，使用户可在
全局设置中以中英文界面连接受支持的订阅账户，并让对应模型与工具进入现有 DSH 工作流。
DeepViewer 负责可复现封装、兼容预检、安全边界和无插件降级，不复制上游插件主体。

## 目标

- G-001：在 DeepSeek Harness rc.7 上启用订阅提供方和本地化设置界面。
- G-002：开发与桌面 Runtime 使用同一精确插件版本和官方扩展契约。
- G-003：第三方插件不可用时保留核心功能，并为维护者提供安全诊断。

## 非目标

- NG-001：不修改 DSH agent loop，不重写订阅服务协议。
- NG-002：本次不提供插件在线下载、自动更新、降级或多版本切换。
- NG-003：不提供插件在线下载、运行时更新或对已签名 Runtime 的原地修改。
- NG-004：不把 `v0.2.1` 的临时凭据存储批准扩展为稳定版长期安全承诺。

## 功能需求

- R-001：桌面依赖必须固定 `dsh-plugin-subscriptions@0.3.1`，锁文件保留来源完整性，Runtime
  清单记录插件名称与版本。
- R-002：系统必须通过插件声明的 bundle patch 和 Web client manifest 激活插件，并拒绝名称、
  版本或必需入口不匹配的包。
- R-003：插件设置必须整合进现有“模型”页面：页面大标题和侧栏入口仍为“模型”，首个板块标题
  为“API”，订阅作为第二板块置于通用分割线之后且不再占用独立菜单；界面继续沿用 DSH 的
  中英文文案、主题 token、键盘焦点与外部浏览器 OAuth 流程。
- R-004：登录成功的订阅提供方必须通过现有 DSH provider/model/tool 注册路径工作，不新增
  DeepViewer 专用模型协议。
- R-005：开发态凭据只能位于隔离的 DeepViewer DSH home，沿用插件的原子写入与 owner-only
  文件权限；不得进入 Renderer、preload/IPC、日志、Git 或构建产物。
- R-006：公开分发必须完成凭据存储安全复核，并提供 macOS Keychain 适配或获批的等价方案；
  `v0.2.1` 预览版明确批准隔离 DSH home 与原子 `0600` 文件作为临时等价方案，稳定版前重审。
- R-007：插件被禁用、缺失、版本不符或预检失败时，系统必须跳过插件并继续启动内置核心，
  输出不含令牌和用户数据的稳定诊断。
- R-008：开发与封包加载均不得在运行时修改 `Contents/Resources/harness` 或联网更新插件。
- R-009：订阅用量必须显示剩余百分比并以剩余量填充进度条；余量 `>= 50%` 使用成功色，
  `20%..49%` 使用警告色，`< 20%` 使用错误色，同时显示对应文字提示。无法确认实际时长的
  session 用量必须标记为“周期窗口”，不得固定写成“5 小时窗口”。

## 非功能需求

- NFR-001：固定 DeepSeek Harness `0.1.0-rc.7`；插件集成不得扩大 DeepViewer preload/IPC。
- NFR-002：上游插件主体保持原许可证与来源；DeepViewer 只维护边界适配和必要的构建净化。
- NFR-003：启动日志不得包含 OAuth code、access/refresh token 或账户标识。

## 验收条件

- AC-001：Given 已安装依赖，When 解析开发启动，Then 精确版本插件通过预检并以官方 patch
  加载；设置 client 可被 DSH 发现。
- AC-002：Given 中文或英文主题环境，When 打开“模型”设置，Then 页面依次显示“API”和
  “订阅”板块并以通用分割线分隔，侧栏没有独立订阅入口；内容可读、可操作且与应用主题一致，
  OAuth 外链由系统浏览器处理。
- AC-003：Given 完成登录，When 打开模型选择与相关工具，Then 已连接提供方按插件声明出现；
  退出登录后凭据和可用状态被清除。
- AC-004：Given 禁用开关、缺失包或不兼容版本，When 启动应用，Then 核心仍可就绪并记录稳定、
  无敏感信息的降级诊断。
- AC-005：Given 构建桌面 Runtime，When 检查清单与 staging，Then 插件版本确定、第三方开发
  路径被净化，且没有运行时下载或已签名资源修改路径。
- AC-006：Given 本次代码变更，When 运行相关测试、类型检查和 production build，Then 全部
  自动检查通过；交互、OAuth 与外部服务兼容性由维护者人工验收。
- AC-007：Given 插件返回 `usedPercent`，When 渲染订阅用量，Then 文字与填充宽度均为
  `100 - usedPercent`，颜色和余量级别遵循 R-009，session 文案为本地化“周期窗口”。

## 边界与失败行为

- OAuth 提供方拒绝、限流或协议变化由插件显示失败状态，不允许使 DeepViewer Renderer 获得令牌。
- 用户可用 `DEEPVIEWER_DISABLE_SUBSCRIPTIONS=1` 临时停用插件；该变量不传给插件子进程。
- 插件更新必须显式修改版本、锁文件和兼容证据，不接受浮动版本。

## 数据、安全与隐私

外部服务会按插件流程接收 OAuth 授权与模型请求。DeepViewer 不读取凭据内容，只限定存储目录、
加载边界与日志策略。用户凭据文件不得进入 Runtime；公开分发适用 R-006 门禁。

## 依赖

- [ADR-0006](../../architecture/decisions/ADR-0006-version-pinned-dsh-plugin-integration.md)
- [DSH 插件登记 `DVP-0001`](../../integrations/dsh-plugins.md)
- DeepSeek Harness `0.1.0-rc.7`
- `dsh-plugin-subscriptions@0.3.1`（MIT）

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| 外部服务私有协议变化 | 单一提供方登录或请求失败 | 固定版本、人工冒烟、独立禁用，不影响核心 |
| 明文长期令牌 | 本机账户风险 | 隔离目录与 `0600`；0.2.1 临时批准，稳定版前执行 Keychain 迁移或重审 R-006 |
| 插件与 rc.7 契约漂移 | 启动或设置失败 | manifest 预检、自动契约测试、无插件降级 |

## 审批

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-18
