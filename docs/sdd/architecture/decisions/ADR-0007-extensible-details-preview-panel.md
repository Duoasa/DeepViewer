---
id: ADR-0007
title: Extensible details column and workspace-scoped preview plugin
status: Accepted
date: 2026-08-18
supersedes: []
---

# ADR-0007：可扩展详情栏与工作区范围预览插件

## 背景

DeepViewer 需要类似 Codex 的代码与网页预览侧栏。DSH rc.7 的右侧 `details` 槽当前由
`ui-conversation` 单独占用，只能显示工具详情；直接替换会复制核心行为，先放入主内容区又不符合
产品目标。预览还需要读取工作区文件并运行用户生成的 HTML，必须建立独立的安全边界。

## 决策

- 把右侧详情栏扩展为可登记的标签容器；工具详情保留为内置标签，其他 DSH client 插件通过
  additive list slot 入驻，不替换整列。
- 布局服务只保存当前详情标签与列宽；工具选择显式打开工具标签，预览入口显式打开预览标签。
- 预览以固定版本的第一方 DSH 双端插件实现。Host 端通过 loopback-only RPC 列出和读取已登记
  工作区内的文件；Browser 端负责文件树、只读高亮和预览交互。
- 静态网页通过短期随机 capability URL 服务，服务根固定在已验证的工作区目录内；路径穿越、
  符号链接逃逸、敏感目录/文件、超限和非 GET/HEAD 请求均拒绝。
- 网页运行在不带 `allow-same-origin` 的 sandbox iframe 中，并由响应 CSP 限制外联。首版不接受
  任意 dev-server URL，也不提供编辑、终端或运行命令能力。
- 自动刷新使用 DSH 已有的产出文件数据；手动刷新始终可用，不新增文件系统常驻 watcher。

## 后果

### 正面

- 一次完成真正的右侧预览体验，避免先做主区标签再推翻。
- 工具详情和后续详情类插件可以并存，扩展点保持 additive。
- 源码读取、活动 HTML 与应用主页面分离，权限面可测试、可禁用。

### 代价与风险

- 需要维护一组受控的 rc.7 client slot/layout 覆盖，并在内核升级时重新验证。
- sandbox 静态预览不保证依赖任意外部 API、浏览器存储或开发服务器的应用完整运行。
- 产出事件只覆盖 DSH 可识别的成功文件修改；外部编辑依赖手动刷新。

## 备选方案

- 主内容区 `conversation.view`：拒绝作为首版，形态不符合侧栏目标且会产生迁移成本。
- 替换整个 `details` owner：拒绝，会复制并长期追赶工具详情实现。
- 直接 iframe 任意 URL：后置，需要单独处理本机端口访问、导航、来源信任和网络策略。

## 后续行动

- 由 DV-0012 实现详情标签扩展与预览插件。
- DSH 内核升级按 `DVP-0002` 检查 slot、RPC、静态路由和 sandbox 行为。
