---
id: DV-0017
status: Implementing
owner: Duoasa
created: 2026-09-14
updated: 2026-09-14
---

# 验证边界

开发适配已完成构建、类型检查与冒烟。维护者后续要求每次修改只做冒烟，并授权发布 ARM Preview。
AC-001—AC-004 在下述范围通过；AC-005 为 Pending Manual；AC-006 的发布证据见 [0.2.5 Preview 记录](../../releases/v0.2.5-preview.1.md)。未运行完整回归套件，规格保持 Implementing。

## 基线与执行结果

- DeepViewer：`v0.2.3` / `25de065bc8fbee885696c4c3da0ca14158fa687b`。
- DSH：`dsh-v0.1.5-rc.2` / `fb2c4b9e698e30edb738bca4cf0618587db7d203`。
- 实际开发宿主：macOS arm64，Electron 43.4.0 内置 Node 24.18.1。
- 本地构建日志：`/private/tmp/deepviewer-dsh015-final-integrated.log`、`/private/tmp/deepviewer-dsh015-final-build.log`。
- 冒烟日志：`/private/tmp/deepviewer-dsh015-final-smoke.log`；运行结果位于日志给出的 `evidenceRoot/result.json`。本次两种配置均通过，无 renderer error，应用关闭后各自的 Runtime PID 均退出。

| 验收 | 结果 | 实测证据与边界 |
| --- | --- | --- |
| AC-001 | Pass | 固定上游 native-system、host/client/Web 构建；桌面 main/preload/renderer 构建和 TypeScript 检查通过。 |
| AC-002 | Pass | Electron 实际 arch 为 arm64；build-runtime/package/notarize 的 `--arch=x64` 均在执行构建或封包前拒绝；默认数组仅含 arm64。 |
| AC-003 | Pass / smoke | 默认订阅组合与停用订阅的纯核心组合均启动；官方 documentpreview 样式资源加载，原生 chrome 安装完成；设置内显示三个订阅提供方，状态 RPC 返回 200 和未登录状态。实际文件渲染与按钮操作仍属于 AC-005。 |
| AC-004 | Pass | 各配置使用独立空 userData；token 交换后页面 URL 不含 token；未认证根页面与订阅 RPC 返回 401；日志 token 脱敏；关闭应用后 Runtime 退出。 |
| AC-005 | Pending Manual | 视觉、会话调用、订阅登录/用量/登出、官方文件/网页预览、右上角展开收起/全屏、Finder 操作由维护者实机验收。 |

## 插件契约

本开发分支仅 DVP-0001 为 Active；DVP-0002 为 Disabled，未参与 staging、启动或 Runtime 构建。

| 检查项 | DVP-0001 结论 | 本次证据或待验内容 |
| --- | --- | --- |
| PC-001 | Pass | 固定 npm 0.3.1 与现有锁文件；保留 MIT，恢复源码来自该包 source map；私有 gallery 副本保留固定 DSH 许可证。 |
| PC-002 | Pass / smoke | staging peer 指向 DSH 0.1.5-rc.2 / Cordis 4.0.2 的当前 workspace 包；Host 实际加载，Client 重建通过。 |
| PC-003 | Pass | manifest/入口/patch 检查成功，默认启动日志 SUBSCRIPTIONS_ENABLED，无 fallback。 |
| PC-004 | Pass / smoke | 中文设置、订阅列表与未登录状态加载；英文和深浅主题完整交互待人工检查。 |
| PC-005 | Pending Manual | 空账户状态请求通过；provider 真实模型、工具与图片调用未执行。 |
| PC-006 | Pending Manual | 本地请求认证和日志脱敏冒烟通过；真实 OAuth、浏览器回调与凭据操作未执行。 |
| PC-007 | Pass / smoke | 显式停用订阅后纯核心启动/退出通过；缺包、版本错配和故障注入不在本次冒烟范围。 |
| PC-008 | Pass | 全新 ARM Runtime 与签名 DMG 已生成；35 个 Mach-O 签名验证、16 项 ASAR allowlist/包体隐私检查通过；实际签名 app 启动、订阅状态 RPC、认证和退出冒烟通过。公证与远端资产证据见发布记录。 |
| PC-009 | Pending Manual | 维护者真实账户验收。 |

## 复现

在本 checkout 使用 Node 24+ 和已安装依赖：

```sh
CI=true pnpm_config_verify_deps_before_run=warn node apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs --build
CI=true pnpm_config_verify_deps_before_run=warn pnpm desktop:build
DEEPVIEWER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node apps/deepviewer-desktop/scripts/smoke-development.mjs
CI=true pnpm_config_verify_deps_before_run=warn pnpm desktop:dev
```

冒烟脚本不依赖账户、不会发起模型请求，并将结果与截图写入临时目录。开发 app 使用 `DeepViewer Dev/dsh-0.1.5-rc.2` 独立数据目录。首次运行需配置账户与工作区。
