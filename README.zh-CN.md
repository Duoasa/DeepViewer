# DeepViewer

DeepViewer 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的独立开源 macOS 工作台。它将 Agent 内核封装为 Apple Silicon 桌面应用，并加入 Work / Chat 空间、文件交付、侧栏工作台和桌面控制。DeepViewer 是社区项目，不是 DeepSeek 官方产品。

**当前版本：0.3.3（Build 75）** · DeepSeek Harness `0.1.5-rc.2` · macOS Apple Silicon（arm64）

[下载经 Apple 签名、公证的 DMG](https://github.com/Duoasa/DeepViewer/releases/tag/v0.3.3) · [English](README.md) · [发布记录](docs/sdd/releases/v0.3.3.md)

<p align="center"><img src="Resources/screenshots/image-delivery.png" width="1100" alt="DeepViewer 将生成图片作为附件卡片交付，并在右侧栏正常预览"></p>

## 相比上一公开版本 0.2.5 的功能变化

| 领域 | 0.3.3 的变化 |
| --- | --- |
| Work 与 Chat | 将依赖工作区的 Work 会话与无工作区的 Chat 历史区分；可从侧栏创建项目、搜索 Chat 历史。重启后无需逐条打开会话，也能从持久记录恢复模式和标题。 |
| 文件与预览 | 生成的图片及其他文件以附件卡片交付。将工作区外或无后缀的产物复制到会话工作区，并根据真实类型补齐扩展名，使卡片和侧栏预览指向同一文件。 |
| 侧栏工作台 | 集成开源 Better Sidebar，提供文件、编辑器、终端、Git 和浏览器面板；桌面适配窗口控件、相对文件路径、导航与鉴权。 |
| 模型能力 | 增加第一方推理与多模态能力编辑器，按模型进行有边界的能力扫描；扫描通过不等于提供方的所有功能均已实测。 |
| 过程与外观 | 同类上下文和操作合并为可展开摘要，字号与多模态状态跟随会话字号；加强悬停反馈，增加图片生成流光，以及侧栏 12 × 12 px Drive 运行指示。设置布局和系统外观与桌面壳对齐。 |
| 网络 | 内置 Runtime 采用系统代理/PAC，保留显式代理配置；连接错误更清晰，访问内网地址前请求限定范围的授权。 |
| 升级连续性 | 安装版与开发版分别使用固定数据目录。首次启动带备份导入同渠道旧会话和附件；后续应用及 Harness 升级继续使用固定目录。冷启动列表从持久事件恢复 Work/Chat 分类。 |

本版**不包含**已经移除的 Taskboard 集成。部分提供方、侧栏及迁移数据流程仍需真实账户和界面人工验收；验证边界见[发布记录](docs/sdd/releases/v0.3.3.md)。

### Work、Chat 与过程披露

Work 按项目组织会话，Chat 可以脱离工作区保存对话。两种模式都能在启动后恢复历史；同类上下文、思考、搜索和操作会合并为可展开的摘要。

![Work 项目与会话历史](Resources/screenshots/work-session.png)

![独立 Chat 与展开的过程披露](Resources/screenshots/chat-and-disclosure.png)

### 文件与侧栏工作台

侧栏可以查看工作区文件、预览生成的 HTML，并与对话并排浏览网页。文件路径、面板导航和浏览器访问都与当前桌面会话关联。

![Work 对话右侧打开网页](Resources/screenshots/browser-workbench.png)

![在侧栏预览生成的 HTML 页面](Resources/screenshots/html-preview.png)

### 图片生成与附件交付

生成文件以具有可用名称和后缀的附件卡片交付。即使图片最初生成在工作区外，也会复制到会话工作区，让附件与侧栏预览指向同一个文件。

![生成图片的附件卡片与侧栏预览](Resources/screenshots/image-delivery.png)

![图片生成结果、过程披露与侧栏预览](Resources/screenshots/image-generation.png)

### 外观与版本信息

设置页跟随桌面外观，“关于”页面展示应用构建号和内置 Harness 版本。

![关于 DeepViewer 显示 0.3.3 Build 75 与 Harness 0.1.5-rc.2](Resources/screenshots/about-version.png)

## 安装与数据

1. 在 [Release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.3.3) 下载 `DeepViewer-0.3.3-macos-arm64.dmg`，并用 `SHA256SUMS.txt` 校验。
2. 打开 DMG，将 `DeepViewer.app` 复制到“应用程序”。
3. 打开应用并配置模型提供方或订阅账户。无需全局安装 Node.js 或 Harness。

本地服务仅监听随机 loopback 端口。安装版数据固定存放于 `~/Library/Application Support/DeepViewer`，开发版固定存放于 `~/Library/Application Support/DeepViewer Dev`。覆盖安装应用不会替换这些目录；首次迁移会先复制、校验并保留备份。重大升级前仍建议自行备份。

公开安装包从明确允许的代码、固定 Runtime、资源和许可证全新构建，不包含维护者的会话、工作区、设置、日志、账户凭据、开发机主目录路径或交接文件。签名发布前会检查包体。

## 开源引用与 DeepViewer 修改

| 组件 | 来源与许可证 | DeepViewer 的修改 |
| --- | --- | --- |
| Agent 内核 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，MIT，固定在 `fb2c4b9e698e30edb738bca4cf0618587db7d203`（`0.1.5-rc.2`） | 桌面集成及[可复原源码补丁](upstream/snapshots/v0.3.3/README.md)，覆盖 Work/Chat、会话恢复、文件交付、过程披露、主题和网络桥接；Agent Loop 仍由上游维护。 |
| 订阅与图片工具 | [V1ki/dsh-plugin-subscriptions](https://github.com/V1ki/dsh-plugin-subscriptions)，MIT，`0.3.1` | DSH 0.1.5 兼容适配、限定范围 RPC/loopback 检查、剩余额度显示及图片生成状态样式。 |
| 侧栏工作台 | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)，MIT，`0.19.1` | macOS 窗口和设置适配、原生面板路由、会话相对路径、桌面浏览器与鉴权集成。 |
| 模型能力编辑器 | [DeepViewer 第一方插件](apps/dsh-plugin-reasoning)，MIT，`0.1.0` | 提供方/模型扫描，以及推理和多模态能力的手动配置。 |

历史第一方预览插件已停用，改用 Harness 官方预览。[dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard) 曾参与评估，现已移除，Runtime 不再包含 Taskboard。上游版权和第三方许可证仍归各项目所有。

## 从源码构建

需要 macOS arm64、Node.js 24+ 和 pnpm 11.19.0。仓库中的补丁可以从固定的 Harness 提交还原本版确切源码，不依赖用户数据或预构建应用。

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install --frozen-lockfile
git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout fb2c4b9e698e30edb738bca4cf0618587db7d203
git -C upstream/deepseek-harness apply --whitespace=nowarn ../snapshots/v0.3.3/harness.patch
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm --dir upstream/deepseek-harness run build:official
pnpm desktop:build
```

`pnpm desktop:build` 会为继续开发递增本地 Build 号。[源码快照说明](upstream/snapshots/v0.3.3/README.md)提供复现固定 Build 75 的 Runtime 封包、Developer ID 签名与 Apple 公证步骤。签名凭据只保存在本机钥匙串，不提交到仓库。

[SDD 文档](docs/sdd/README.md)记录架构、插件来源、需求和验证。DeepViewer 原创代码采用 [MIT License](LICENSE)；各上游许可证继续适用。

问题反馈请到 [GitHub Issues](https://github.com/Duoasa/DeepViewer/issues)，不要附带凭据、私有文件或未脱敏日志。
