# Verification

Status: Implementing
Target: DeepViewer 0.3.3 Build 75, DSH 0.1.5-rc.2

- AC-001/002/003 — Pass: desktop vitest `test/user-data-migration.test.ts test/resource-locator.test.ts test/app-lifecycle.test.ts test/runtime-manager.test.ts`，31 项通过；development-workflow 的 profile 用例 1 项通过。涵盖已有目标和多个旧源、字节备份、附件/配置/凭据权限、会话完整单元、工作区合并、重复启动、删除不复活、各发布节点中断、未知 schema、异常链接、活跃旧实例与复制期间源变化。
- AC-002/003 — Pass: `node --expose-internals apps/deepviewer-desktop/scripts/smoke-user-data.mjs`（Node 24、先 build:official）。真实 DSH persistence 读取合成 Work/Chat 历史，目录导入后执行 v2→v3 Zstandard 格式迁移并再次启动；两类各 8 个事件内容一致，预设及 cwd 不变，源文件字节不变。
- R-005 — Pass: upstream vitest `packages/api/session-controller/tests/{deepviewer-cold-mode-list,session-search,session-projections,session-list-blank}.host.spec.ts`，54 项通过。覆盖无 cwd 的冷 Chat、有 cwd 但后续预设切为 Chat、空缓存、重复冷启动、模式搜索、宿主私有投影不外泄、通用搜索不额外读取日志。
- AC-004 — Pass: desktop typecheck、desktop Vite build、Harness build:official（包括 host/client 类型检查与构建）通过。首次本地导入来自两个开发目录，共 81 个原会话；初次启动后全数可读、历史语义摘要一致、源快照逐文件摘要一致、131 个附件摘要一致。7 处配置差异保留在本地迁移报告及双方快照；旧版本源目录不变。
- AC-004/R-005 — Pass: 追加真实数据只读后端列表冒烟（清空内存分类缓存，不激活 Agent）返回全部 12 个持久 Chat；源快照与新目录的 Work/Chat 和 cwd 均一致。正常打开会话可追加配置事件，不把这类正常写入误报成迁移覆盖。
- AC-004 — 开发版启动日志位于固定 profile 的 logs/deepviewer.log；第二次启动显示 `layout=1 imported=false`，Runtime ready，SUBSCRIPTIONS/REASONING/BETTER_SIDEBAR 均 ENABLED，网络桥就绪。Build 75 最终启动检查见本次交付说明。
- AC-005 — Pending Manual: 最终界面由维护者确认。Build 74 的手动反馈暴露分类缓存依赖问题，已在 Build 75 中修复；不得把先前 81 个文件可读等同于完整 UI 验收。

本规格的原开发切片只构建和启动源码开发版；维护者随后另行授权 DV-0032 公开发布 0.3.3。0.3.2 已固化应用、DMG、标签及私有远端不变。Active DVP-0001/0003/0004 加载通过；账户配置来自原主源并保留备份，真实账号调用与界面仍由维护者确认。其他现有测试的历史失败未作为本次扩大修复范围。
