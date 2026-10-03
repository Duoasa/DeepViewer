# DV-0033 Verification

Status: Implementing
Date: 2026-10-03
Initial baseline: DeepViewer 0.4.0 Build 76; Scoder main `e277adc6ce512655095e6f65c63bdc72d24bae95`; DSH `0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84`.

Latest development evidence: DeepViewer 0.4.0 Build 88；0.5.0 arm64 signed installer 的最终 build、资产与发布证据待补齐。

## Acceptance evidence

| AC | Evidence | Status |
| --- | --- | --- |
| AC-001 | 固定 checkout；`node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs`：初始迁入 172 契约，干净源码、重复执行幂等，Agent loop 未改；Synapse Host 7、Client 11、native seams 6 项通过；原生 Host RPC/冷历史/会话图谱检查通过 | Pass (基础验证) |
| AC-002 | 原图 PNG SHA-256 `2fed65407833ae1ff677783c3885838a3db9116192ec440ccc8025fecb48323d`、ICNS `e70e7aae72a23e71621d8c31bea14db18a21408ae1b811ebdd803e01a6fc8f5b`；adapter 图标/SVG 与原件一致；app-identity 3、Dock/native-workspace 9 项通过；更新 feed/publish 仅指向 Duoasa/DeepViewer | Pass |
| AC-003 | `pnpm desktop:smoke` 包含 native/profile/user-data 45 项隔离迁移测试；Scoder/Saidex/其他渠道排除、旧 layout schema1 不重放、reasoning 配置承接与 kernel-v020 校验/回滚；模型报告 v2/v3 安全元数据迁移与原件保留通过 | Pass (隔离数据) |
| AC-004 | 根目录与固定上游 `pnpm install --frozen-lockfile` 通过；`pnpm typecheck` 通过；`pnpm desktop:smoke` 12 文件/76 项通过；模型能力 52 项通过；native UI regression 176 项通过；RPC/文件保护契约 12 项通过；production core、adapter、model-capabilities、subscriptions、Electron 主入口与独立 primary-runtime 构建通过 | Pass |
| AC-005 | 初始验证使用隔离 profile；后续获授权的白屏诊断及 Build 88 运行观察确认 root 挂载与热更新连续性。完整视觉、交互、旧会话与附件验收仍须由维护者确认 | Pending Manual |
| AC-006 | 下表记录 PC 检查；真实订阅账户/API、实际安装后数据连续性与正式自动更新仍待验收 | Pending Manual |
| AC-007 | 真实 metadata/HMR 链路及相关定向检查累计 62 项通过；最终 HMR 3 项单独重跑通过；Build 88 对 ui-renderer/ui-layout/ui-theme/connection 四个模块进行 metadata 变化后观察 180 秒，rebuilt=0，root 保持挂载 | Pass (定向运行与自动测试) |
| AC-008 | 维护者已明确授权 0.5.0 arm64 正式签名安装包与 Duoasa/DeepViewer 发布/main 合并；最终 build、签名、公证、净化审计、DMG 完整性、资产 SHA-256 和远端 digest 待实际完成 | Pending |

## Reproducible commands

```sh
pnpm install --frozen-lockfile
node apps/deepviewer-desktop/scripts/bootstrap-native-upstream.mjs
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm desktop:build
pnpm typecheck
pnpm desktop:smoke
node --test --test-timeout=15000 apps/dsh-plugin-model-capabilities/test/*.test.mjs
node --experimental-strip-types --test apps/deepviewer-adapter/tests/workflows.test.mjs
node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs
pnpm --filter @deepviewer/desktop smoke:contracts
node apps/deepviewer-desktop/scripts/smoke-native-ui-regression.mjs
node --test apps/deepviewer-adapter/tests/synapse-host.test.mjs
node apps/deepviewer-desktop/scripts/smoke-native-synapse-client.mjs
node apps/deepviewer-desktop/scripts/smoke-native-synapse-seams.mjs
node apps/deepviewer-desktop/scripts/smoke-model-capabilities-host.mjs
node apps/dsh-plugin-model-capabilities/scripts/smoke-runtime.mjs
node apps/deepviewer-desktop/scripts/smoke-native-host.mjs
```

所有 Host/model API 测试使用临时 home、fixture 凭据与本机模拟接口。初始迁入基础验证未打开/迁移真实 DeepViewer、Scoder、Saidex 或官方 DSH profile；后续授权的本机定向诊断单列如下，不把运行状态扩展为完整数据或账户验收。

首次本地构建受 sandbox tsx IPC 限制；获环境权限后完成固定核心 production build。主题 hook 名和重命名造成的重复属性已修正；随后 `node apps/deepviewer-desktop/scripts/build-native-desktop.mjs --skip-core-build` 完成最终桌面构建，复用本轮新编译的固定内核和本轮下载/校验的 primary-runtime。最终 `pnpm typecheck` exit 0。

一次 Host 恢复检查与模块重构建重叠，触发清单可见性断言；最终构建结束后串行重跑 Host 全链路通过。Synapse canvas 脚本会创建 Electron 窗口及执行指针事件，本次在 sandbox HTTP 监听被拒后未继续，不作为视觉交互通过证据。DOM/unit regression 也不替代人工验收。

## Active module compatibility

| Check | DVP-0001 subscriptions 0.3.1 | DVP-0006 model-capabilities 1.0.2 | DVP-0007 adapter（初始 0.4.0，本次目标 0.5.0） |
| --- | --- | --- | --- |
| PC-001 source/license/lock | Pass：固定 npm integrity/MIT、冻结安装 | Pass：固定导入源/MIT、构建版本校验 | Pass：固定 Scoder 来源、上游/MIT/OFL/CodeMirror 许可保留 |
| PC-002 target peers | Pass：dsh020 adapter staging | Pass：全部固定 RC2 peers、RC2 编译与真实 pi-ai payload fixture | Pass：固定官方内核与 adapter 双面编译 |
| PC-003 composition/boot | Pass：原生 Host status RPC | Pass：原生 Host RPC、scan/apply/restore | Pass：Host inventory、Work/Chat、Synapse、冷历史 |
| PC-004 client/settings | Pass：subscriptions-v4 与 UI adapter smoke | Pass：client bundler、原生 client 发现与注册 | Pass：初始 172 契约、176 DOM 回归、Synapse client/seams；后续 metadata/HMR 定向验证；视觉 Pending Manual |
| PC-005 capabilities | Pass：空账户 status；真实调用 Pending Manual | Pass：模拟 scan/apply/restore、4 个实际 pi-ai payload（零外网） | Pass：editor read/save、Work/Chat 隔离、Synapse 查询与冷恢复 |
| PC-006 auth/storage/redaction | Pass：Host cookie/Origin 鉴权、已有凭据引用保留；真实 OAuth Pending Manual | Pass：unsafe RPC、秘密脱敏、私有 v4 store、旧写权限剥离 | Pass：私有快照、外部路径拒绝、web-state allowlist、telemetry/feedback 禁用 |
| PC-007 disable/recovery | Pass：native recovery、diagnostic pure core | Pass：旧 disabled choice 承接、native recovery、diagnostic pure core | Pass：内置模块不列入用户管理 bundle，全部诊断禁用退回核心 |
| PC-008 runtime/package | Pass：新构建/staging/清单与许可证；正式安装资产未生成 | Pass：新构建/manifest 与闭包测试；正式安装资产未生成 | Pass：独立 runtime/闭包测试与原图标；签名包净化审计与正式包 Pending |
| PC-009 real account | Pending Manual：登录/状态/实际调用/登出 | Pending Manual：真实自定义模型与配置复验 | 不适用账号；真实 profile、图谱交互、安装/更新 Pending Manual |

DVP-0003 与 DVP-0004 的旧挂载退出新 profile，配置和备份保留；由 DVP-0006 与官方右侧工作台承接。历史源码/SDD 保留，不伪造旧插件在新内核通过。

## 白屏与 metadata 热更新证据

白屏原因是文件同步产生 ctime-only 变化时，client artifact 误将未变更的 bundle 视为新构建，通知浏览器卸载正在运行的核心模块。修复保留 mtime 构建戳语义，并比较大小与 bundle 字节；metadata-only 时刷新 baseline，实际内容或构建戳变化仍触发更新。开发 watcher 同时改为内容指纹，避免 metadata-only 和相同字节重写造成无意义的整套重构建。

累计定向验证 62 项通过；其中最终 metadata/HMR 3 项单独重跑通过，覆盖：

- 仅 metadata 改变：真实 registry 的 baseline 更新，graph/revision 保持不变，浏览器插件 mounted=1、disposed=0，只有初始 graph frame，没有 rebuilt。
- mtime/大小不变但实际字节改变：浏览器插件从 A 换成 B，mounted=2、disposed=1，收到 graph → rebuilt → graph。
- 相同入口字节但 mtime 构建戳改变：仍更新 revision 并重挂载，保留 sibling chunk 的构建通知。

测试使用真实 ClientArtifactRegistry、HmrSupervisor、browser runtime 与传输链路，fixture 数据为合成内容。可复现的最终三项命令：

```sh
cd upstream/deepseek-harness
node node_modules/vitest/vitest.mjs run packages/client/hmr/tests/deepviewer-client-artifact-metadata.client.spec.ts
```

2026-10-03，按维护者本次定向诊断授权，在 Build 88 的实际运行中对 ui-renderer、ui-layout、ui-theme、connection 四个核心模块做 metadata-only 变更；确认 ctime 改变而 mtime、大小、SHA-256 不变，随后恢复原权限。连续观察 180 秒，rebuilt=0，root 保持挂载。该证据支持 AC-007；不代替视觉、交互、旧会话/附件或真实账户验收。

## Local build and release boundaries

初始开发构建生成原生 lib/renderer、DSH runtime 和 primary-runtime，没有生成安装资产或 GitHub Release。后续白屏修复已构建并验证到 Build 88。维护者现已明确授权 0.5.0 arm64 正式签名安装包、推送 Duoasa/DeepViewer 和 main 合并；本记录同步时，最终发布 build、签名/公证、净化审计、安装资产及远端 digest 仍为 Pending，统一在 [v0.5.0 发布记录](../../releases/v0.5.0.md) 补齐。

0.5.0 安装包发布与自动更新 feed 发布是独立边界。`publish-native-update.mjs` 所要求的真实 signedInstall、userDataPreserved、relaunch 等 qualification 继续生效，本次安装包授权不绕过该门禁。AC-005/AC-006 保持 Pending Manual，规格保持 Implementing。
