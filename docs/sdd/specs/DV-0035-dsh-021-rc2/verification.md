# DV-0035 Verification

Status: Implementing
Date: 2026-10-19

基线为 DeepViewer 0.5.1 Build 91；固定 DSH 0.2.1-rc.2 / `687f282e8625c6b8d11ff58211a90524be2e4317`、Cordis 4.0.5、Electron 44.7.0。升级阶段产品版本与 Build 未变，已通过 PR #10 合并 main（6fada4f；主线 CI 39233976404 success）。维护者随后确认“界面没问题”并授权 0.7.1 / Build 92 arm64 签名公证安装包、GitHub Release 和 README 更新。

## 基础证据

以下命令在项目根运行，Node 24；上游由 bootstrap 固定。先安装根依赖与上游依赖，再构建，之后运行 smoke。

| AC | 状态 | 可复现证据及本次结果 |
| --- | --- | --- |
| AC-001 | Pass | `node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs`：167 契约在干净提交应用两次幂等；Agent loop 未修改 |
| AC-002 | Pass | `pnpm typecheck`；`node apps/deepviewer-desktop/scripts/build-native-desktop.mjs --core-only`：9/9 内核构建门禁，adapter/model-capabilities 类型与客户端构建通过；`node apps/deepviewer-desktop/scripts/build-native-desktop.mjs --skip-core-build`：桌面构建通过 |
| AC-003 | Pass（自动部分） | `pnpm desktop:smoke`：121；`pnpm --filter @deepviewer/desktop smoke:ui-regression`：202；`node apps/deepviewer-desktop/scripts/smoke-native-header-placement.mjs`：3；`pnpm --filter @deepviewer/desktop smoke:synapse`：Host、Client、native seams、独立 canvas fixture 通过；`node apps/deepviewer-desktop/scripts/smoke-native-host.mjs`：空会话复用、已开始会话另建、Work/Chat 隔离、重启冷历史/搜索、文件边界与恢复通过 |
| AC-004 | Pass（自动部分） | 下表 PC-001 至 PC-008；隔离 Host、更新通道、生产 runtime/ASAR 审计通过 |
| AC-005 | Partial Pass / Pending Manual | 维护者于 2026-10-19 确认升级开发版“界面没问题”；真实账户及未明确覆盖的完整交互仍待验收，规格保持 Implementing |
| AC-006 | Pass | 全新 0.7.1 / Build 92 签名公证 DMG、实际包 payload、挂载与净化通过；PR #11 和 main CI 39240356694 success；v0.7.1 Latest，公开资产大小/digest 与完整下载 SHA-256 匹配。证据见 [版本记录](../../releases/v0.7.1.md) |

附加验证：

- `node apps/deepviewer-desktop/scripts/smoke-native-adapter-contracts.mjs`：76 tests；包含上游会话复用/并发测试和 4 个 DeepViewer Chat 案例、稳定/预览更新通道、RPC 生命周期、文件保护提示、模块元数据热更新。
- `node --test --test-timeout=15000 apps/dsh-plugin-model-capabilities/test/*.test.mjs`：52 tests。
- `node apps/deepviewer-desktop/scripts/smoke-model-capabilities-host.mjs`：真实隔离 Host + 本地假模型 API；扫描、应用、恢复、手动编辑、旧报告迁移通过。
- `node apps/dsh-plugin-model-capabilities/scripts/smoke-runtime.mjs`：4 种 pi-ai payload，0 网络调用。
- `node --experimental-strip-types --test apps/deepviewer-adapter/tests/workflows.test.mjs`：2 tests。
- `node apps/deepviewer-desktop/scripts/smoke-native-web-state.mjs`：隔离 Electron origin 的草稿迁移、凭据排除、后续编辑不覆盖通过。
- `node apps/deepviewer-desktop/scripts/smoke-native-updates.mjs`：本地 HTTP Range/blockmap、跨版本重建、损坏/缺失缓存回退、哈希与 HTTP 错误拒绝通过；未执行安装。
- `node apps/deepviewer-desktop/scripts/smoke-native-renderer.mjs`：默认仅观察启动、品牌、字体、待机动画几何、最小窗口、侧栏布局；通过，`interactions:false`。实际界面验收不据此标记 Pass。
- `git diff --check` 通过；品牌资产、图标、字体与自有 CSS 均未修改。两处上游 CSS 基线差异仅为上游圆角/间距，明确保留 DeepViewer 既有值。

运行时附加证据：

- `node apps/deepviewer-desktop/scripts/prepare-native-runtime.mjs`：620 个依赖包、106 个 arm64 Mach-O；所有生产闭包中的 DSH 包均为 0.2.1-rc.2；manifest 规范化、构建路径净化与符号链接 containment 通过。
- `node apps/deepviewer-desktop/scripts/smoke-native-payload.mjs`：临时 ASAR 搬迁后实际加载 Koffi/sharp/PTY、HTML 转换、搜索、pnpm 离线插件安装/移除、Host，以及 DOCX/XLSX/PPTX 转 PDF 全部通过；临时副本自动删除，未创建安装包。
- 修复新版 Python 相对别名被 Node cpSync 改成绝对开发路径的问题；移除重复 runtime/pnpm，仅使用 primary-runtime 的 pnpm 11.28.5，并同步 release 与 versions.json。测试 ASAR 使用真实相邻 runtime 布局。

## Active 模块检查

原生构建从固定 DSH workspace 链接 peers；不使用独立候选包的历史 npm-shrinkwrap 安装内核。独立插件发行不在本轮范围。

| 检查 | DVP-0001 subscriptions 0.3.1 | DVP-0006 model-capabilities 1.0.2 | DVP-0007 adapter 0.7.1 |
| --- | --- | --- | --- |
| PC-001 | Pass：根 frozen lock、固定 0.3.1 源包及许可 | Pass：项目固定源码/许可，原生构建使用上游 frozen lock | Pass：项目源码、UPSTREAM/LICENSE 与依赖许可 staging |
| PC-002 | Pass：staged peer 0.2.1-rc.2 | Pass：DSH peers 0.2.1-rc.2、Cordis 4.0.5，类型与 Host 解析 | Pass：Cordis 4.0.5、固定 workspace 解析 |
| PC-003 | Pass：Host 启动图与 status RPC | Pass：Host 启动图、scan/apply/restore RPC | Pass：原生启动图、editor/Synapse RPC |
| PC-004 | Pass：保留用量/中英文适配测试；Client 在启动图中 | Pass：Client 构建、设置模块注入，主题使用原生能力 | Pass：202 前端回归、Synapse 字号/语言/主题同步、顶部统计 |
| PC-005 | Pass：空账户服务注册/状态 RPC；真实调用见 PC-009 | Pass：本地假 API 扫描/应用/恢复及真实 pi-ai payload | Pass：Work/Chat、会话/地图、文件编辑与工具边界 |
| PC-006 | Pass（自动边界）：存储/脱敏测试及未授权 RPC 拒绝；真实 OAuth 见 PC-009 | Pass：凭据引用、私有扫描文件、日志脱敏及未授权拒绝 | Pass：回环鉴权、目录边界、网络桥接测试；测试均用临时 profile |
| PC-007 | Pass：原生恢复与全模块关闭纯核心启动 | Pass：原生恢复与全模块关闭纯核心启动 | Pass：`DEEPVIEWER_DISABLE_BUILTINS=1` 纯核心会话创建 |
| PC-008 | Pass：固定源码生成闭包、manifest/许可、原生 ASAR 与路径净化 | Pass：同左 | Pass：同左；签名/公证不在范围 |
| PC-009 | Pending Manual：真实登录/用量/调用/登出 | Pending Manual：真实模型 API 验收 | 界面 Pass（维护者确认）；其余真实交互 Pending Manual |

## 边界与未完成验收

- 升级在独立 checkout 实施，原目录、旧上游改动及真实用户 profile 未迁移。
- 旧的完整 renderer 脚本默认包含界面点击；本轮曾运行到空 DOM 引用失败，未计为通过。已将默认切成只读启动，完整交互仅 `--interaction` 显式运行；该旧流程需维护者复核，不能替代人工验收。
- 稳定包使用原生 `latest` 策略；预览包使用原生 `nightly` 的预发布策略，仅将 feed 文件名映射回已有 `preview`。未配置官方 mandatory-update 服务。
- 初始升级阶段不生成安装包；追加发布阶段允许全新签名公证 DMG。真实账户与自动更新安装 qualification 不在本次授权的验证范围。
