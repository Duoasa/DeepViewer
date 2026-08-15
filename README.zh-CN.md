<p align="center">
  <img src="Resources/DeepViewer-Icon.png" width="160" alt="DeepViewer 应用图标">
</p>

<h1 align="center">DeepViewer</h1>

<p align="center">
  基于 DeepSeek Harness 的可视、可控、可定制桌面 Agent 工作台。
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases"><img alt="最新版本" src="https://img.shields.io/github/v/release/Duoasa/DeepViewer?display_name=tag&include_prereleases"></a>
  <img alt="支持 Apple Silicon 和 Intel Mac" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-111111?logo=apple">
  <img alt="Electron 43" src="https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.1"><strong>下载 DeepViewer v0.1.1</strong></a>
  ·
  <a href="#011-更新内容">更新内容</a>
  ·
  <a href="#隐私设计">隐私</a>
  ·
  <a href="#构建与测试">从源码构建</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <img src="Resources/DeepViewer-App.png" width="100%" alt="DeepViewer macOS 工作区">
</p>

DeepViewer 是一个建立在
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 之上的独立开源桌面
Agent 工作台。它把固定版本的本地 Runtime 封装进普通 macOS 应用，并提供面向可视、可控
Agent 体验设计的桌面外壳。

> [!NOTE]
> DeepViewer 是独立社区项目，与 DeepSeek 没有从属或官方背书关系。

> [!IMPORTANT]
> `v0.1.1` 是未签名的 macOS UI 预览版，已通过维护者的初步视觉验收，但不是已签名、
> 已公证或稳定发行版本。

## 为什么选择 DeepViewer

| | |
| --- | --- |
| **桌面优先** | 像普通 macOS 软件一样启动 Agent，无需手动执行 Node、npm、pnpm 或 Web UI 命令。 |
| **自包含 Runtime** | 应用内包含固定版本的 Harness Runtime 和兼容执行环境。 |
| **原生 Mac 安装包** | 分别提供 Apple Silicon arm64 与 Intel x64 安装包。 |
| **一体化 macOS 外壳** | 原生红绿灯位于应用内，顶部全宽可拖动，并提供 Codex 式完整侧栏收起。 |
| **默认本地运行** | Harness 只监听随机分配的 `127.0.0.1` 端口，不向局域网开放服务。 |
| **完整生命周期** | 桌面应用统一负责 Harness 的启动、健康检查、监控、重试和退出回收。 |
| **干净公开产物** | 每次公开发行均从 allowlist 输入重新构建，并阻止开发者路径、设置或凭据值进入包体。 |
| **规格驱动** | 产品目标、架构、实施任务和验证证据统一保存在版本化 SDD 系统中。 |

## 快速开始

1. 从 [v0.1.1 Release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.1)
   下载与你的 Mac 处理器匹配的版本。
2. 打开 DMG，将 `DeepViewer.app` 复制到“应用程序”。
3. 打开 DeepViewer。应用会自动启动内置 Harness，并在 Runtime 就绪后进入本地工作区。

| Mac | 下载 | SHA-256 |
| --- | --- | --- |
| Apple Silicon（`arm64`） | [DeepViewer-0.1.1-macos-arm64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.1/DeepViewer-0.1.1-macos-arm64.dmg) | `3eea789d36458272cee469a80167d09badb1abea1723abd88f118da465d406b9` |
| Intel（`x64`） | [DeepViewer-0.1.1-macos-x64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.1/DeepViewer-0.1.1-macos-x64.dmg) | `f7b70f7fcdf8641f7228a2df42242e444688b8ac3ec1865c27029be9624dd561` |

Release 同时提供
[`SHA256SUMS.txt`](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.1/SHA256SUMS.txt)
供命令行核验。

> [!WARNING]
> 当前预览包尚未使用 Apple Developer ID 签名或公证，首次打开时可能被 macOS 拦截。如果你
> 信任本仓库并确认文件来自上述官方 Release，可在 Finder 中使用“打开”，或前往
> **系统设置 → 隐私与安全性**允许打开。

## 0.1.1 更新内容

<p align="center">
  <img src="Resources/DeepViewer-Conversation.png" width="100%" alt="DeepViewer 对话工作区">
</p>

- 将 macOS 原生红绿灯整合到应用内容区域，移除独立系统标题栏。
- 在红绿灯右侧加入 Codex 式侧栏按钮；收起时整个侧栏消失，原生全屏隐藏红绿灯后按钮
  自动补位到最左侧。
- 为整个主界面保留顶部全宽安全区，避免系统按钮、页面操作和拖动区域互相遮挡。
- 将应用名、窗口和 Dock 身份统一为 `DeepViewer`，使用维护者提供的 macOS 26 图标。
- 加入居中的 DeepViewer 启动等待页：Logo 横线像输入光标闪烁；插件加载阶段使用稳定
  Logo 与 `Loading Plugins...` 文字流光。
- 加入发布隐私门禁：每个公开架构均从干净 Runtime 和 allowlist staging 重建，DMG 创建前
  自动检查个人路径、设置与凭据值。
- 为 0.1.1 全新生成彼此独立的 arm64 与 x64 DMG。

## 当前限制

- 安装包未签名、未公证，预计会出现 Gatekeeper 提示。
- x64 版本已通过架构、包体和 Apple Silicon + Rosetta 基础验证；真实 Intel Mac 验收仍待完成。
- 当前主要是在上游 Harness 工作区外增加 DeepViewer 桌面外壳；更多导航、首次启动和
  差异化 Agent 功能仍在规划中。
- 本预览版不包含 Windows、自动更新、崩溃上报或稳定支持承诺。
- 当前 Runtime 优先保证完整性，DMG 体积较大；体积优化将在产品路径稳定后进行。

## 隐私设计

- Harness 仅监听系统随机分配的 loopback 地址。
- 桌面窗口拒绝非预期导航和新窗口。
- 桌面启动配置默认关闭 Harness 遥测。
- Renderer 只能使用允许列表内的桌面桥接能力，不获得通用 Shell 或文件系统访问权。
- 日志会脱敏常见 Authorization、API Key 配置和密钥形式的值。
- 公开安装包只从全新 allowlist staging 创建；构建会删除包管理器工作区元数据，并阻止
  开发机主目录、个人设置文件和当前环境凭据值进入包体。
- DeepViewer 不会把开发者或维护者本地的会话、工作区、日志、设置或 API 凭据加入公开资产。

## 使用要求

使用预构建应用：

- 配备 Apple Silicon 或 Intel 处理器的 Mac。
- 无需全局安装 Node.js、npm、pnpm 或 DeepSeek Harness。
- 由于当前为未签名预览版，首次启动需要用户通过 macOS 安全设置明确允许。

参与开发：

- Node.js 24 或更高版本。
- pnpm 11.19.0。
- 按下文准备固定版本的 DeepSeek Harness checkout。

## 构建与测试

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install

git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir upstream/deepseek-harness install
pnpm --dir upstream/deepseek-harness run build
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh

pnpm typecheck
pnpm test
pnpm desktop:build
pnpm desktop:package:arm64
pnpm desktop:package:x64
```

生成的应用、Runtime 和 DMG 位于 `out/` 与 `.runtime/`，它们属于构建产物，默认不会提交到 Git。

## 规格驱动开发

DeepViewer 的 [SDD 文档系统](docs/sdd/README.md) 是产品基线、架构、规格、任务、验证、
发布隐私规则和公开产物证据的事实来源。

## 许可证与上游

DeepViewer 原创代码采用 [MIT License](LICENSE) 开源。DeepSeek Harness 与第三方组件保留
各自的版权声明和许可证。当前桌面基线固定在 DeepSeek Harness 提交
`47f943859bef60e4160492346772ded9b24f765a`（`0.1.0-rc.5`）。

## 反馈

欢迎通过 [GitHub Issues](https://github.com/Duoasa/DeepViewer/issues) 提交问题、Intel 兼容性
结果和聚焦的功能建议。Issue 中不得包含 API Key、凭据、私有工作区内容或未脱敏日志。
