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

| ID | 插件 | 固定版本 | 状态 | 最近验证内核 | 最近结论 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| `DVP-0001` | [`dsh-plugin-subscriptions`](https://github.com/V1ki/dsh-plugin-subscriptions) | `0.3.1` | `Active` | DeepSeek Harness `0.1.0-rc.7` | 自动检查、真实账户登录及双架构正式封包通过；实际调用与登出待人工复验 | [DV-0011 验证](../specs/DV-0011-subscription-provider-integration/verification.md) |
| `DVP-0002` | `@deepviewer/dsh-plugin-preview` | `0.1.0` | `Active` | DeepSeek Harness `0.1.0-rc.7` | 自动检查、维护者迭代交互验收及双架构正式封包通过 | [DV-0012 验证](../specs/DV-0012-preview-sidebar-plugin/verification.md) |

### DVP-0001：订阅提供方

- 用途：接入订阅账户登录、状态/用量展示，以及插件提供的模型和工具。
- 激活边界：开发版与正式 Runtime 默认启用；`DEEPVIEWER_DISABLE_SUBSCRIPTIONS=1` 可安全停用并退回纯核心。
- 展示适配：`deepviewer-remaining-usage-v1`；插件升级时必须重新验证 client 锚点、剩余量语义和
  中英文文案。
- 数据与安全：`v0.2.1` 公开预览版批准使用隔离 DSH home 下的原子 `0600` 文件作为临时等价
  方案；稳定版前仍须完成 Keychain 迁移或重新批准安全边界。
- 当前限制：外部订阅服务并非稳定公共协议；真实账户登录已通过，状态/用量、实际调用与登出
  仍需人工冒烟。

### DVP-0002：代码与网页预览

- 用途：在右侧详情栏浏览工作区文本文件，并隔离预览静态网页。
- 激活边界：开发版与正式 Runtime 默认启用；`DEEPVIEWER_DISABLE_PREVIEW=1` 可停用并保留订阅/纯核心启动。
- 上游接点：`details` owner props、`conversation.details.view`、会话标题栏 action、Connection RPC、
  WebServer prefix route 和 deliverables turn data。
- 数据与安全：仅允许已登记工作区；RPC 为 loopback-only；静态站使用短期 capability、路径/符号
  链接 containment、敏感路径 deny list、响应 CSP 与无同源权 iframe。
- 当前限制：首版仅预览静态站点，不接受任意 dev-server URL；外部编辑依赖手动刷新。

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
