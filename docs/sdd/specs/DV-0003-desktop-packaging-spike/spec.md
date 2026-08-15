---
id: DV-0003
title: Electron desktop packaging spike
status: Implementing
owner: Duoasa
created: 2026-08-15
updated: 2026-08-16
depends_on: [DV-0001]
---

# DV-0003：Electron 桌面打包纵向验证

## 摘要

建立 DeepViewer 的最小 Electron 桌面纵向切片。应用分别在 macOS Apple Silicon（arm64）和 Intel（x64）上形成独立产物，可双击启动并自行启动安装包内的 DeepSeek Harness、等待其就绪和加载现有 Web surface；退出时完整回收 Harness 及其子进程。macOS 封包路径通过后直接进入 UI 与功能改造，Windows 适配由后续独立规格处理。

## 背景与问题

当前 Harness 依赖 Node、pnpm 命令和浏览器中的 Web UI。若在 UI 与功能改造完成后才验证桌面打包，Node 版本、ASAR 资源、工作目录、子进程、端口和签名布局可能迫使架构返工。本规格先验证桌面产品最核心、风险最高的纵向路径，不把正式发布能力和 UI 重设计混入同一阶段。

本规格以 DV-0002 记录的上游提交 `47f943859bef60e4160492346772ded9b24f765a`（`0.1.0-rc.5`）为验证基线。长期上游同步策略由后续规格决定，不能在本规格中通过散布式复制源码形成事实上的无记录 fork。

## 目标

- G-001：证明 DeepViewer 可以作为无需终端和预装开发工具的独立桌面应用运行。
- G-002：在大规模 UI 改造前验证 Harness 的打包、启动、健康检查和进程回收路径。
- G-003：建立不把 macOS 进程与路径假设散布到共享模块的桌面生命周期边界。
- G-004：保留现有 Harness Web surface、协议、会话和 Agent 能力。

## 非目标

- NG-001：不进行 DeepViewer 整体视觉、导航或信息架构改造。
- NG-002：不交付 macOS 签名/公证、Windows 代码签名或自动更新。
- NG-003：不构建、启动或验收 Windows 客户端；Windows 适配优先级后置。
- NG-004：不替换 Harness Agent Loop、Session、插件协议或 HTTP/WebSocket carrier。
- NG-005：不要求真实模型密钥作为自动化验收条件。
- NG-006：不承诺安装包体积、冷启动时间或常驻内存目标；本阶段只记录基线。

## 用户与用例

### UC-001：首次启动桌面应用

- 参与者：macOS 用户。
- 前置条件：用户安装或解压 DeepViewer；系统没有全局 Node 或 pnpm 也应可运行。
- 主流程：用户双击 DeepViewer，看到启动状态；应用启动本地 Harness；健康检查通过后显示现有 Web surface。
- 失败/退出流程：Harness 未能就绪时，界面显示可理解的错误、重试入口和日志位置，不停留在空白窗口。

### UC-002：完成确定性 Agent 冒烟任务

- 参与者：开发者或测试者。
- 前置条件：应用已启动；使用不需要真实密钥的测试 provider/fixture。
- 主流程：用户创建或打开测试会话，提交提示，看到流式输出完成。
- 失败/退出流程：运行时断开时，界面展示连接状态并允许重启 Runtime。

### UC-003：安全退出

- 参与者：桌面用户。
- 前置条件：Harness 以及零个或多个工具子进程正在运行。
- 主流程：用户退出 DeepViewer；应用停止接收新请求，终止 Harness 进程树，释放端口并退出。
- 失败/退出流程：优雅停止超时后执行有界强制回收并记录非敏感诊断。

### UC-004：保留后续平台适配边界

- 参与者：DeepViewer 开发者。
- 前置条件：实现 macOS RuntimeManager、资源定位或封包逻辑。
- 主流程：平台相关行为集中在 macOS 适配器或构建配置中，共享状态机和 Renderer 不依赖 macOS 专有接口。
- 失败/退出流程：发现共享模块必须依赖 macOS 专有行为时，先更新设计并记录对未来 Windows 适配的影响。

## 功能需求

- R-001：用户必须能通过双击安装产物启动 DeepViewer，无需手动执行 npm、pnpm、Node 或 Harness 命令。
- R-002：Electron 主进程必须通过 RuntimeManager 启动、健康检查、监控、重启和停止本地 Harness。
- R-003：安装产物必须包含运行基线 Harness 所需的兼容执行环境、构建产物、profile 和静态资源。
- R-004：窗口必须先显示明确启动状态，仅在 Harness 健康检查通过后加载应用 surface；失败时必须显示诊断摘要、重试和打开日志入口。
- R-005：正常退出、窗口关闭、Runtime 崩溃和启动超时都必须经过有界生命周期处理，应用退出后不得残留由它启动的 Harness 进程树。
- R-006：应用必须把主进程和 Harness stdout/stderr 写入可定位的本地日志，并对凭据、Authorization header 和已知敏感配置值做脱敏。
- R-007：共享 RuntimeManager 不得包含散落的 macOS 平台判断；路径、进程树、信号和封包格式必须通过 macOS 适配器或资源边界隔离。
- R-008：应用必须使用单实例锁，并对端口冲突、重复启动和运行时意外退出提供确定的重试或错误状态。
- R-009：桌面产物必须能使用无真实密钥的 fixture/provider 完成一次会话创建、提示提交和流式回复冒烟流程。

## 非功能需求

- NFR-001：本规格必须分别生成 macOS arm64 与 x64 产物；Windows 构建和启动不属于完成条件。
- NFR-002：Harness 必须只监听 loopback。优先使用操作系统分配的随机端口；如上游接口不支持端口 `0`，必须在冲突时重新选择而不是绑定固定端口。
- NFR-003：Renderer 必须设置 `nodeIntegration: false`、`contextIsolation: true` 和 `sandbox: true`；preload 只暴露本规格需要的允许列表方法。
- NFR-004：Electron 内置 Node 或独立 sidecar 的版本必须满足固定 Harness 基线的 `engines.node`，并由构建或启动前检查阻止不兼容组合。
- NFR-005：开发和打包模式必须使用同一生命周期状态机；安装路径、用户数据路径和 workspace 路径包含空格或非 ASCII 字符时仍可运行。
- NFR-006：启动、停止、重试和强制回收必须有明确超时，不允许界面无限等待且无状态反馈。
- NFR-007：日志、IPC 和错误 UI 不得记录或展示完整凭据；桌面进程不得把通用 Shell、任意文件读写或任意 URL 导航能力暴露给 Renderer。

## 验收条件

- AC-001：Given 没有可用全局 Node/pnpm 的 macOS 测试环境，When 用户启动与 CPU 架构匹配的 arm64 或 x64 DeepViewer 产物，Then 应用进入明确启动状态并显示 Harness Web surface。
- AC-002：Given Harness 正常启动，When 健康检查通过，Then RuntimeManager 状态按 `starting → ready` 转换，窗口只加载预期 loopback origin。
- AC-003：Given 无真实密钥的测试 fixture/provider，When 用户提交一次提示，Then 界面收到流式输出并显示完成状态。
- AC-004：Given Harness 创建了测试子进程，When 用户退出 DeepViewer，Then 在停止超时内 Harness 及其子进程全部终止，端口可以重新绑定。
- AC-005：Given Harness 启动失败、启动超时或运行中崩溃，When RuntimeManager 检测到失败，Then 用户看到错误摘要、重试操作和有效日志入口，不出现无限加载或空白窗口。
- AC-006：Given 首选端口已占用，When DeepViewer 启动，Then 应用自动改用可用 loopback 端口或给出明确错误，不连接到占用该端口的其他服务。
- AC-007：Given 安全配置自动检查和人工检查，Then Renderer 没有 Node integration，启用 context isolation 与 sandbox，任意外部导航和非允许列表 IPC 被拒绝。
- AC-008：Given 应用位于包含空格或非 ASCII 字符的路径，When 启动打包产物并完成冒烟流程，Then Harness、profile、Web 静态资源和日志路径均可正确解析。
- AC-009：Given 完成 macOS Runtime 与封包实现，When 进行架构检查，Then macOS 专有的进程、路径和封包行为位于明确适配边界，共享 Renderer 与 Runtime 状态机不包含 Windows 占位实现或散布的 macOS 分支。
- AC-010：Given 固定 Electron 与 Harness 组合，When 执行构建兼容检查，Then 不满足 `engines.node` 或缺失运行资源的构建在生成安装产物前失败。

## 边界与失败行为

- 第二个应用实例不得再启动 Harness；它应聚焦已有窗口后退出。
- Runtime 自动重启采用有限次数和退避策略。连续失败后停止重试，等待用户操作。
- 关闭流程先停止新请求，再尝试优雅终止；超时后只强制终止由本应用创建且已验证身份的进程树。
- 启动页不得把 Harness 原始堆栈完整呈现给普通用户，但日志应保留已脱敏的技术信息。
- 本规格允许 macOS 测试产物未签名；系统拦截未签名应用属于已知分发限制，不得误报为 Runtime 缺陷。
- 可为兼容性验证公开预览产物；公开发布本身不满足尚未完成的验收条件，也不自动提升规格状态。
- 本规格不以 Windows 构建结果阻断 macOS 完成；Windows 适配必须由后续独立规格启动。

## UX 说明

- 首屏至少具有 `正在启动`、`已就绪`、`启动失败`、`Runtime 已断开` 和 `正在退出` 状态。
- 失败状态提供“重试”和“打开日志位置”，不要求用户复制终端命令。
- 启动和错误信息可通过键盘读取与操作；状态不能仅依赖颜色表达。
- 本阶段加载上游现有 Web UI，DeepViewer 品牌与整体 UI 由后续规格处理。

## 数据、安全与隐私

- Harness 会话和 workspace 数据继续由 Harness 管理；桌面壳只保存窗口状态、Runtime 元数据和非敏感启动偏好。
- 日志默认保存在 Electron `userData` 下的专用目录，采用轮转或大小上限；具体保留期在实现时记录。
- Harness 仅可通过 `127.0.0.1`/loopback 访问，窗口拒绝加载其他 origin。外部链接必须交给受控的系统浏览器流程，不能在带权限的应用窗口中导航。
- 自动化验收使用无真实密钥 fixture。人工真实模型测试中的凭据不得写入规格、仓库或普通日志。

## 依赖

- [ADR-0001](../../architecture/decisions/ADR-0001-sdd-as-source-of-truth.md)
- [ADR-0003](../../architecture/decisions/ADR-0003-mac-package-before-ui-windows-deferred.md)
- [ADR-0004](../../architecture/decisions/ADR-0004-separate-macos-arm64-x64-artifacts.md)
- [DV-0002 上游分析](../DV-0002-upstream-foundation/spec.md)
- DeepSeek Harness `47f943859bef60e4160492346772ded9b24f765a` / `0.1.0-rc.5`
- Electron `43.4.0`、Electron Packager `20.3.0` 与 pnpm `11.19.0`

## 风险

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| Harness 依赖工作区源码或包管理器布局 | 打包后无法找到插件和资源 | 构建阶段生成显式 runtime manifest；对打包产物做 clean-environment 测试 |
| x64 原生依赖缺失或误装 arm64 文件 | Intel 版本启动或工具调用失败 | 分架构安装/封包；检查 Mach-O 架构；在真实 Intel 环境补充运行证据 |
| ASAR 为只读且不能直接执行部分资源 | 启动、cwd 或原生依赖失败 | 可执行/runtime 资源使用 `extraResources` 或明确 unpack；禁止依赖源码相对 cwd |
| Electron 内置 Node 与 Harness engine 不兼容 | 安装后运行失败 | 固定兼容矩阵并在构建前检查；必要时切换到独立 Node sidecar |
| 子进程树未完整回收 | 资源泄漏、文件锁和升级失败 | 平台进程适配器、PID 身份校验、优雅/强制两阶段回收测试 |
| Windows 问题发现较晚 | 后续平台适配成本增加 | macOS 专有行为集中在适配边界；Windows 由独立规格评估和实现 |
| loopback 服务被错误导航或端口劫持 | 本地执行能力被滥用 | 随机端口、origin allowlist、健康身份校验和最小 IPC |
| 上游同步策略未定 | Spike 代码难以迁移 | DeepViewer 桌面代码保持独立目录；构建输入固定 SHA；禁止散改参考 checkout |

## 已决与未决问题

- Q-001（已决）：采用 Electron `43.4.0` 与 Electron Packager `20.3.0`；Electron Node `24.18.1` 满足 Harness engine。
- Q-002（已决）：首个运行策略使用 `ELECTRON_RUN_AS_NODE=1`；独立 Node sidecar 只保留为未来兼容回退。
- Q-003（已决）：Harness 接受端口 `0`，并从自有子进程 stdout 报告实际 `127.0.0.1` origin。
- Q-004（未决）：macOS 最低版本与 Windows 最低版本由发行规格在更多真实机器证据后确定。
- Q-005（未决）：x64 已在 Apple Silicon + Rosetta 通过完整 GUI 冒烟，但仍需真实 Intel Mac 作为发行门禁证据。

## 审批

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-15
