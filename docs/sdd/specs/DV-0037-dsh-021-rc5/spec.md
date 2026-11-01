# DV-0037 — DSH 0.2.1-rc.5 内核适配

Status: Implementing
Owner: Duoasa
Date: 2026-11-01
Approval: 维护者直接要求把内核从 0.2.1-rc.2 升到 0.2.1-rc.5 并开 PR。不合并、不打 tag、不发布 Release、不评论其他 issue 或 PR。

## Scope

固定 DeepSeek Harness `0.2.1-rc.5`，tag `dsh-v0.2.1-rc.5`，提交 `b830ec950faba0a46dda564be3e2d854afed94f1`。CI 检出同一提交。应用版本为 `0.8.0`，`previewRelease` 为 `0.8.0-preview.1`，`buildNumber` 仍是 93。README 与发布记录已写到这个状态。保留 DeepViewer 的统计行、Synapse 地图、侧栏与品牌行为，并接入上游 rc.3–rc.5 的视图/面板 More 菜单。DSH-to-Figma vendor 为已发布的 0.3.1。

已读取 [`dsh-plugins.md`](../../integrations/dsh-plugins.md)。Active 模块：

- DVP-0001 subscriptions `0.3.1`
- DVP-0006 model-capabilities `1.0.2`
- DVP-0007 adapter `0.8.0`
- DVP-0008 DSH-to-Figma `0.3.1` / tag `v0.3.1` / `baa6054e73490afeba775328a248bb5bc0da8586`

DVP-0002 保持 Disabled。DVP-0003、DVP-0004、DVP-0005 保持 Removed。

## Requirements

- R-001: 适配层与桌面脚本中的内核版本和提交固定到 rc.5；重复应用契约幂等，且不修改 Agent loop。
- R-002: 会话统计行、Synapse 空白地图 tab，以及上游 `entryPins` / `entryActions` / `setPinned` 同时成立。补丁后的 `ConversationSession.tsx` 只有一处 `visibleTabs` 绑定。
- R-003: 侧栏整文件样式保留 rc.5 的 `.moreAnchor`、`.moreMenu`、`panelRow[aria-expanded='true']` 和展开态 `gap: 2px`，并更新 sha256 守卫。
- R-004: model-capabilities 的 `@deepseek-ai/dsh-*` peer 固定到 `0.2.1-rc.5`，并重新生成 shrinkwrap。subscriptions 0.3.1 继续由适配脚本改写 peer。
- NFR-001: 不放宽 Figma peer 检查。vendor 换成已发布的 DSH-to-Figma 0.3.1，其 peer 范围包含 rc.5。不写用户 profile，不改 Agent loop。

## Acceptance

- AC-001: 版本/提交一致；干净上游上契约应用两次幂等；Agent loop 未被契约修改。
- AC-002: 补丁后的会话头文件可通过上游 typecheck 或 core build；统计行、More 截断和空白地图 tab 的自动检查通过。
- AC-003: 侧栏样式守卫与上游 sidebar-styles / panel-list 检查通过。
- AC-004: Active 模块的自动 PC 检查有记录。真实账户、真实 Figma 和未覆盖的界面交互保持 Pending Manual。
- AC-005: 固定的 DSH-to-Figma 0.3.1 通过既有 semver peer 检查，staging 带上 `assets/companion/FEATHER-LICENSE`，本地工具能注册。不放宽检查。

## Decisions

- D-101: 保留上游会话视图 More 和侧栏面板 More，不隐藏 `entry-customization`。统计行包在 tab 簇外侧；tablist 仍是 `.viewTabs`，More 仍是它的下一个兄弟。空白 `hideChrome` 只显示 Chat 与 Map，不做 More 截断，也不渲染 More 按钮或统计。
- D-102: `session.moreViews`（更多会话视图 / More conversation views）、`panels.more`（更多 / More）以及 entry-customization 的 “DSH plugin” 文案保持上游原文。它们是功能标签或插件格式说明，不是 DeepSeek Harness 产品名。
- D-103: `entry-customization` 继续由上游 `packages/bundle/web-app/cordis.patch.yml` 注册，并由 web-app 的 workspace 依赖带入。DeepViewer 不另注册、不禁用。
- D-104: `kernel-v020` 仍是 0.1.5-rc.2 数据备份目录。rc.3–rc.5 没有存储格式迁移说明，不新增快照目录。
- D-105: subscriptions 0.3.1 的 DSH peer 改写目标改为 `0.2.1-rc.5`。既有 Cordis peer 改写仍写成 `4.0.4`；rc.5 与 rc.2 一样携带 Cordis 4.0.5。本次不改这条既有改写。
- D-106: `apps/deepviewer-desktop/upstream-overrides/chat-mode/patches.json` 只被 `sync-chat-mode.mjs` 引用，当前原生构建不调用它。本次不改。
- D-107: rc.4 的 `conversation.chat.reasoning.body` `rawText` 变更不改 DeepViewer。已移除的 reasoning 插件和 model-capabilities 都不渲染该插槽。
- D-108: 导航行是 flex，间距 16px。`.navigationRow .tabs` 使用 `flex: 1 1 0; width: auto; min-width: 0`，占据统计内容宽度之外的剩余宽度，供 `floor((clientWidth - 48) / 120)` 使用。`.headerCenter` 使用 `flex: 0 1 auto`，宽度等于统计内容，内容在该盒子内居中。不再把行宽对半拆开。800px 行且统计内容宽度为 0 时，tab 簇为 784px，可见预算是 6；与上游整行 800px 的 6 个相同只在统计内容宽度为 0 时成立。有实际统计内容时还要再减去该宽度。对半拆开时同一公式只有 2 个。
- D-109: 纳入已发布的 DSH-to-Figma 0.3.1（签名 tag `v0.3.1`，提交 `baa6054e73490afeba775328a248bb5bc0da8586`）。peer 范围包含 `0.2.1-rc.5`，staging 仍用 `semver.satisfies`，不放宽。白名单增加整个 `assets/companion`，因为 `prepareCompanion` 要读 `FEATHER-LICENSE`。不新增 `figma-native-v2`：配置仍是 `backend` 与 `bridgePort`，私有 companion 仍由桥接启动时写到 `DSH_HOME/figma`；已导入 Figma 的旧 companion 需要用户重新导入才能得到 featureVersion 3，插件自己会提示，profile 迁移改不了 Figma 桌面里的插件。上游 README 与生成的 README.txt 仍写默认端口 3055；DeepViewer 安装版是 3065、开发版是 3066，生成的 manifest 会改成实际端口。
- D-110: rc.5 使用 `Promise.withResolvers`（Node 22 起）。当前没有路径把内核跑在 Node 20 上，因此不改 engines，也不新增 `.nvmrc`。Electron 44.7.0 内置 Node 24.21.0；primary-runtime 锁定 Node 24.21.0；`node-bin` 转调 Electron；根 `engines.node` 已是 `>=24.0.0`；内核与 model-capabilities 为 `^22.19.0 || >=24`；CI 使用 Node 24。`resolveHarnessLaunch` 会拒绝不满足该范围的 Electron Node。

## Non-goals

- 不合并、不打 tag、不发布 Release。
- 不改 `vendor/dsh-to-figma/UPSTREAM.json` 里已经固定的文件哈希。
- CI 已检出 `b830ec950faba0a46dda564be3e2d854afed94f1`。应用版本、previewRelease、buildNumber、发布记录和 README 已由本分支更新，不再当作未处理项。

## Rollback

恢复本分支之前的 rc.2 pin 与三处契约即可回到 0.2.1-rc.2。没有用户数据迁移。
