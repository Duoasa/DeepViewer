# DV-0012：设计

## 结构

1. `ui-layout` 的详情状态增加 active view，并把它作为 `details` owner props 传入。
2. `ui-conversation` 的 `DetailsPanel` 声明 `conversation.details.view` list slot；原工具内容成为
   `tool` 条目，预览插件登记 `preview` 条目。
3. `@deepviewer/dsh-plugin-preview` Host 半注册 `/deepviewer-preview` RPC 与静态路由；Browser 半在
   `shell.overlay` 登记窗口级固定开关，并登记 preview 详情条目。macOS 使用 48px 结构安全区提供的
   控件偏移变量，使开关与左侧栏开关垂直对齐；Web 表面使用同组件的默认右上角偏移。
4. 工作区文件标题使用单个全宽原生按钮，标题和箭头属于同一命中区域；箭头仅表达当前折叠状态，
   不形成嵌套按钮或独立热区。

## 文件协议

- Browser 只发送 `workspaceId` 和 POSIX 风格相对路径。
- Host 从 `workspaceRegistry` 解析根目录，对目标执行 lexical containment 与 `realpath` containment。
- `list` 返回一层目录；`read` 返回 UTF-8 文本、大小、修改时间和语言提示；`site` 签发随机短期 URL。
- deny list 覆盖 `.git`、`node_modules`、`.env*`、私钥/证书及常见密钥文件名。

## 网页隔离

- iframe 使用 `sandbox="allow-scripts"`，不含 `allow-same-origin`、弹窗、下载或顶层导航权限。
- 静态响应 `no-store`、`nosniff`、`no-referrer`，CSP 默认只允许当前 capability 路由、data/blob
  图片与内联样式/脚本；禁止任意外部连接。
- capability 仅在 loopback-only RPC 成功后签发，绑定工作区与入口目录，过期后失效。
- Host 仅对 HTML 响应追加最小导航桥；桥通过 `postMessage` 回报当前标题和 capability 内地址，并
  接收后退、前进和重载命令。父页面同时校验消息来源窗口，iframe 继续保持 opaque origin。
- 网页标题栏与代码语言标题栏使用同一纵向分隔逻辑，标题栏空白区域为指针拖动热区；浏览器按钮和
  地址输入保留各自交互。地址解析拒绝协议、authority、绝对路径和 `..`，只生成当前 capability 根
  内的目标。系统浏览器打开使用一次显式标记，由 Electron 主进程仅对同 Runtime origin 的
  `/deepviewer-preview-static/` 路径剥离标记后放行。

## 刷新

Browser 从 conversation timeline 的 `deliverables` turn data 计算最后成功产出序号；序号变化后去抖
重读当前文件并更新 iframe cache-buster。刷新按钮执行同一路径。
