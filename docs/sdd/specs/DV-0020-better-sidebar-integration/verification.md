# DV-0020 验证

2026-09-19；开发版 0.2.5；DSH 0.1.5-rc.2；dsh-better-sidebar 0.19.1。

| 验收 | 结果 | 证据 |
| --- | --- | --- |
| AC-001 | Pass | pnpm-lock 固定 npm integrity；stage-better-sidebar.mjs 检查包身份、MIT、必需 chunks 与现有 DSH peer 精确版本。 |
| AC-002 | Pass | better-sidebar.test.ts 验证挂载、禁用、缺少 chunk、用户占用路径和独立回退层；既有插件回退链保持不变。 |
| AC-003 | Pass | `node apps/deepviewer-desktop/scripts/smoke-better-sidebar.mjs`：临时 DSH home、认证 settings、terminal/editor/mermaid chunks、无 cookie/跨站拒绝、原生 PTY、隐藏隔离 Electron 前端挂载均通过。无模型调用，无用户工作区写入。 |
| AC-004 | Pass / Pending Manual | 开发版日志出现 BETTER_SIDEBAR_ENABLED version=0.19.1 与 Runtime ready；人工视觉/交互验收仍 Pending Manual，不以隐藏窗口启动替代。 |

在 apps/deepviewer-desktop 运行：

- `vitest run test/better-sidebar.test.ts test/resource-locator.test.ts test/window-options.test.ts`：23/23 通过。
- `tsc --noEmit`：通过。
- 开发 runner 执行 main/preload/renderer Vite build：通过；依赖修改导致重复构建的 manifest 指纹问题已修复并测试。
- `git diff --check`：通过。

插件 PC-001—PC-003：固定包/许可证/peer/patch/真实 Host 通过。
PC-004：Electron 挂载通过；深浅色、分栏、开合等视觉验收 Pending Manual。
PC-005：资源/设置/原生 PTY 通过；文件编辑/Git/侧边对话用户流程 Pending Manual，模型终端/open 工具保持默认关闭。
PC-006：复用官方 connection.requestRejection 后未登录/跨站拒绝；插件无账号登录，不涉及 PC-009。
PC-007：缺包/禁用/回退单测通过。
PC-008：Runtime 构建入口已包含固定插件、适配标记与 chunks 校验；本轮未构建安装包，不宣称封包验证。

已保留原先 reasoning/订阅插件、Runtime 环境继承和未提交 UI 调整；无提交、发布或用户设置迁移。
