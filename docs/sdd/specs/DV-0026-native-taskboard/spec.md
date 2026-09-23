---
id: DV-0026
status: Superseded
owner: Duoasa
created: 2026-09-21
---

# Taskboard 原生集成（已撤销）

2026-09-21：维护者要求完整移除 Taskboard 集成。以下为撤销前的历史规格，不再指导实现或要求验收。移除覆盖入口、依赖、专用源码与测试、staging、启动和 Runtime 构建引用，以及开发版专用数据。其他插件和用户会话保持不变。

维护者直接要求将 chuspeeism/dashi-taskboard 原生集成 DeepViewer，授权本规格范围。
目标内核保持 DSH 0.1.5-rc.2，官方基线 fb2c4b9e698e30edb738bca4cf0618587db7d203；
当前本地派生不变。现有 Active 插件为 DVP-0001、DVP-0003、DVP-0004，新增 DVP-0005。

## 需求

- R-001：固定上游提交 1528a8eb31466829ca5a9fd436f4dfd285694a74（Taskboard 1.1.24，DSH 入口 1.0.0），保留 Apache-2.0 许可证及来源。开发 staging 和 Runtime 构建均内置前端、服务与依赖。
- R-002：通过 DSH 原生 sidebar.footer.action 显示“任务面板 / Taskboard”，在 DeepViewer 中打开原看板界面，支持项目、任务、状态、评论及附件的原有操作；主题和语言跟随宿主，关闭返回当前会话。
- R-003：服务由 DSH 插件生命周期管理，复用已认证的同源 HTTP 服务；不启动另一个 Taskboard 应用、Codex 注入器或公开监听端口。数据位于当前 DeepViewer DSH home 的 taskboard 子目录。
- R-004：保留用户现有会话和所有 Taskboard 独立应用数据。Codex 专用运行、云连接与宿主控制不得在 DeepViewer 中隐式启用；不可用的宿主动作应明确反馈或隐藏。
- R-005：默认启用，提供 DEEPVIEWER_DISABLE_TASKBOARD=1；缺包、版本不符或插件加载失败能回退到现有 DeepViewer 插件组合。
- NFR-001：不修改 Agent loop，不降低 DSH cookie/Origin 鉴权，不读取 Codex 私有状态。仅本地构建和基础验证，不提交、发布或制作安装包。

## 验收

- AC-001（R-001）：来源与锁文件固定，前端和插件构建通过；Runtime 输入包含服务、前端、许可证及运行依赖。
- AC-002（R-002、R-003）：隔离 DSH Host 挂载插件，已认证页面/API 可用；项目与任务创建、状态修改、评论和重新打开后的持久化有证据。
- AC-003（R-003、R-004、NFR-001）：未认证/跨 Origin 请求被拒绝，用户数据隔离，Codex 专用能力不被隐式调用。
- AC-004（R-005）：正常、禁用、缺包和启动失败回退通过基本检查。
- AC-005（R-002）：开发版启动就绪，任务面板与深浅主题、布局、实际交互由维护者验收（Pending Manual）。
