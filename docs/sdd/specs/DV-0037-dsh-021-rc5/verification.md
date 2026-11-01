# DV-0037 Verification

Status: Implementing
Date: 2026-11-01

固定 DSH 0.2.1-rc.5 / `b830ec950faba0a46dda564be3e2d854afed94f1`。应用版本为 0.8.0，buildNumber 仍是 93。验证机为 Linux，Node 24.22.2。Active 模块：DVP-0001 subscriptions 0.3.1、DVP-0006 model-capabilities 1.0.2、DVP-0007 adapter 0.8.0、DVP-0008 Figma 0.3.1 / `baa6054e73490afeba775328a248bb5bc0da8586`。

## 基础证据

| AC | 状态 | 证据 |
| --- | --- | --- |
| AC-001 | Pass | `node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs`：167 条契约在干净 rc.5 上应用两次，幂等，Agent loop 未改 |
| AC-002 | Pass（自动） | 补丁后 `pnpm --dir upstream/deepseek-harness run typecheck`：5/5。`build-native-desktop.mjs --core-only` 的内核门禁 9/9。补丁后的 `ConversationSession.tsx` 只有一处 `const { visibleTabs`。header placement 3 项、Synapse seams 6 项、Synapse client 11 项通过 |
| AC-003 | Pass | `smoke:ui-regression`：5 个文件、239 项，含上游 sidebar-styles 与 panel-list |
| AC-004 | Partial | 下表。真实账户、真实 Figma 和界面交互 Pending Manual |
| AC-005 | Pass | `build-native-desktop.mjs --core-only` 打印 `Staged native dsh-to-figma@0.3.1`。`smoke-figma.mjs`：74 项插件测试通过，native 结果 `localTools: 18`、`actualDsh: 0.2.1-rc.5`。staged 树含 `assets/companion/FEATHER-LICENSE`。semver 检查未放宽 |

## 命令

在仓库根、Node 24.22.2 上执行。上游先 `git clone --depth 1 --branch dsh-v0.2.1-rc.5`，再 `pnpm install --frozen-lockfile`（pnpm 11.28.5）。

- `pnpm typecheck`：通过。
- `pnpm --dir upstream/deepseek-harness run typecheck`：5 passed, 0 failed。
- `node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs`：PASS，167，idempotent。
- `node apps/deepviewer-desktop/scripts/build-native-desktop.mjs --core-only`：通过，含 `Staged native dsh-to-figma@0.3.1 with pinned Harness peers`。
- `node apps/deepviewer-desktop/scripts/smoke-figma.mjs`：74 通过；native `localTools: 18`。
- `node apps/deepviewer-desktop/scripts/smoke-model-capabilities-host.mjs`：通过。
- `pnpm desktop:smoke`：18 个文件中 17 个通过；122 项里 110 通过、1 跳过、11 失败。失败全部来自 Linux 缺少 `/usr/bin/shlock`，见下方平台差异。
- `node apps/deepviewer-desktop/scripts/smoke-native-ui-regression.mjs`：239 通过。
- `node apps/deepviewer-desktop/scripts/smoke-native-header-placement.mjs`：3 通过，38 跳过。800px 行宽的可见 tab 预算：上游整行 6，对半拆开 2，统计按内容宽度后 tab 簇 6。
- `pnpm --filter @deepviewer/desktop smoke:synapse`：host 7 通过。client 在 adapter 尚未 stage 时失败；core build stage 之后重跑 11 通过。seams 6 通过。canvas 在 Linux 失败，见下方。
- `pnpm --filter @deepviewer/desktop smoke:contracts`：76 通过。
- `node --test --test-timeout=15000 apps/dsh-plugin-model-capabilities/test/*.test.mjs`：52 通过。
- `node apps/dsh-plugin-model-capabilities/scripts/smoke-runtime.mjs`：插件 stage 到上游后通过，4 个 pi-ai payload，0 次网络。
- `node --experimental-strip-types --test apps/deepviewer-adapter/tests/workflows.test.mjs`：2 通过。

`smoke-model-capabilities-host.mjs` 在 0.3.1 staging 通过后运行，结果为通过。

## Node

`Promise.withResolvers` 需要 Node 22+。本次没有发现把内核跑在 Node 20 上的路径，因此没有改 engines，也没有新增 `.nvmrc`。

- 已安装的 Electron 44.7.0 二进制：`ELECTRON_RUN_AS_NODE=1 electron -p process.versions.node` 得到 Node 24.21.0。
- `scripts/primary-runtime/lock.json` 的独立 Node 是 24.21.0。`apps/desktop/scripts/node-bin/node` 设置 `ELECTRON_RUN_AS_NODE` 后执行 `$DSH_DESKTOP_NODE_EXECUTABLE`。
- `smoke-native-host.mjs` 用 `process.execPath` 启动 Host。仓库根 engines 是 `>=24.0.0`。CI 的 `node-version` 是 24，本次未改 workflow。
- 内核与 model-capabilities 的 engines 都是 `^22.19.0 || >=24.0.0`。`resolveHarnessLaunch` 会拒绝不满足该范围的 Electron Node。

## Active 模块

| 检查 | DVP-0001 | DVP-0006 | DVP-0007 | DVP-0008 |
| --- | --- | --- | --- | --- |
| PC-001 | Pass：仍固定 0.3.1 源包 | Pass：源码与新 shrinkwrap 锁定 rc.5 peer | Pass：源码契约 | Pass：tag `v0.3.1`，提交 `baa6054e73490afeba775328a248bb5bc0da8586`，文件哈希在 UPSTREAM.json |
| PC-002 | Pass：staging 日志写明 peer 为 0.2.1-rc.5。Cordis 改写仍是既有的 4.0.4 | Pass：package.json 与 shrinkwrap 为 0.2.1-rc.5，Cordis 4.0.5 | Pass：固定 workspace | Pass：peer 范围包含 `0.2.1-rc.5`，staging 的 semver 检查通过 |
| PC-003 | Pass：subscriptions staging 完成 | Pass：插件构建与 Host smoke 通过 | Pass：内核门禁与客户端构建通过 | Pass：18 个本地工具注册，companion 运行时通过 |
| PC-004 | 自动边界沿用既有用量测试 | Pass：52 项测试与 client 构建 | Pass：239 项 UI 回归、统计行与 Synapse | 不适用 Web client |
| PC-005 | 空账户以外 Pending Manual | Pass：假 API 扫描与 pi-ai payload | Pass：Synapse 与契约 76 项 | Pending Manual |
| PC-006 | Pending Manual：真实 OAuth | Pass：既有脱敏测试 | Pass：测试使用临时目录 | Pending Manual |
| PC-007 | 禁用开关未改 | 禁用开关未改 | 禁用开关未改 | `DEEPVIEWER_DISABLE_FIGMA` 只影响运行时，不跳过 staging |
| PC-008 | 未做签名包 | 同左 | 同左 | 同左 |
| PC-009 | Pending Manual | Pending Manual | Pending Manual | Pending Manual |

## 平台差异

这些失败来自 Linux 缺少 macOS 工具或路径，不是 rc.5 契约错误：

- `profile-migration.test.ts` 11 项调用 `/usr/bin/shlock`。CI 注释写明该检查在 macos-15 上运行。
- `smoke-native-synapse-canvas.mjs` 使用 `mkdtempSync('/private/tmp/deepviewer-canvas-')`，Linux 上没有 `/private/tmp`。

## 未完成

- `.github/workflows/ci.yml` 仍检出 rc.2。需要另一位维护者把 ref 改成 `b830ec950faba0a46dda564be3e2d854afed94f1`。
- 应用版本、发布记录、根 README、`upstream/README.md` 和 `apps/deepviewer-adapter/README.md` 未改。
- 界面、真实账户和真实 Figma 保持 Pending Manual。规格保持 Implementing。
