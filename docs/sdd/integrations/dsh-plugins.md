# DSH 手动集成插件登记

本文件是 DeepViewer 手动集成 DSH 插件的唯一登记表。任何 DSH 内核版本、提交、Runtime
包族或插件契约变更，都必须先读取本文件，并按下方检查项验证全部 `Active` 插件。

登记表只保留当前集成状态和最近一次验证结论。历次内核升级的详细证据保存在对应规格的
`verification.md`，避免把本文件扩展成重复的历史流水账。

## 状态定义

- `Active`：构建或运行路径会启用，内核更新必须检查。
- `Disabled`：代码或依赖仍保留，但默认不启用；恢复前必须重新完成全部检查。
- `Removed`：已退出当前产品，不再参与后续检查；保留一行用于避免编号复用。

## 当前登记

DV-0033 将旧自建外壳迁至固定 DSH 0.2.0-rc.2 / `639ed015397290b3745d163aafe02ffee4aa3f84`。
Active 模块由应用构建与原生组合负责，仍按 PC 检查，不列为用户安装插件。

| ID | 插件/内置模块 | 固定版本 | 状态 | 最近验证内核 | 最近结论 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| `DVP-0001` | [`dsh-plugin-subscriptions`](https://github.com/V1ki/dsh-plugin-subscriptions) | `0.3.1` | `Active` | DSH `0.2.0-rc.2` | 应用内置；配置保留，真实账户 Pending Manual | [DV-0033](../specs/DV-0033-scoder-native-rebase/verification.md) |
| `DVP-0002` | `@deepviewer/dsh-plugin-preview` | `0.1.0` | `Disabled` | DSH `0.1.5-rc.2` | 历史源码保留；原生 documentpreview/browser 承接，不参与当前 staging | [DV-0017](../specs/DV-0017-dsh-015-arm64-development/spec.md) |
| `DVP-0003` | `@deepviewer/dsh-plugin-reasoning` | `0.1.0` | `Removed` | DSH `0.1.5-rc.2` | 旧挂载退休，由 DVP-0006 承接；旧配置与报告保留，隔离迁移通过 | [DV-0033](../specs/DV-0033-scoder-native-rebase/verification.md) |
| `DVP-0004` | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) | `0.19.1` | `Removed` | DSH `0.1.5-rc.2` | 旧挂载退休，使用 DSH 原生右侧工作台；保留派生代码许可证 | [DV-0033](../specs/DV-0033-scoder-native-rebase/spec.md) |
| `DVP-0005` | [`dsh-codex-taskboard`](https://github.com/chuspeeism/dashi-taskboard) | Taskboard `1.1.24` / bridge `1.0.0`, commit `1528a8eb31466829ca5a9fd436f4dfd285694a74` | `Removed` | DSH `0.1.5-rc.2` | 不再参与构建或内核升级检查 | [DV-0026](../specs/DV-0026-native-taskboard/spec.md) |
| `DVP-0006` | `@deepviewer/dsh-plugin-model-capabilities` | `1.0.2` | `Active` | DSH `0.2.0-rc.2` | 应用内置；模型扫描/兼容修复/配置恢复与 v2 报告迁移自动检查通过，真实 API Pending Manual | [DV-0033](../specs/DV-0033-scoder-native-rebase/verification.md) |
| `DVP-0007` | `@deepviewer/adapter` | `0.4.0` | `Active` | DSH `0.2.0-rc.2` | 应用内置；172 项可校验契约与原生/Synapse 自动回归通过，视觉交互 Pending Manual | [DV-0033](../specs/DV-0033-scoder-native-rebase/verification.md) |

### 当前原生组合与恢复边界

- `apps/deepviewer-adapter/native-modules.patch.yml` 定义 subscriptions、model-capabilities；adapter 本身由原生 bundle 挂载。
- `DEEPVIEWER_DISABLE_BUILTINS=1` 暂停全部内置模块并退回官方核心；单项 `DEEPVIEWER_DISABLE_SUBSCRIPTIONS=1` 与 `DEEPVIEWER_DISABLE_MODEL_CAPABILITIES=1` 可安全禁用，并保留已迁移的禁用选择。
- 旧 `profiles/web`、kernel-v020 快照及模块配置备份保留；新 `profiles/desktop` 不继续挂载 reasoning、Better Sidebar 或旧 preview。用户 provider/model 设置与凭据引用原位保留。
- Runtime 使用固定上游和应用模块重新构建；这次不生成公开安装资产，不代表签名、真实更新或账户验收完成。

### DVP-0001：订阅提供方

- 用途：接入订阅账户登录、状态/用量展示，以及插件提供的模型和工具。
- 激活边界：开发版与正式 Runtime 默认启用；`DEEPVIEWER_DISABLE_SUBSCRIPTIONS=1` 可安全停用该模块；全部内置模块禁用时退回纯核心。
- 展示及接口适配：`deepviewer-remaining-usage-dsh020-v1`；插件升级时必须重新验证 client 锚点、剩余量语义和
  中英文文案。
- 数据与安全：`v0.2.1` 公开预览版批准使用隔离 DSH home 下的原子 `0600` 文件作为临时等价
  方案；本次经维护者授权的 ARM Preview 延续该存储边界，使用独立 Preview 数据目录；尚未迁移到 Keychain。
- 当前限制：本次只验证空账户状态，真实账户登录、状态/用量、实际调用与登出均待维护者验收。

### DVP-0002：代码与网页预览

- 用途：在右侧详情栏浏览工作区文本文件，并隔离预览静态网页。
- 激活边界：DV-0017 开发分支不启用此插件；官方预览不受旧 `DEEPVIEWER_DISABLE_PREVIEW` 开关控制。
- 历史上游接点：`details` owner props、`conversation.details.view`、会话标题栏 action、Connection RPC、
  WebServer prefix route 和 deliverables turn data。
- 数据与安全：仅允许已登记工作区；RPC 为 loopback-only；静态站使用短期 capability、路径/符号
  链接 containment、敏感路径 deny list、响应 CSP 与无同源权 iframe。
- 当前实现：官方 documentpreview/browser 和 sidebar-right 服务负责预览；桌面只保留原生文件桥接和右上角窗口控制布局。历史插件能力不得当作新核心的验证结论。

## DSH 内核更新检查表

对每个 `Active` 插件逐项检查并以这些稳定 ID 记录证据：

- `PC-001`：来源、许可证、固定版本、锁文件完整性和依赖包仍可获得。
- `PC-002`：peer 版本范围与目标 DSH 兼容，实际解析结果没有残留或重复的旧内核依赖。
- `PC-003`：插件 manifest、Node 入口、配置树、加载顺序和启动图在目标内核上有效。
- `PC-004`：Web client、必要注入边、设置入口、中英文文案和深浅主题仍可加载。
- `PC-005`：插件提供的 provider、model、tool 或其他 capability 能正确注册与调用。
- `PC-006`：OAuth、回环回调、外部浏览器、凭据存储和日志脱敏符合当前安全边界。
- `PC-007`：禁用、缺失、不兼容或启动失败时可退回纯核心，不影响 DeepViewer 启动。
- `PC-008`：Runtime 打包、manifest、许可证和路径净化正确，且不原地修改已签名的内置核心。
- `PC-009`：使用真实账户人工验证登录、状态/用量、至少一次实际调用和登出。

## 证据规则

- 内核更新规格必须列出目标 DSH 版本或提交、全部 `Active` 的 `DVP-*`，并对 `PC-001` 至
  `PC-009` 记录 `Pass`、`Fail`、`Pending` 或 `Pending Manual` 及可复现证据。
- 多个检查项可以共享同一条证据，但不能只写“插件兼容”而省略检查项映射。
- 任一 `Active` 插件存在 `Fail` 时，必须先修复，或经维护者明确批准后将其安全降级为
  `Disabled`；否则内核更新规格不得进入 `Verified` 或 `Released`。
- `Pending Manual` 按治理规则保持规格为 `Implementing`。插件新增、升级、停用或移除时，
  必须在同一次 SDD 同步中更新本登记表。
