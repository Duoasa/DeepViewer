> 已撤销（2026-09-21）：维护者要求移除集成；下文仅保留历史记录，原安装、构建与验收步骤不再适用。

# DV-0026 设计

- R-001：以 GitHub 固定提交 tarball 作为依赖并记录 lockfile integrity。构建脚本从该依赖复制必要服务/shared 文件并构建 React 前端，生成 dsh-codex-taskboard 原生插件包，保留上游许可证和来源元数据。
- R-002：沿用上游 DSH sidebar.footer.action 和中心区面板入口，适配 DeepViewer 顶部安全区、双语和主题消息；不另建任务业务状态。
- R-003、R-004：上游 createTaskboardServer 暴露的 request handler 挂到 DSH 同源专用前缀，前置 connection.requestRejection。数据库、附件与配置归当前 DSH home；无需额外端口或 launcher-runtime.json。仅使用原看板数据服务，隔离 Codex 私有路径并关闭 Codex 专用能力。
- R-005：开发和打包使用同一 staging，启动校验 manifest、来源版本、入口与资源。新增最外层回退，保留既有侧栏、reasoning 和订阅回退链。
