---
id: DV-0009
title: macOS workspace experience refinement - Verification
status: Verified
updated: 2026-08-17
---

# DV-0009：验证

## 验证环境

- 提交：Pending release commit
- 平台：macOS Apple Silicon
- 配置：隔离的 `DeepViewer Dev` profile；固定 Harness checkout
- 外部依赖：DeepSeek Harness `47f943859bef60e4160492346772ded9b24f765a`

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 维护者人工 + 结构测试 | Pass | 维护者要求从页面结构修复并验收为两列；安全区覆盖契约检查侧栏、Chat、详情列独立座位 |
| AC-002 | 维护者人工 + 契约测试 | Pass | 新会话、思考和完成截图逐轮比较；统一 `--deepviewer-composer-bottom-offset: 32px`，统计移入 Chat 安全区 |
| AC-003 | 维护者人工 + 契约测试 | Pass | 欢迎内容按完整 Chat 画布重新居中；48px 图形、50% 透明度、40px 间距和中英文文案均有受控源码断言 |
| AC-004 | 维护者人工 + 契约测试 | Pass | 侧栏品牌在浅色/深色迭代中验收；内联 SVG 使用 `currentColor`、20px 默认高度、623:127 viewBox，无交互/阴影 |
| AC-005 | 维护者人工 + 窗口测试 | Pass | 维护者分别反馈浅色/深色断层和遮罩问题并确认当前里程碑；窗口样式使用单层原生材质、失焦纯色和透明淡出 |
| AC-006 | 维护者人工 + 窗口测试 | Pass | 收起/展开按钮跳动修复后进入当前里程碑；测试固定正常坐标并保留全屏补位 |
| AC-007 | 维护者人工 + IPC/窗口测试 | Pass | 浅色红绿灯可读性修复进入当前里程碑；preload 与 main 双侧限制主题枚举 |
| AC-008 | 同步 build + 类型/测试 | Pass | 覆盖同步/build 为 current；TypeScript、9 个 Vitest 文件/49 项测试和三段 Vite production build 全部通过 |

## 执行的命令

```sh
CI=true node apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs --build
node --check apps/deepviewer-desktop/scripts/dev.mjs
node --check apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs
node --check apps/deepviewer-desktop/scripts/package.mjs
CI=true pnpm --filter @deepviewer/desktop typecheck
CI=true pnpm --filter @deepviewer/desktop build
CI=true pnpm --filter @deepviewer/desktop test
CI=true pnpm desktop:dev:restart
git diff --check
```

- 受控上游覆盖和对应 build 均为 current。
- TypeScript 无错误；Electron main、preload、renderer production build 全部通过。
- Vitest：9 个测试文件、49 项测试全部通过；RuntimeManager 测试获准使用本机 loopback。
- 开发 restart 在受限沙箱中按预期被项目 socket 的 `EPERM` 阻断，允许本机 socket 后同一命令
  成功排队，未按进程名终止其他 Electron 应用。
- `git diff --check` 通过；桌面 manifest 版本断言为 `0.1.2`。
- 封包源码门禁只复制声明的 desktop/assets 文件和受限 Renderer 资产名；最终 ASAR 对每个路径
  执行 allowlist，防止本地未跟踪、source map 或“ 2”重复文件进入候选包。
- 依赖检查曾要求重建根 `node_modules`；随后只从现有 pnpm 内容寻址缓存恢复 98 个锁定包，
  未修改 lockfile 或依赖版本。
- 未运行 preview、正式双架构 Runtime、package、签名、公证或上传。

## 人工检查

- [x] 两列结构、顶部安全区和会话统计位置
- [x] 新会话、思考、完成状态的输入框底边一致
- [x] 欢迎内容、文案、品牌和按钮位置
- [x] 浅色/深色及聚焦/失焦侧栏表现
- [x] 维护者确认当前状态建立 `v0.1.2` 里程碑
- [ ] 正式 arm64/x64 安装包验收（发布阶段）

## 残余风险

- 固定上游 checkout 更新时，覆盖锚点需要重新验证。
- 真实 Intel Mac、签名、公证、Gatekeeper 和最终 DMG 仍属于正式发布门禁。

## 结论

- 结果：Verified；AC-001 至 AC-008 全部通过，正式发行资产继续由 `v0.1.2` 发布门禁验证
- 验证人：Duoasa（交互）；Codex（代码与自动验证）
- 日期：2026-08-17
