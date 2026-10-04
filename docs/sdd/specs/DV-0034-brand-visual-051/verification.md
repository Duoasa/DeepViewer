# DV-0034 Verification

Status: Implementing
Date: 2026-10-04

| AC | 可复现证据 | 状态 |
| --- | --- | --- |
| AC-001 | 4 项旧版 SVG/CSS 基线、175 项 fresh pinned source 契约与两次 overlay 幂等、178 项 jsdom 原生 UI 回归通过；最终实际 ASAR 17 项静态检查确认原 SVG 双路径、48px / 50% opacity、1s steps cursor、40px 间距、24px / 32px 系统字体、reduced-motion、hero / bottom resident composer seam、slot 与实际 Build 91 身份 | Pass (源码、DOM 与实际包静态证据) |
| AC-002 | 已证实 full-bleed PNG 与运行时 Dock override 根因；原 SVG hash 不变；Apple actool 编译与图标 / 身份 6 项检查通过；最终签名 app 的 Aqua / DarkAqua / Tintable catalog、Whale vector、10 个有效 ICNS renditions、1024px alpha>127 边界 `[100,100,923,923]`、About 与 ic10 字节相同、bundle 图标名及无旧 DockThemes 检查通过；没有整图缩放或 runtime 尺寸补丁 | Pass (实际原生资源与选择链路) |
| AC-003 | frozen root / upstream install、typecheck、完整 bounded smoke 18 文件 / 121 项通过；全新 core / renderer / Electron 主入口 / primary runtime / staging / app / DMG 构建通过；最终实际 ASAR 库存、净化审计、签名 payload smoke 与资源检查通过 | Pass |
| AC-004 | 实际新会话动画、窗口布局及 Dock 与相邻图标协调需维护者确认 | Pending Manual |
| AC-005 | 0.5.1 Build 91 的固定构建源与最终 tag 源 CI success；签名、双公证、stapling / Gatekeeper、DMG 完整性 / 挂载身份及 SHA-256 全部通过；PR #9 已合并，main merge CI success；v0.5.1 已公开为 Latest，两个公开资产大小 / digest 与本地匹配，公开 DMG 无鉴权 HTTP 200、SHA 完整下载与本地一致。权威资产证据见 [发布记录](../../releases/v0.5.1.md) | Pass (已授权安装包发布范围) |

本规格未升级内核、依赖族或内置插件；DV-0033 的真实账户、迁移连续性与 Office 字体权限等 Pending Manual 边界保留。AC-004 未通过前规格保持 Implementing。

## 基础验证命令

使用固定 Node 24 与仓库 pnpm 11.19.0；上游按其固定 packageManager 使用 pnpm 11.7.0。原生 icon 编译使用 Xcode 26.6 / 17F113。

```sh
pnpm install --frozen-lockfile
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm typecheck
pnpm desktop:smoke
node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs
node apps/deepviewer-desktop/scripts/smoke-native-ui-regression.mjs
pnpm --dir apps/deepviewer-desktop exec vitest run test/dock-theme.test.ts test/app-identity.test.ts
pnpm --dir apps/deepviewer-desktop exec vitest run test/development-workflow.test.ts test/release-version.test.ts
```

旧版 CSS fixture 原文来自 v0.3.3 / Build 75，SVG 对照使用已保留的 DSH 0.1.5 override；不依赖 CI 的 tag 可见性。4 项 idle 基线与 3 项 native icon 检查已包含在完整 121 项 bounded smoke 中；6 项 icon / identity 定向与 11 项版本检查也有重合，不把这些子集重复累加。

原鱼标 SVG SHA-256：`16896da065025e41040115cc8f16f0268a94200bd5ea3c939e27e3078dff1816`。`dock-theme` 编译器集成检查本机实际运行，没有 skip；测试通过真实 ICNS PNG alpha、catalog metadata 与有效 rendition 表验证编译器输出，同时测试缓存 / 部分资源修复。About PNG 直接提取 ic10 字节，不重编码或改变图片。

## 全新构建与最终实际包

正式 packager 从 build 90 增至 91，重新生成 core、renderer、主入口、primary runtime、临时 staging、app 和 DMG。准备阶段闭包含 611 个 dependency packages，755 份清单中 268 份规范化，51 个文件删除 163 个私人构建位置注释。实际 builder 逐文件 ASAR 库存保持严格验证，最终 signed app 净化审计覆盖 20,275 entries / 7,952 resources，通过。

最终 app 的原生 bundle 和资源检查通过：`CFBundleIconName=DeepViewer`、`CFBundleIconFile=icon.icns`；catalog 的 Aqua / DarkAqua / Tintable 均包含原 Whale vector；ICNS 有 10 个有效 renditions，1024 表示的 alpha>127 边界 `[100,100,923,923]`，About PNG 与 ic10 完全相同；无 `DeepViewerDockThemes`。原始 full-bleed PNG 边界为 `[0,0,1023,1023]`，启动链路的 PNG override 已移除。

最终实际 ASAR 17 项只读静态检查对比生产 bundle 与构建源、v0.3.3 基线：双 SVG path 字节相同，恢复的 CSS module 已注入，原生 hero slot 注册、scrollBody 的独立 HeroShell、底部 composerSeat 与 overlay 链保持；实际 buildInfo 为 0.5.1 / 91 / DSH 0.2.0-rc.2。Vite 将 `steps(1,jump-end)` 优化为等价 `step-end`、`flex:1 1 auto` 优化为 `flex:auto`；检查接受该等价输出而非修改生产样式。renderer diagnostic 不在 production closure，后续等价 timing 匹配只影响验证源码。

最终实际签名 app 的 payload smoke 使用 `ELECTRON_RUN_AS_NODE=1` 并隔离 HOME、XDG cache / config / data 和 TMPDIR，覆盖 Host、native dependencies、DOCX / XLSX / PPTX 转换及 skill CLI，全部通过。没有运行 GUI 或触碰真实用户 profile；继承真实 HOME 的字体目录权限行为未由该隔离检查验收。

签名、双公证 Accepted、stapling / Gatekeeper、DMG 完整性及只读挂载内部 app 身份通过。最终 source / tag、notary submission IDs、SHA-256 / 字节数、远端资产与 PR / main CI 的唯一权威值统一见 [0.5.1 发布记录](../../releases/v0.5.1.md)。

## 源码与发布边界

构建源 `7cd8949cd8906f2bc313daadf23e3578f18653a7` 对应 CI `37162691840` success；最终 tag `v0.5.1` 指 `e75e39ff39ab6d9ba70f67728309efd4d2c0a5ce`，其 CI `37163166652` success。两者差异仅为不进入实际包的 renderer diagnostic 等价 timing 匹配，签名 payload 未改变。

[PR #9](https://github.com/Duoasa/DeepViewer/pull/9) 已于 `2026-10-04T00:01:16Z` 合并为 `63e38ff9bc549303231a55d5943b24b13a3566c2`。main merge [CI 37163607256](https://github.com/Duoasa/DeepViewer/actions/runs/37163607256) success，job 完成于 `2026-10-04T00:10:07Z`，绑定上述 merge commit。

[v0.5.1](https://github.com/Duoasa/DeepViewer/releases/tag/v0.5.1) 于 `2026-10-04T00:09:27Z`（北京时间 08:09:27）公开为 Latest，Release ID `402741500`，draft=false / prerelease=false。两个公开资产的大小 / digest 与本地匹配；DMG 无鉴权 HEAD 跟随重定向 HTTP 200，SHA256SUMS.txt 完整下载并与本地 cmp 一致。

只公开 DMG 与 SHA256SUMS.txt；ZIP / blockmap / appcast / update feed 不公开，真实安装更新 qualification 不因本次安装包发布而满足。本轮未操作应用 GUI，renderer GUI smoke 仅修正断言、不作为 GUI 通过证据；实际新会话与 Dock 视觉、真实用户 HOME 下 Office 字体权限均保持人工验收。
