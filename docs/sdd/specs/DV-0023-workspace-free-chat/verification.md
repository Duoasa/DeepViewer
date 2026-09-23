# DV-0023 Verification

Status: Implementing. Automated checks completed 2026-09-20; visual acceptance Pending Manual.

- AC-001 Pass: Host create rejects Chat workspaceId/cwd; full `dsh web` smoke creates Chat while registry remains empty.
- AC-002 Pass: actual full Host with DVP-0001, DVP-0003 and DVP-0004 exposes exactly web_fetch/web_search in Chat; standard Work exposes 29 tools. Scope mask and final dispatch guard installed on create/resume. Unit tests cover rejection of shell/files/delegation/sidebar tools.
- AC-003 Pass: isolated full Host stopped and restarted with the same DSH home; a valid persisted conversation and preset restore, with the same bounded tool catalog. Client tests cover immediate creation projection and cold list restoration.
- AC-004 Automated Pass / Pending Manual: 153 related session/navigation/attachment tests passed; final agent+sidebar tests 70 passed, including Chat-only rows and mode selection. Full Host+Client TypeScript, tsdown bundles and Vite production build passed. No real-account model requests made.

Commands: Node 24 + `node_modules/vitest/vitest.mjs run` on api/session-controller tests (agent, commands-create-fork, commands-upload-file, chat-attachments, manager) and ui-workspace tests (workspaces-service, rows, workspace-browser). Build: tsc -b tsconfig.host.json; tsdown --env.DSH_BUILD_FACE host; tsc -b tsconfig.client.json; tsdown --env.DSH_BUILD_FACE client; Vite build in apps/web, using officialClientBuildEnvironment.

Logs: /private/tmp/deepviewer-chat-tests.log; deepviewer-chat-final-tests.log; deepviewer-chat-build.log. Full isolated persistence harness: /private/tmp/deepviewer-chat-smoke/run.py, result-1.json and result-2.json (both ok:true, second restored:true).

Regression expansion: 584/587 UI tests passed. Three skeleton tests expect removed legacy hero copy (Into the Unknown / 探索未至之境). Re-running against the pre-Chat ConversationRoot and InputBar reproduces exactly those three failures; baseline log /private/tmp/deepviewer-chat-baseline-tests.log. Not modified or skipped.

Durable override reproduction and idempotence checked on an isolated tree. No public upload, package generation, frozen artifact replacement or user-data migration.

Limitations: first version handles images through existing model capability checks and uploaded UTF-8 text (256 KB combined per message). Binary documents require text export. Actual provider web-search availability and real-account streaming/model-switching remain manual acceptance. Chat-to-Work context transfer is deferred.

Source development app launched against the existing Dev data directory. Runtime ready at 2026-09-20T02:27:50.891Z; all three plugin diagnostics enabled, no fallback. Frozen installed app and DMG unchanged.

## 0.3.0 固化补充
Chat/Work 共用标题栏、20px 区域间距、Chat 仅保留搜索。DeepViewer 启用按需本地索引及正文片段匹配，涵盖中文短词；搜索结果限定当前模式。展开搜索取消残余缩进与越界宽度。152 项 SQLite/API/UI 搜索相关测试通过；Host/Client/Web 构建通过。维护者要求自行测试，最终视觉与真实交互仍 Pending Manual。修复运行时旧端口认证 Cookie 累积导致插件请求 HTTP 431；4 项定向测试通过，不触及侧栏浏览器会话分区。

## 0.3.2 固化补充 · 2026-09-22

Chat 历史及搜索列表加入与 Work 相同的 listArea 容器，补偿滚动区右侧 12px 留白。54 项 WorkspaceBrowser 测试再次通过。此前隐藏 Electron 在 260/320/420px 宽度、2/40 行有无溢出的六组布局中，新会话按钮与选中框左右边缘差均为 0px；旧布局可复现右侧短 12px。原有两项样式断言（group gap、project row height）与更早 CSS 不一致，本轮未改动相关 CSS。视觉验收 Pending Manual。
