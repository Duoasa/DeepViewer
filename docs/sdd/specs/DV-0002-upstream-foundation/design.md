---
id: DV-0002
title: DeepSeek Harness foundation and DeepViewer customization direction - Design
status: Review
updated: 2026-08-15
---

# DV-0002：架构分析与简化方案

## 结论

推荐采用“**上游源码基础 + DeepViewer 独立 profile/bundle + 客户端插件覆盖层 + 桌面壳**”。先保留现有运行时和大部分 Web 功能，只替换品牌、主题和必要的 UI 区域；新增功能按职责进入 Host 插件、客户端插件、会话事件或投影。v0.1 不重写 Agent Loop，也不另造通信协议。

## 上游架构摘要

### 1. 一切都是 Cordis 插件

Harness 没有不可替换的特权内核。Agent Loop、模型适配器、工具、会话、Host API 和浏览器 UI 都由 Cordis 插件组装，注册项随插件生命周期撤销。

### 2. Profile 与 bundle 决定产品形态

`dsh-base` 提供通用运行时；`dsh-web-app` 在其上增加 Web Host、API、存储、workspace 和浏览器插件 roster。profile、bundle patch 和用户 overlay 按顺序生成最终插件树。因此 DeepViewer 可以拥有自己的 bundle/profile，而不必在每个上游包中加入品牌判断。

### 3. Host 与 Browser 各有一棵插件树

Host 拥有 Agent、会话、工具、存储和 API；Browser 拥有连接、会话对象层、slot、主题和 UI 插件。两侧通过类型化 RPC 与双下行 WebSocket 流通信。

### 4. 会话事件是持久事实

模型可见内容必须能从 append-only Session log 重建。Browser 从事件窗口生成 Conversation Nodes 和不可变快照；UI 不应另外维护一份权威业务状态。

### 5. UI 通过 slot 组合

Web shell 只渲染 `root`。`ui-layout` 占用 root 并声明 sidebar、conversation、details 和 overlay 等子 slot；其他 UI 功能以独立客户端插件注册。组件只接收 props，不直接访问 Cordis ctx；流式业务状态位于 React-free runtime 对象层。

### 6. `apps/web` 只是薄入口

入口只挂载 `AppWebEntry`；真正的加载、插件组合和连接逻辑位于 client packages。品牌标题、favicon 和 PWA manifest 在 app 层，主题和功能呈现位于 UI 插件层。

## 推荐的目标结构

```text
DeepViewer Desktop App
├── Desktop main process
│   ├── 启动/停止本地 Harness
│   ├── 选择随机 loopback 端口
│   ├── 管理窗口、更新和系统能力
│   └── 监控崩溃并导出诊断
├── Secure WebView
│   └── 加载 DeepViewer Web surface
└── Bundled Harness runtime
    └── deepviewer profile
        ├── upstream dsh-base / Web Host capabilities
        ├── DeepViewer host plugins
        └── DeepViewer browser roster
            ├── brand/theme
            ├── layout additions or replacements
            └── feature UI plugins
```

### 建议的源码归属

```text
apps/
├── deepviewer-web/              # title、favicon、manifest、薄 Web 入口
└── deepviewer-desktop/          # Electron/Tauri 壳，待 ADR 决定
packages/deepviewer/
├── app-bundle/                  # DeepViewer profile/bundle patch
├── ui-brand/                    # 品牌、欢迎页、About、导航标识
├── ui-theme/                    # DeepViewer token 与主题设置
├── ui-shell/                    # 仅在信息架构需要变化时替换布局
├── desktop-bridge/              # 窄 Host/desktop 能力接口
└── feature-*/                   # 独立业务功能插件
```

这组路径是建议，不是已批准的最终命名。上游仓库的命名和 workspace 门禁当前偏向 `@deepseek-ai/dsh-*`，引入 `@deepviewer/*` 时需要一次集中调整。

## 三种路线比较

| 路线 | 初期速度 | 上游同步 | 功能复用 | 风险 | 结论 |
| --- | --- | --- | --- | --- | --- |
| A. 直接修改上游 UI 包 | 快 | 差 | 高 | 品牌和产品 diff 散落，升级冲突持续增加 | 只用于原型，不作为长期结构 |
| B. 独立 profile/bundle + UI 插件覆盖层 | 中 | 较好 | 最高 | 需要理解 slot 和构建门禁 | 推荐 |
| C. 使用 SDK/JSON-RPC 重写独立客户端 | 慢 | 好 | 低到中 | 当前 SDK 在取消、审批和客户端控制面仍有限制 | 不用于 v0.1 主界面 |

## 改造位置决策表

| 需求类型 | 应改位置 | 尽量不要改 |
| --- | --- | --- |
| 名称、图标、PWA 信息 | `apps/deepviewer-web` | runtime/core |
| 颜色、字体、圆角、间距 | DeepViewer theme token/CSS | 每个组件写硬编码颜色 |
| 增加徽标、状态条、工具入口 | 现有 list/keyed slot 的客户端插件 | 修改 root layout |
| 改变三栏结构或主导航 | 新 `ui-shell`，完整声明所拥有的子 slot | 在多个现有组件中交叉打补丁 |
| 新增纯浏览器查看状态 | 组件本地 state 或 slot store | Session log |
| 新增跨组件查看状态 | 插件声明的 store | React 全局业务 store |
| 新增 Host 查询/命令 | Host Service + Typert Remote | UI 读文件/数据库 |
| 新增实时 Host 状态 | Host frame + Browser object layer | 轮询多个内部服务 |
| 新增持久会话事实 | `SessionEventMap` + projection + renderer | UI 私有持久化副本 |
| 新增 Agent 能力 | 工具、preset、capability seam | Agent Loop 分支 |
| 拦截请求/工具/轮次 | `agent/*`、`tools/*` 事件 | 修改循环控制流 |
| 操作系统能力 | desktop bridge 或已有 Host native provider | WebView Node integration |

## UI 改造策略

### 第一层：低冲突品牌化

- 新建 DeepViewer Web app 入口，替换 title、favicon、manifest 和加载品牌。
- 在主题层覆盖语义 token，建立 DeepViewer 色彩、字体和密度。
- 通过已有 slot 增加 logo、About、版本和少量导航项。
- 保留现有三栏结构、Conversation、Tool、Settings 和 runtime。

### 第二层：局部产品化

- 新增 DeepViewer 客户端插件，例如任务概览、运行状态、诊断、文件变化摘要。
- 使用现有 `shell.overlay`、会话 header、input dock、toolview 和 settings slot。
- 只有当新信息架构无法通过现有 slot 表达时，才替换 sidebar 或 conversation occupant。

### 第三层：整体信息架构变化

- 新 `ui-shell` 占用 root，并重新声明所有必要子 slot。
- 保留 runtime、connection、Conversation Node 和 feature plugin 契约。
- 对被替换的上游 UI 插件逐项决定复用、适配或禁用，不能只复制页面 JSX。

## 功能改造策略

### UI 已有、只需重新呈现

上游已经包含 workspace/session、流式会话、工具卡、文件产物、权限、问题、模型、preset、plan、goal、subagent、jobs、settings 和 trajectory。DeepViewer v0.1 应先复用这些业务能力，只改变入口、分组和视觉层级。

### 需要新 Host 能力

建立一对 Host/Client 插件：Host 提供服务和窄 Remote，Client 注册 UI。查询使用 Typert Remote；持续变化使用 frame；需要回放或影响模型上下文时写 SessionEvent 并注册 projection/Conversation Node。

### 需要改变 Agent 行为

通过 DeepViewer agent preset 组合工具、权限、提示词和模型 provider。只有确认现有 `agent/*`、`tools/*`、LLM adapter 或 capability seam 无法表达需求后，才提出修改 Agent Loop 的独立 ADR。

## 桌面壳建议

### v0.1 采用 Electron

Harness 本身依赖 Node，Electron 与现有 TypeScript/React/Node 工具链更接近，首个可运行安装包的整合成本通常低于 Tauri 加 Node sidecar。Electron 选择来自 ADR-0002，当前平台顺序由 [ADR-0003](../../architecture/decisions/ADR-0003-mac-package-before-ui-windows-deferred.md) 替代确定。

### 最小安全模型

- Renderer 禁用 Node integration，启用 context isolation。
- Harness 只监听 `127.0.0.1` 的随机可用端口。
- WebView 只允许 DeepViewer 本地 origin，拦截任意外部导航。
- 桌面 IPC 采用允许列表方法，不暴露 shell 或通用文件读写。
- Harness 和窗口生命周期绑定；退出、崩溃、重启和升级均有回收路径。

第一版继续使用现有 HTTP/WebSocket carrier，不立即实现新的 Electron IPC carrier。这样可以复用 Web UI、协议校验和 E2E 测试；未来确认端口模型不可接受时再替换 transport。

## 简化实施阶段

### Phase 0：剩余基础决策

1. 选择上游集成方式，推荐当前仓库跟踪 `upstream` remote，并把 DeepViewer 改动集中在自有路径。
2. 列出 v0.1 必须改变的三个用户流程，冻结非目标。

### Phase 1：macOS 桌面打包纵向验证

1. Electron 主进程启动本地 Harness 并加载现有 Web surface。
2. 打包自包含运行时，验证健康检查、日志、失败恢复和退出回收。
3. 生成 macOS arm64 可双击产物；通过后直接进入 UI 与功能改造。

### Phase 2：DeepViewer Web 与 macOS MVP

1. 建立 DeepViewer app、bundle/profile 和包命名空间。
2. 替换品牌资产、标题和主题 token，保持上游 UI 结构并跑通无密钥回放。
3. 完成首次启动、模型凭据配置、workspace 选择和端到端本地任务。

### Phase 3：DeepViewer 信息架构与差异化功能

1. 根据确认的 UI 方案，先使用 slot 做增量改造。
2. 只有存在明确证据时才替换 sidebar、conversation 或 root。
3. 为每个替换区域保留上游行为回放和可访问性测试；Windows 平台适配由后续规格实现。

### Phase 4：差异化功能

每个功能独立建立规格，按“现有能力复用 → 新 UI 插件 → 新 Host Remote/frame → 新会话事件/Agent 能力”的顺序寻找最小改造面。

## 不建议在 v0.1 做的事

- 重写 Session、Connection、Conversation assembler 或 Agent Loop。
- 用第二套 Redux/Zustand 业务状态复制会话事件。
- 直接把 Electron API 暴露给 React 组件。
- 同时重做视觉、信息架构、协议和 Agent 行为。
- 在没有认证层时允许 LAN 或公网访问。

## 需要批准的决定

### 已接受

1. 采用路线 B：独立 profile/bundle + 插件覆盖层。
2. 采用 Electron；macOS arm64 封包优先，随后进行 UI/功能改造，Windows 适配后置。

### 待批准

1. UI 第一阶段是否保留上游三栏信息架构，只做 DeepViewer 品牌化和局部增强。
2. 源码集成采用 fork/upstream merge，还是独立仓库的周期性快照导入。
