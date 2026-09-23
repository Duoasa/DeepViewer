# Verification

Status: Implementing

2026-09-22，开发源码 0.3.1 Build 69。只构建并启动源码开发版，不制作安装包，不提交或推送。

- AC-001: `node apps/deepviewer-desktop/scripts/smoke-system-network.mjs` 通过。实际 Electron 系统路由访问 GitHub 和固定提交的 Raw README 均为 200；DeepSeek Anthropic 搜索端点无鉴权 HEAD 返回 401，证明传输可达，未执行付费搜索。单测覆盖下一连接的代理切换、失效代理不隐式直连。
- AC-002/003: `pnpm --filter @deepviewer/desktop exec vitest run test/network-access.test.ts test/network-policy.test.ts test/network-bridge.test.ts test/network-transport.test.ts test/runtime-network.test.ts test/search-network-error.test.ts`：6 文件、19 测试通过。覆盖显式代理优先级、项目配置拒绝、PAC、SOCKS 远端 DNS、TLS 自签名拒绝、匿名转发、私网授权及地址变化、NAT64、鉴权与日志脱敏。Electron 冒烟还覆盖真实 DSH provider 的拒绝、运行内授权复用及跨源跳转重新授权。
- AC-004: `pnpm typecheck`、桌面 Vite 构建、DSH `pnpm run build:official`、`pnpm desktop:smoke` 通过。上游 `pnpm exec vitest run packages/web/web-fetch-http/tests packages/web/web-search-deepseek/tests packages/util/http-proxy/tests`：9 文件、214 测试通过。
- 开发启动日志确认 `NETWORK_READY source=system`、三项现有插件启用、`runtime ready`；未鉴权请求返回 401。当前主进程 92752、DSH 子进程 92863。About 和桌面 manifest 均为 0.3.1 Build 69；冻结 Build 68 应用、DMG 未更新。
- 扩展桌面全量检查最初为 131 通过、15 失败；失败集中于 `development-workflow.test.ts` 的 13 项旧版本/旧界面断言，以及 `preview-plugin.test.ts` 的 2 项已停用预览插件断言。在提交 `0438c98` 的隔离源码副本中复现同样 15 项失败，本轮未修改这些历史契约。新增 2 项传输测试随后通过。
- 原生权限弹窗的实际点击体验、真实账户搜索结果：Pending Manual。规格保留 Implementing。

临时本机证据：`/tmp/deepviewer-system-network-smoke.log`、`/tmp/deepviewer-network-tests.log`、`/tmp/deepviewer-network-upstream-tests.log`、`/tmp/deepviewer-network-baseline-tests.log`、`/tmp/deepviewer-network-official-build.log`。这些日志不随代码发布。

## 0.3.2 固化补充 · 2026-09-22

版本 0.3.2 Build 73。同组 214 项上游网络测试、19 项桌面网络测试再次通过；实际 Electron 冒烟验证 GitHub/raw HTTP 200、搜索端点未鉴权 HEAD 401、内网拒绝/允许/授权复用及重定向重新授权。完整构建和桌面冒烟通过。网络 User-Agent 改为当前应用版本，网络依赖许可证加入精确打包清单。0.3.3 公开签名包和隔离启动证据见 DV-0032。原生弹窗和付费搜索保留 Pending Manual，未将本机网络可达性推广为所有网站、账号或网络环境保证。
