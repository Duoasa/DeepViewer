# DV-0034 Verification

Status: Implementing
Date: 2026-10-04

| AC | 可复现证据 | 状态 |
| --- | --- | --- |
| AC-001 | 4 项旧版 SVG/CSS 基线检查通过；175 项 fresh pinned source 契约两次 apply 幂等，agent loop 未变；178 项 jsdom 原生 UI 回归通过，包含 sessionless/blank hero 与 composer 分离、首次消息后的输入 DOM/draft 保留 | Pass (源码与 DOM) |
| AC-002 | 本机 Apple actool 实际编译通过；SVG SHA-256 保持原值，catalog 包含 Aqua/DarkAqua/Tintable 与原 vector；完整 10 个 ICNS renditions，1024 高 alpha 边界为 [100,100,923,923]，旧图为 [0,0,1023,1023]；已删除运行时 override。最终 bundle 资源待 T-003 | Pass (资源与选择链路；最终包待核验) |
| AC-003 | frozen root/upstream install、typecheck 通过；完整 bounded smoke 18 文件/121 项通过；图标/compiler 与 identity 定向 6 项通过。全新构建及最终包检查进行中 | Pending (最终包) |
| AC-004 | 新会话动画和实际 Dock 视觉需维护者确认 | Pending Manual |
| AC-005 | 最终 0.5.1 来源、资产与发布证据待完成 | Pending |

本规格未升级内核、依赖族或内置插件；DV-0033 的真实账户、迁移连续性与字体权限等 Pending Manual 边界保留。

## 基础验证命令

使用固定 Node 24 与仓库 pnpm 11.19.0；上游按其固定 packageManager 使用 pnpm 11.7.0。

```sh
pnpm install --frozen-lockfile
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm typecheck
pnpm desktop:smoke
node apps/deepviewer-desktop/scripts/smoke-native-contract-source.mjs
node apps/deepviewer-desktop/scripts/smoke-native-ui-regression.mjs
pnpm --dir apps/deepviewer-desktop exec vitest run test/dock-theme.test.ts test/app-identity.test.ts
```

旧版 CSS fixture 原文来自 v0.3.3 / Build 75，SVG 对照使用已保留的 DSH 0.1.5 override；不依赖 CI 的 tag 可见性。cursor 为原 1s steps 动画，reduced-motion 禁用它。本轮未操作应用 GUI；renderer GUI smoke 仅更新了断言，不作为已通过证据。

原鱼标 SVG SHA-256：`16896da065025e41040115cc8f16f0268a94200bd5ea3c939e27e3078dff1816`。`dock-theme` 编译器集成检查本机实际运行，没有 skip；测试通过真实 ICNS PNG alpha、catalog metadata 与完整 rendition 表验证编译器输出，同时测试缓存/部分资源修复。About PNG 直接提取 ic10 字节，不重编码或改变图片。

121 项 bounded smoke 已包含 4 项 idle 基线与 3 项 native icon 检查，不将这些子集重复累加。实际图标与视觉验收保持 AC-004 Pending Manual。
