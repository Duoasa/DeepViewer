---
id: DV-0003
title: Electron desktop packaging spike - Design
status: Implementing
updated: 2026-08-15
---

# DV-0003：设计

## 方案摘要

在 DeepViewer 仓库中建立独立 Electron 应用。Electron main 持有 RuntimeManager，后者通过统一状态机和平台进程适配器启动固定版本的 Harness。打包资源位于应用 `resources` 下而非依赖源码工作目录；Runtime 健康后，BrowserWindow 加载随机 loopback origin 上的现有 Harness Web surface。

macOS arm64 与 x64 使用独立运行时和独立安装包；arm64 在原生机器验证，x64 先在 Rosetta 验证并保留真实 Intel Mac 发行门禁。共享接口不得散布 macOS 行为；macOS 封包通过后直接进入 UI 与功能改造，Windows 适配由后续规格处理。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, R-003 | 资源与运行策略、打包结构 | 安装包携带 Harness 和兼容执行环境 |
| R-002, R-005, R-008 | RuntimeManager、主要流程 | 统一生命周期、超时、单实例和恢复 |
| R-004, R-006 | WindowController、日志与诊断 | 启动/失败界面、日志与重试 |
| R-007, NFR-001 | PlatformProcessAdapter | 共享状态机与 macOS 专有行为分离；Windows 后置 |
| R-009 | 测试策略 | 无密钥 fixture 覆盖完整桌面路径 |
| NFR-002, NFR-003, NFR-007 | 信任边界 | loopback、隔离 Renderer、受限 IPC/导航 |
| NFR-004, NFR-005 | 构建门禁、ResourceLocator | Node 兼容和安装路径验证 |
| NFR-006 | RuntimeManager | 每个过渡都有超时和用户可见状态 |

## 建议目录

```text
apps/deepviewer-desktop/
├── package.json
├── scripts/
│   ├── build-runtime.mjs
│   └── package.mjs
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── runtime-manager.ts
│   │   ├── resource-locator.ts
│   │   ├── window-controller.ts
│   │   └── platform/
│   │       ├── process-adapter.ts
│   │       └── darwin.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── index.html
│       └── main.ts
└── test/
    ├── fixtures/fake-harness/
    ├── runtime-manager.test.ts
    └── packaged-smoke.test.ts

.runtime/<arch>/harness/           # 构建阶段生成，不提交
├── deepviewer-runtime.json
├── package.json
└── node_modules/
    └── @deepseek-ai/dsh/lib/bin.js

DeepViewer.app/Contents/Resources/harness/  # Packager extraResource
```

最终路径可根据上游 workspace 约束调整，但职责边界必须保持。DeepViewer 自有代码不写入被忽略的 `upstream/deepseek-harness/` 参考 checkout。

## 组件与职责

### Electron main

- 获取单实例锁并管理应用退出。
- 组合 ResourceLocator、RuntimeManager、WindowController 和 LogManager。
- 不持有会话或 Agent 业务状态。

### RuntimeManager

- 使用以下有限状态机：

```text
stopped → starting → ready → stopping → stopped
              │         │
              └─→ failed ←┘
                    │
                    └─→ starting (bounded retry/user retry)
```

- 所有状态变化带时间戳和稳定错误码。
- 启动返回实际 origin 和 runtime identity；WindowController 不自行猜端口。
- 停止只操作由当前实例启动且身份匹配的进程。

### PlatformProcessAdapter

```ts
interface PlatformProcessAdapter {
  spawnRuntime(spec: RuntimeSpawnSpec): RuntimeProcess
  terminateTree(process: RuntimeProcess, deadlineMs: number): Promise<void>
  isAlive(process: RuntimeProcess): boolean
}
```

- `darwin` 负责进程组、SIGTERM/SIGKILL 和应用包资源权限。
- 共享代码不得通过到处使用 `process.platform` 绕过接口；仅组合根可以选择适配器。
- 本规格不创建未经测试的 `win32` 占位实现；后续 Windows 规格实现同一职责边界。

### ResourceLocator

- 开发模式从显式配置的构建输出读取，不通过当前工作目录猜测。
- 打包模式只从 `process.resourcesPath` 和 Electron `userData` 派生路径。
- 启动前校验 runtime manifest、入口、profile、Web 静态资源、版本和 SHA。

### WindowController

- 立即显示本地 launch surface，呈现 Runtime 状态。
- 只在收到 `ready` 后导航到 RuntimeManager 返回的精确 origin。
- 拒绝窗口内任意外部导航、新窗口和未允许协议。
- Runtime 失败或断开时返回诊断 surface，而不是空白页。

### Preload / IPC

首个切片只允许：

```ts
interface DeepViewerDesktopApi {
  getRuntimeStatus(): Promise<RuntimeStatusView>
  retryRuntime(): Promise<void>
  openLogDirectory(): Promise<void>
  onRuntimeStatus(listener: (status: RuntimeStatusView) => void): () => void
}
```

每个 handler 校验调用来源和参数。不得提供 `exec`、通用 shell、任意路径文件 API 或任意 URL 打开能力。

## 资源与运行策略

### Spike 默认路径

1. 固定 Electron `43.4.0`、Electron Packager `20.3.0` 和 pnpm `11.19.0`。
2. 固定 SHA 的 Harness checkout 完成 host/client/Web 构建，并使用上游官方 release pack 边界生成 9 个 vendor 与 221 个 Harness tarball。
3. `build-runtime.mjs` 为 arm64/x64 分别安装 tarball 与外部生产依赖；x64 在 Apple Silicon 构建机上由 Electron x64 Node 经 Rosetta 执行安装脚本。
4. 构建脚本验证 runtime manifest、内部符号链接、`node-pty`、Koffi 和 spawn helper 的目标 Mach-O 架构；不匹配时拒绝封包。
5. Electron Packager 通过 `extraResource` 把对应 `.runtime/<arch>/harness` 放入 `Contents/Resources/harness`；应用代码使用 ASAR，Harness 与原生模块留在可执行资源树。
6. Runtime 使用 Electron 可执行文件配合 `ELECTRON_RUN_AS_NODE=1` 和 `--expose-internals` 启动安装后的 Harness entrypoint。
7. 打包态默认关闭 Harness 遥测，并以 `userData/workspace` 作为尚未选择用户工作区时的 TCC 安全 cwd；后续目录选择器授权真实工作区。
8. 构建和启动检查 Electron `process.versions.node` 满足 Harness `engines.node`；Node sidecar 只保留为兼容回退。

最终安装产物不得引用开发机绝对路径、全局 Node、pnpm store 或参考 checkout。

## 接口与事件

### Runtime 状态

```ts
type RuntimePhase =
  | 'stopped'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'failed'

interface RuntimeStatusView {
  phase: RuntimePhase
  attempt: number
  errorCode?: string
  userMessage?: string
}
```

Renderer 不接收 PID、完整命令行、凭据、环境变量或本地绝对工作区路径。详细诊断只写入脱敏日志。

### Runtime identity 与健康检查

- RuntimeManager 只接受由自己持有的子进程 stdout 输出且匹配精确格式的 `http://127.0.0.1:<port>`。
- 收到 readiness 后以有界 `fetch` 探测同一 loopback origin；非 HTTP、非 `127.0.0.1` 或非成功响应全部拒绝。
- 本切片不把任意候选端口或外部发现的服务当作 Harness；更强 nonce 身份协议可在上游支持时追加。

## 状态与数据模型

- Runtime 状态只存在于主进程内存；重启应用后重新探测和启动，不把 PID 当作持久事实。
- 非敏感设置存放于 Electron `userData`；未选择工作区时使用 `userData/workspace`，避免未授权访问 macOS Documents TCC 域；本规格不新增会话数据副本。
- 日志位于 `userData/logs`，设置大小/文件数上限。日志格式包含时间、组件、级别、稳定错误码和脱敏消息。
- runtime manifest 记录 Harness SHA/版本、Node engine、构建平台、入口和资源哈希，属于安装包只读数据。

## 主要流程

### 启动成功

1. Electron 获取单实例锁并显示 launch surface。
2. ResourceLocator 校验资源与 Node 兼容性。
3. RuntimeManager 选择 loopback 端口并通过平台适配器启动 Harness。
4. RuntimeManager 在有界时间内轮询健康状态并校验 runtime identity。
5. 状态变为 `ready`，WindowController 加载精确 origin。
6. 无密钥 fixture 驱动现有 Web surface 完成一次流式任务。

### 启动失败与重试

1. 超时、进程退出、资源缺失或身份校验失败映射为稳定错误码。
2. RuntimeManager 确保失败进程树已回收。
3. launch surface 显示摘要、重试和日志入口。
4. 自动重试仅针对瞬态端口/启动失败且次数有限；其他错误等待用户重试。

### 退出

1. 标记 `stopping`，阻止重启和新窗口操作。
2. 请求 Harness 优雅停止并等待有界时间。
3. 超时后由平台适配器终止已验证的进程树。
4. 确认端口释放、刷新日志，然后允许 Electron 退出。

## 权限、安全与隐私

- BrowserWindow 使用 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- Harness 只绑定 loopback，不因桌面化新增 LAN/公网访问。
- preload 使用 `contextBridge` 暴露固定方法；IPC channel 和参数均使用 allowlist 校验。
- `will-navigate`、`setWindowOpenHandler` 和请求过滤只允许当前 runtime origin 与应用静态页面。
- 进程环境变量按允许列表构造，不把整个父进程环境或调试凭据写进日志。
- 打开日志目录由 main 使用固定派生目录处理，Renderer 不能提交任意路径。

## 可观察性

- 主进程记录应用版本、平台、架构、Harness SHA、状态转换和稳定错误码。
- Harness stdout/stderr 逐行接入日志并经过敏感字段脱敏。
- 记录启动耗时、健康检查尝试次数、退出耗时、强制回收次数和产物大小，作为后续性能目标基线。
- 用户界面只显示简短可操作信息；诊断日志不得包含完整凭据、Authorization header 或完整用户提示。

## 兼容、迁移与回滚

- 本规格不改变 Harness 持久数据格式，不需要数据迁移。
- Electron、Harness 或运行策略升级必须更新 runtime manifest 和兼容验证。
- Desktop shell 可回滚到前一个构建产物；因未引入自动更新，本阶段由开发者手动替换。
- 若 `ELECTRON_RUN_AS_NODE` 不可行，切换 Node sidecar 只影响 ResourceLocator/RuntimeSpawnSpec，不改变 Renderer 和 Harness 协议。
- 后续 Windows 规格若证明共享接口不足，应通过新 ADR/规格修订接口，不复制共享生命周期逻辑。

## 测试策略

- 单元测试：RuntimeManager 状态机、超时、有限重试、错误映射、资源 manifest、日志脱敏。
- 集成测试：fake Harness 提供健康端点、流式 fixture、崩溃和孙进程场景，验证窗口与进程回收。
- 打包测试：从 `.app`/安装目录启动，清除 PATH 中的 Node/pnpm，验证空格/非 ASCII 路径和只读资源。
- Harness 冒烟：固定上游 SHA，加载现有 Web surface，使用无密钥 fixture 完成流式任务。
- 安全测试：检查 BrowserWindow 配置、导航拦截、IPC allowlist、非 loopback 绑定和日志敏感内容。
- 人工检查：启动/失败/重试/退出状态、键盘操作、日志入口和无空白窗口。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| Electron + 现有 HTTP/WebSocket surface | 最大复用上游，最快验证桌面生命周期 | 需要处理本地端口和 Electron 资源布局 | 采用 |
| Electron Renderer 直接运行 Harness | 无本地服务端口 | 破坏安全边界，Node 能力进入 Renderer | 拒绝 |
| 首版重写原生 UI/IPC 协议 | 桌面感更强 | 同时承担 UI、协议和打包风险 | 拒绝 |
| 只在开发模式启动外部 `pnpm` | 实现快 | 不满足独立安装目标，无法证明打包可行 | 拒绝 |
| 立即完成签名、更新和双平台安装器 | 接近生产发布 | 在产品骨架未稳定时扩大范围 | 延后 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-15
