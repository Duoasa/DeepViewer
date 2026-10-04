<p align="center">
  <img src="Resources/DeepViewer-0.3.3.png" width="160" alt="DeepViewer 应用图标">
</p>

<h1 align="center">DeepViewer</h1>

<p align="center">
  基于 DeepSeek Harness 的可视、可控、可定制桌面 Agent 工作台。
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases"><img alt="最新版本" src="https://img.shields.io/github/v/release/Duoasa/DeepViewer?display_name=tag&include_prereleases"></a>
  <a href="https://github.com/Duoasa/DeepViewer/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Duoasa/DeepViewer/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="支持 Apple Silicon Mac" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?logo=apple">
  <img alt="Electron 44" src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness/discussions/2828"><img alt="在 GitHub 上讨论" src="https://img.shields.io/badge/Discuss-GitHub%20Discussions-181717?logo=github&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases/download/v0.5.1/DeepViewer-0.5.1-arm64.dmg"><strong>下载 0.5.1（ARM64）</strong></a>
  ·
  <a href="#051-修复">本版更新</a>
  ·
  <a href="#安装与数据">隐私与数据</a>
  ·
  <a href="#从源码构建">从源码构建</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

DeepViewer 是建立在
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 之上的独立开源桌面
Agent 工作台。它通过原生 Electron/DesktopHost 将固定版本的 Runtime 封装进 macOS
应用，提供 Work / Chat 空间、文件交付、侧栏工作台和会话图谱。0.5.0 源码承接
Scoder 0.7.0 Build 43，恢复 DeepViewer 品牌和独立的数据目录。0.5.1 在此基础上恢复旧版新会话待机动画，并修复 macOS 原生图标适配。

<p align="center">
  <img src="Resources/screenshots/image-delivery.png" width="100%" alt="DeepViewer 0.3.3 将生成图片作为附件交付并在侧栏预览">
</p>

> [!NOTE]
> DeepViewer 是独立社区项目，与 DeepSeek 没有从属或官方背书关系。

> [!IMPORTANT]
> 当前正式版本为 **DeepViewer 0.5.1 / Build 91**，内置 DeepSeek Harness `0.2.0-rc.2`，**仅支持 Apple Silicon arm64**。DMG 已从源码全新构建，完成 Developer ID 签名和 Apple 公证。界面、真实账户及迁移会话/设置/附件仍保留独立的人工验收边界。

> [!TIP]
> [0.5.1 Release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.5.1) 提供 [SHA-256 校验清单](https://github.com/Duoasa/DeepViewer/releases/download/v0.5.1/SHA256SUMS.txt)。安装版和开发版使用相互独立、与版本号无关的数据目录；重大升级前请备份。上一版本 [0.5.0](https://github.com/Duoasa/DeepViewer/releases/tag/v0.5.0)、历史 [0.3.3 / Build 75](https://github.com/Duoasa/DeepViewer/releases/tag/v0.3.3) 及其 SHA-256 清单、历史 [0.2.5 版本](https://github.com/Duoasa/DeepViewer/releases/tag/v0.2.5-preview.1) 仍可下载。

> [!NOTE]
> 本 README 的全部截图均为 **0.3.3 / Build 75 历史参考**，本次没有替换截图，不代表 0.5.1 当前界面或视觉验收结果。

## 0.5.1 修复

- 新会话恢复旧版鱼标的大小、淡色样式、光标闪烁、图文间距、文本样式和居中待机位置；保留底部常驻输入框与减少动态效果设置。
- 移除铺满画布的 PNG Dock 覆盖，以原鲸鱼向量编译 macOS 原生图标，让系统生成外观、遮罩、透明边界及完整 ICNS，并统一 bundle 图标身份。

构建与安装包证据见 [0.5.1 发布记录](docs/sdd/releases/v0.5.1.md)。实际新会话及 Dock 视觉仍需维护者人工验收。

## 0.5.0 从 0.3.3 迁移的功能变化

| 领域 | 0.5.0 的变化 |
| --- | --- |
| 原生桌面 | 从旧自建桌面壳和 DSH 0.1.5 覆盖层迁移到官方 Electron/DesktopHost 与固定 DSH `0.2.0-rc.2`，以 Scoder `0.7.0 / Build 43` 为源码基线。 |
| Work、Chat 与会话图谱 | 保留依赖工作区的 Work 和无工作区的 Chat，增加内置 Synapse 会话图谱，用于查看会话关联与上下文。 |
| 侧栏工作台 | Harness 原生面板承接独立 Better Sidebar 的挂载；DeepViewer 保留文件/编辑器/Git 操作、会话相对路径、桌面浏览器集成与权限检查。 |
| 内置模块 | subscriptions `0.3.1` 和 model-capabilities `1.0.2` 作为应用模块内置；模型能力模块替代旧 reasoning 插件，并承接其支持的设置。 |
| 文件与外观 | 保留附件交付和工作区预览，在原生壳中恢复 DeepViewer 品牌，跟随桌面/系统外观。 |
| 开发稳定性 | 文件同步仅改变产物元数据时保留已挂载的界面；真实源码变化和完成构建的时间戳仍触发热更新。 |
| 升级连续性 | 保留稳定版/开发版独立数据根目录，在新内核打开存储前快照旧 DeepViewer 数据，保留迁移与回滚备份；Scoder 和 Saidex 数据不作为迁移候选。 |
| 网络 | 保留系统代理/PAC、显式代理、限定范围的 loopback/RPC 鉴权与内网访问授权边界。 |

独立 Better Sidebar 和 reasoning 插件退出挂载，由本次迁移的原生功能与模型能力模块承接。Taskboard 保持移除，历史预览插件保持停用。包体证据见 [0.5.0 发布记录](docs/sdd/releases/v0.5.0.md)，人工验收边界见[规格](docs/sdd/specs/DV-0033-scoder-native-rebase/spec.md)；[0.3.3 发布记录](docs/sdd/releases/v0.3.3.md)仅提供历史证据。

### Work、Chat 与过程披露

Work 按项目组织会话，Chat 可以脱离工作区保存对话。两种模式都能在启动后恢复历史；同类上下文、思考、搜索和操作会合并为可展开的摘要。

![0.3.3 历史参考：Work 项目与会话历史](Resources/screenshots/work-session.png)

![0.3.3 历史参考：独立 Chat 与展开的过程披露](Resources/screenshots/chat-and-disclosure.png)

### 文件与侧栏工作台

侧栏可以查看工作区文件、预览生成的 HTML，并与对话并排浏览网页。文件路径、面板导航和浏览器访问都与当前桌面会话关联。

![0.3.3 历史参考：Work 对话右侧打开网页](Resources/screenshots/browser-workbench.png)

![0.3.3 历史参考：在侧栏预览生成的 HTML 页面](Resources/screenshots/html-preview.png)

### 图片生成与附件交付

生成文件以具有可用名称和后缀的附件卡片交付。即使图片最初生成在工作区外，也会复制到会话工作区，让附件与侧栏预览指向同一个文件。

![0.3.3 历史参考：生成图片的附件卡片与侧栏预览](Resources/screenshots/image-delivery.png)

![0.3.3 历史参考：图片生成结果、过程披露与侧栏预览](Resources/screenshots/image-generation.png)

### 外观与版本信息

设置页跟随桌面外观，“关于”页面展示应用构建号和内置 Harness 版本。

![0.3.3 历史参考：关于页显示 Build 75 与 Harness 0.1.5-rc.2](Resources/screenshots/about-version.png)

## 安装与数据

1. 下载 [DeepViewer-0.5.1-arm64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.5.1/DeepViewer-0.5.1-arm64.dmg)，并用 [0.5.1 Release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.5.1) 中的 [SHA256SUMS.txt](https://github.com/Duoasa/DeepViewer/releases/download/v0.5.1/SHA256SUMS.txt) 校验。
2. 打开 DMG，将 `DeepViewer.app` 复制到“应用程序”。
3. 打开应用并配置模型提供方或订阅账户。无需全局安装 Node.js 或 Harness。

本地服务仅监听随机 loopback 端口。安装版数据固定存放于 `~/Library/Application Support/DeepViewer`，开发版固定存放于 `~/Library/Application Support/DeepViewer Dev`。覆盖安装应用不会替换这些目录；首次迁移会先复制、校验并保留备份。重大升级前仍建议自行备份。

0.5.1 Build 91 安装包已全新构建，完成 Developer ID 签名和 Apple 公证。bounded smoke 共 121 项通过；包体净化、完整性和运行时验证证据见 [0.5.1 发布记录](docs/sdd/releases/v0.5.1.md)。

真实用户环境扫描受保护的 Office 字体目录可能等待，字体权限仍需人工验收。本次仅发布安装包，不发布自动更新 feed。

## 开源引用与 DeepViewer 修改

| 组件 | 来源与许可证 | DeepViewer 的修改 |
| --- | --- | --- |
| Agent 内核与原生壳 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，MIT，固定在 `639ed015397290b3745d163aafe02ffee4aa3f84`（`0.2.0-rc.2`） | 官方 Electron/DesktopHost 加 [DeepViewer adapter](apps/deepviewer-adapter) 与经过检查的兼容契约；Agent Loop 仍由上游维护。 |
| 桌面源码基线 | [Duoasa/scoder](https://github.com/Duoasa/scoder)，`0.7.0 / Build 43`，固定在 `e277adc6ce512655095e6f65c63bdc72d24bae95`；保留原始版权说明 | 恢复 DeepViewer 品牌、包名/更新目标和数据隔离，保留原生功能，修复元数据变化引发的界面热卸载；不导入 Scoder 发布记录与用户数据。 |
| 订阅与图片工具 | [V1ki/dsh-plugin-subscriptions](https://github.com/V1ki/dsh-plugin-subscriptions)，MIT，`0.3.1` | 内置 DSH 0.2.0 兼容模块，限定范围 RPC/loopback 检查、剩余额度显示及图片生成状态样式。 |
| 侧栏来源 | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)，MIT | 独立插件退出挂载，工作台由 Harness 原生面板承接；复用工作流代码保留来源与版权。 |
| 模型能力 | [DeepViewer model-capabilities 模块](apps/dsh-plugin-model-capabilities)，MIT，`1.0.2` | 提供方/模型扫描和推理/多模态配置，替代旧 `dsh-plugin-reasoning` 挂载并承接支持的设置。 |
| 会话图谱 | [Vendored Synapse 源码](apps/deepviewer-adapter/workflows/vendor/synapse)，保留原始许可证和来源记录 | 在 DeepViewer adapter 中内置会话图谱集成。 |

历史第一方预览插件已停用，改用 Harness 官方预览。[dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard) 曾参与评估，现已移除，Runtime 不再包含 Taskboard。上游版权和第三方许可证仍归各项目所有。

## 从源码构建

需要 macOS arm64、Node.js 24+、pnpm 11.19.0，以及选为当前开发工具链的 Xcode 26 或更新版本。开发应用和安装包均需使用 Apple `actool` 编译原生 `.icon` 资源。bootstrap 获取固定的 Harness 源码并应用经过检查的适配契约，不依赖用户数据或预构建应用。

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install --frozen-lockfile
node apps/deepviewer-desktop/scripts/bootstrap-native-upstream.mjs
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm desktop:dev
```

`pnpm desktop:dev` 会构建并启动使用独立数据目录的 DeepViewer Dev；`pnpm desktop:dev:restart` 重启本项目开发进程，`pnpm desktop:build` 仅构建、不启动。开发构建会递增本地 Build 号。

基础验证使用 `pnpm typecheck` 和 `pnpm desktop:smoke`，原生集成及适配契约检查见 [CI 流程](.github/workflows/ci.yml)。`pnpm desktop:preview` 制作本地预览包；`pnpm desktop:release` 准备签名 arm64 DMG/ZIP，需要设置 `DEEPVIEWER_SIGN_IDENTITY`、`DEEPVIEWER_TEAM_ID` 和 `DEEPVIEWER_NOTARY_PROFILE`，不会自动发布。签名/公证凭据留在本机，notary profile 保存在钥匙串。

[0.3.3 源码快照说明](upstream/snapshots/v0.3.3/README.md)保留为 Build 75 的历史复现指南，不用于 0.5.0 及之后版本的构建。

[SDD 文档](docs/sdd/README.md)记录架构、插件来源、需求和验证。DeepViewer 原创代码采用 [MIT License](LICENSE)；各上游许可证继续适用。

问题反馈请到 [GitHub Issues](https://github.com/Duoasa/DeepViewer/issues)，不要附带凭据、私有文件或未脱敏日志。
