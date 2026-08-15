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
  <a href="https://github.com/Duoasa/DeepViewer/releases/tag/v0.0.1"><strong>下载 DeepViewer v0.0.1</strong></a>
  ·
  <a href="#隐私设计">隐私</a>
  ·
  <a href="#构建与测试">从源码构建</a>
  ·
  <a href="#许可证与上游">开源许可</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

DeepViewer 是一个建立在
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 之上的开源桌面
Agent 工作台。它把当前依赖 npm 命令和浏览器 Web UI 的运行方式，封装为可独立安装的
macOS 应用，并自动管理内置本地 Runtime 的启动和退出。

> [!NOTE]
> DeepViewer 是独立的社区项目，与 DeepSeek 没有从属或官方背书关系。

> [!IMPORTANT]
> `v0.0.1` 是用于验证桌面封包基础的早期未签名测试版。DeepViewer 的 UI 与功能改造尚未
> 开始，后续将严格按照项目负责人提供的产品方案推进。

## 为什么选择 DeepViewer

| | |
| --- | --- |
| **桌面优先** | 像普通 macOS 软件一样启动 Agent，无需手动执行 Node、npm、pnpm 或 Web UI 命令。 |
| **自包含 Runtime** | 应用内包含固定版本的 Harness Runtime 和兼容执行环境。 |
| **兼容新旧 Mac** | 分别提供 Apple Silicon 与 Intel 原生安装包，覆盖新旧 Mac 设备。 |
| **默认本地运行** | Harness 只监听随机分配的 `127.0.0.1` 端口，不向局域网开放服务。 |
| **完整生命周期** | 桌面应用统一负责 Harness 的启动、健康检查、监控、重试和退出回收。 |
| **故障可诊断** | 提供启动状态、重试入口、本地日志，并对常见凭据格式进行脱敏。 |
| **为定制而生** | 保留 Harness 的会话、插件、工具和 Web 协议，同时为 DeepViewer UI 与功能建立扩展边界。 |
| **规格驱动** | 产品目标、架构决策、实施任务和验证证据统一保存在版本化 SDD 系统中。 |

## 快速开始

1. 从 [v0.0.1 Release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.0.1)
   下载与你的 Mac 处理器匹配的版本。
2. 打开 DMG，将 `DeepViewer.app` 复制到“应用程序”。
3. 打开 DeepViewer。应用会自动启动内置 Harness，并在 Runtime 就绪后进入本地工作区。

| Mac | 下载 | SHA-256 |
| --- | --- | --- |
| Apple Silicon（`arm64`） | [DeepViewer-0.0.1-macos-arm64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.0.1/DeepViewer-0.0.1-macos-arm64.dmg) | `9c76101b7b7b7cb8bf8cfed30b422927851e674f3092650388d58c8164ef0314` |
| Intel（`x64`） | [DeepViewer-0.0.1-macos-x64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.0.1/DeepViewer-0.0.1-macos-x64.dmg) | `6a24dbb6100edd804fd58167fde8c77326ddb65c09bc4497d5ed58212313681c` |

> [!WARNING]
> 当前测试包尚未使用 Apple Developer ID 签名或公证，首次打开时可能被 macOS 拦截。如果你
> 信任本仓库并确认文件来自上述官方 Release，可在 Finder 中使用“打开”，或前往
> **系统设置 → 隐私与安全性**允许打开。签名与公证将在后续可靠发行阶段完成。

## 0.0.1 已实现

- Electron 窗口禁用 Node integration，启用 context isolation 与 sandbox，并仅暴露窄
  preload API。
- 自动启动内置 DeepSeek Harness，并等待 Runtime 健康检查通过。
- Runtime 就绪后加载现有 Harness Web 界面。
- DeepViewer 退出时执行有界关闭和进程树回收。
- 分别生成 arm64 与 x64 应用、原生依赖和 DMG。
- 构建时检查固定 Harness 提交、Runtime manifest、目标架构、原生模块和内部符号链接。
- 本地 Runtime 日志会脱敏常见 Authorization 和 API Key 值。

## 当前限制

- 当前仍使用上游 Harness Web 界面；DeepViewer 自有 UI、导航、首次启动和差异化功能属于
  下一阶段。
- 安装包未签名、未公证，预计会出现 Gatekeeper 提示。
- Intel 版本已通过架构检查，并在 Apple Silicon + Rosetta 环境完成 GUI/Runtime 冒烟；
  仍需在真实 Intel Mac 上验收。
- 当前 Runtime 优先保证完整性，尚未做体积裁剪；单个 DMG 约 425–450 MB。
- Windows 封包将在 macOS UI 与功能路径稳定后开始。
- macOS 最低支持版本尚未形成正式发行承诺。

## 隐私设计

- Harness 仅监听系统随机分配的 loopback 地址。
- 桌面窗口拒绝非预期导航和新窗口。
- 桌面启动配置默认关闭 Harness 遥测。
- Renderer 只能使用允许列表内的桌面桥接能力，不获得通用 Shell 或文件系统访问权。
- 日志会脱敏常见 Authorization header、DeepSeek API Key 配置和密钥形式的值。
- 桌面壳不会上传用户工作区、凭据或完整会话历史。

## 使用要求

使用预构建应用：

- 配备 Apple Silicon 或 Intel 处理器的 Mac。
- 无需全局安装 Node.js、npm、pnpm 或 DeepSeek Harness。
- 由于当前为未签名测试版，首次启动需要用户通过 macOS 安全设置明确允许。

参与开发：

- Node.js 24 或更高版本。
- pnpm 11.19.0。
- 按下文准备固定版本的 DeepSeek Harness checkout。

## 构建与测试

克隆 DeepViewer 并安装工作区依赖：

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install
```

准备固定 Harness 基线：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir upstream/deepseek-harness install
pnpm --dir upstream/deepseek-harness run build
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh
```

执行检查并生成两个 macOS 安装包：

```sh
pnpm typecheck
pnpm test
pnpm desktop:build
pnpm desktop:package:arm64
pnpm desktop:package:x64
```

生成的应用、Runtime 和 DMG 位于 `out/` 与 `.runtime/`，它们属于构建产物，默认不会提交
到 Git。

## 生产源码结构

```text
apps/
└── deepviewer-desktop/          # Electron main、preload、启动 UI、测试和封包
docs/sdd/
├── product/                     # 产品愿景、原则和路线图
├── architecture/                # 系统边界、约束和 ADR
├── specs/                       # 功能规格、任务和验证
└── releases/                    # 公开版本记录和产物证据
package.json                     # 工作区命令与固定工具版本
pnpm-workspace.yaml              # 工作区包与依赖策略
upstream/deepseek-harness/       # 被忽略的固定构建输入，不保存唯一实现
```

## 路线图

1. 验证 Apple Silicon 与 Intel 的 macOS 封包基础。
2. 按批准方案完成 DeepViewer macOS UI 与功能改造。
3. 增加任务可观察性、控制、文件、工具、权限和故障恢复体验。
4. 将已验证的产品路径适配到 Windows。
5. 增加签名、公证、自动更新、诊断和可靠发行能力。

完整顺序以 [产品路线图](docs/sdd/product/roadmap.md) 为准。

## 规格驱动开发

DeepViewer 的 [SDD 文档系统](docs/sdd/README.md) 是产品基线、架构决策、功能规格、实施
任务、验证和公开发行证据的事实来源。

## 许可证与上游

DeepViewer 原创代码采用 [MIT License](LICENSE) 开源。DeepSeek Harness 与第三方组件保留
各自的版权声明和许可证。当前桌面基线固定在 DeepSeek Harness 提交
`47f943859bef60e4160492346772ded9b24f765a`（`0.1.0-rc.5`）。

## 反馈

欢迎通过 [GitHub Issues](https://github.com/Duoasa/DeepViewer/issues) 提交问题、Intel 兼容性
结果和聚焦的功能建议。Issue 中不得包含 API Key、凭据、私有工作区内容或未脱敏日志。
