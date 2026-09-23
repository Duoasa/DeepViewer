> 已撤销（2026-09-21）：维护者要求移除集成；下文仅保留历史记录，原安装、构建与验收步骤不再适用。

## 移除验证（2026-09-21）

- 维护者撤销集成；DVP-0005 标记 Removed，DV-0026 标记 Superseded。
- 删除专用源码、测试与 smoke/staging 脚本；移除依赖、锁文件条目、启动回退层及 Runtime 打包引用。应用源码、锁文件与桌面构建产物的 Taskboard 扫描均无匹配。
- 清理开发 staging、profile 插件链接和 Taskboard 数据目录。删除前数据库检查：2 个项目，0 个任务、评论、附件；未改动其他插件与会话数据。
- `pnpm run typecheck` 通过；`pnpm exec vitest run test/better-sidebar.test.ts test/resource-locator.test.ts test/runtime-manager.test.ts`：3 文件、17 测试通过。
- 桌面 Build 62、设置包 tsdown、Web Vite 构建通过；修改过的构建脚本 `node --check` 通过。
- 开发版重启：2026-09-21T05:56:01.492Z runtime ready；未认证 HTTP 请求返回预期 401。活动 DSH 启动参数不含 Taskboard，重启后未重建插件链接或数据目录。
- 界面由维护者自行检查；未制作安装包或发布。

# DV-0026 验证

状态：Implementing；2026-09-21 本地基础验证通过，维护者验收未完成。

- AC-001 Pass（输入验证）：依赖和 pnpm-lock 固定 GitHub commit 1528a8eb31466829ca5a9fd436f4dfd285694a74。`node apps/deepviewer-desktop/scripts/stage-taskboard.mjs` 构建原生服务与 Vite 前端；Apache LICENSE、NOTICE、自动收集的前端 third-party-licenses.md 均保留。生成的插件执行 `npm pack --dry-run --ignore-scripts --json`，139 个输入文件包含服务/shared/前端/许可证；无数据库和 node_modules。Runtime 构建脚本已使用相同 staging；未制作桌面安装包或正式 Runtime 包。
- AC-002 Pass：`node apps/deepviewer-desktop/scripts/smoke-taskboard.mjs` 使用临时 HOME/DSH_HOME 启动实际 DSH Host，验证认证 HTML、项目与任务创建、状态修改、评论、附件上传和读取、SSE 连接。重启同一隔离 Host 后任务状态、评论和附件元数据仍存在。
- AC-003 Pass：上述冒烟验证匿名与跨 Origin API 拒绝，meta 禁用 localAiChat，Codex 状态/AI/cloud 路由不可用。原生适配使用 DSH_HOME/taskboard，未读写独立 Taskboard 或 Codex 数据；构建适配不再实例化自动 Codex 项目摘要服务。
- AC-004 Pass：`pnpm exec vitest run test/taskboard.test.ts test/better-sidebar.test.ts test/resource-locator.test.ts test/runtime-manager.test.ts test/native-theme.test.ts test/sidebar-management.test.ts`：6 个文件、22 项通过。覆盖插件身份/资源检查、禁用、用户目录保护、独立 fallback launch 与既有 RuntimeManager 回退行为。`pnpm run typecheck` 通过。
- AC-005 部分自动验证 / Pending Manual：隔离 Electron 实际加载 DSH 页面，从 sidebar.footer.action 打开 Taskboard，任务可见，深浅主题更新、初始语言和关闭动作通过。桌面及 About/web 重建至 0.3.0 Build 57；开发版日志在 2026-09-21T03:19:14.514Z 记录 TASKBOARD_ENABLED，03:19:18.067Z runtime ready，无插件回退。最终布局、中文/英文切换与使用体验待维护者验收。

产品边界：保留 Taskboard 本地项目、任务、列表/看板等 UI；原仓库的 Codex 会话控制与自动化不会执行，相关宿主动作返回明确的中英文不可用提示。没有引入 DSH Agent loop 修改。
