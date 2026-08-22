---
id: DV-0015
title: DeepSeek Harness 0.1.1-rc.2 core upgrade and DeepViewer 0.2.3 - Verification
status: Implementing
updated: 2026-08-23
---

# DV-0015：验证

## 验证环境

- DeepViewer 基线：`origin/main` `2e82e3a` 上的发布分支 `codex/v0.2.3-dsh-rc2`
- 平台：macOS arm64、Node `24.19.0`；Runtime 与候选包目标为 macOS arm64/x64
- 配置：DeepViewer `0.2.3` Build `1`，默认 JSONL persistence
- 外部依赖：DeepSeek Harness `dsh-v0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- DSH 插件：DVP-0001 `dsh-plugin-subscriptions@0.3.1`、DVP-0002 `@deepviewer/dsh-plugin-preview@0.1.0`

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 自动 | Pass | 干净 rc.2 标签上确定性同步覆盖；Host、Client、预览插件和 Web production build 通过 |
| AC-002 | 自动 + 人工 | Pass / Pending Manual | PC-001—PC-008 无 Fail；DVP-0001 PC-009 等待维护者真实账户检查 |
| AC-003 | 自动 | Pass | 两个插件精确 rc.2 peer 门禁、失配 fail-closed、禁用/缺失降级测试通过；组合开发启动通过 |
| AC-004 | 自动 | Pass | 0.2.3 Build 1 / rc.2 静态回读、106 项桌面测试、typecheck、desktop production build 和 3998 项 DSH GUI 测试通过 |
| AC-005 | 自动 + 人工 | Pass / Pending Manual | Electron Dev 已启动；日志确认两个插件启用、唯一 loopback Runtime 就绪；品牌视觉由维护者确认，其余人工流程待完成 |
| AC-006 | 自动 + 人工 | Pass | 侧栏品牌槽位组合测试覆盖 mark/name 独立注册和本地 profile 无 DSH fallback；维护者在开发版视觉确认后指示继续封包 |
| AC-007 | 自动 | Pass | arm64/x64 Runtime 全新生成；两包均通过隐私审计、34 个 Mach-O 严格签名验证、主程序架构回读、DMG 签名与 `hdiutil verify` |
| AC-008 | 自动 | Pass | README、SDD 与候选记录已同步；发布分支已推送，远端 `main` 由 `2e82e3a` 非强制快进到包含候选记录的 `eb2ed36` |
| AC-009 | 自动 | Pass | `v0.2.3` tag/Latest Release 指向发布提交；原始产品图、README、双架构公证资产和校验清单已发布，三个远端资产大小/digest 与本地一致，发布源码 CI 通过 |

## 插件兼容矩阵

| 检查 | DVP-0001 订阅 | DVP-0002 预览 | 证据摘要 |
| --- | --- | --- | --- |
| PC-001 | Pass | Pass | 固定版本安装、来源/manifest 与锁文件检查通过 |
| PC-002 | Pass | Pass | staging 订阅的 4 个 DSH peer 与预览的 8 个 DSH Client peer 均精确为 `0.1.1-rc.2`；Cordis 保持独立门禁 |
| PC-003 | Pass | Pass | manifest、入口、配置链接、Host 加载顺序与组合启动通过 |
| PC-004 | Pass | Pass | Client adapter、详情多视图、设置/主题和完整 DSH GUI 回归通过 |
| PC-005 | Pass | Pass | 订阅 capability/用量 adapter 与预览 RPC/路由注册测试通过；真实订阅调用归 PC-009 |
| PC-006 | Pass | Pass | 既有 OAuth/loopback、凭据权限、日志脱敏与工作区 containment 测试通过，安全边界未扩大 |
| PC-007 | Pass | Pass | 禁用、缺失、旧 peer 或无效 manifest 均 fail-closed 并保留纯核心配置 |
| PC-008 | Pass | Pass | 双架构 staging/runtime manifest、路径净化、原始 npm 插件不变性和签名候选包隐私审计通过 |
| PC-009 | Pending Manual | N/A | 订阅真实账户流程由维护者检查 |

## 执行的命令

- `pnpm install --frozen-lockfile`（DeepViewer 与 DSH）：Pass。
- `node apps/deepviewer-desktop/scripts/sync-upstream-overrides.mjs --build`：Pass；Host、Client、预览插件、336-module Web production build 完成。
- `pnpm test`：Pass，15 files / 106 tests。
- `pnpm typecheck`：Pass。
- `pnpm desktop:build`：Pass。
- `pnpm run test:gui`（DSH）：Pass，284 files；3998 passed / 1 skipped。
- `pnpm run build:official`（DSH）：Pass；Host、Client 与 336-module Web production build 完成。
- `pnpm run release:pack -- --family vendor` / `--family dsh`（DSH）：Pass；分别生成 9 / 227 个固定 tarball。
- `pnpm run runtime`（Desktop）：Pass；全新生成 arm64/x64 Runtime，并校验 rc.2 核心、两个内置插件和原生模块架构。
- `node scripts/package.mjs --sign`（Desktop）：Pass；两个应用隐私审计、Developer ID 严格嵌套验签、DMG 完整性与磁盘镜像签名验证均通过。
- `node scripts/notarize.mjs --keychain-profile=<redacted>`：Pass；arm64/x64 均为 Apple Accepted，ticket staple/validate、Gatekeeper、DMG 与只读挂载应用评估通过。
- `shasum -a 256 -c SHA256SUMS.txt`：Pass；两个最终装订 DMG 均为 `OK`。
- `git push -u origin codex/v0.2.3-dsh-rc2`：Pass；远端发布分支创建并回读。
- `git push origin HEAD:main`：Pass；刷新后 `origin/main...HEAD` 为 `0 2`，远端 `main` 非强制快进到 `eb2ed36`。
- `git tag -a v0.2.3` / `git push origin refs/tags/v0.2.3`：Pass；annotated tag 解引用到发布提交 `25de065`。
- `gh release create v0.2.3 ... --verify-tag --latest`：Pass；公开 Release 创建并上传 arm64/x64 DMG 与校验清单。
- GitHub Release/API 回读：Pass；Latest 为 `v0.2.3`，三个资产均为 `uploaded`，远端大小与
  `sha256:` digest 逐项匹配，发布源码 CI #32583344771 通过。
- `DSH_SNAPSHOT=replay pnpm run test:web:built`（补充、非门禁）：安装 Chromium 并生成完整 build record 后启动；全套因 DeepViewer 既有品牌标题、绝对预览路径和窄屏手动侧栏契约与上游 E2E golden 不同而中止。定向复跑确认均为已登记产品差异；不将此命令记为 Pass。
- `pnpm desktop:dev`：Pass；2026-08-22 22:30（Asia/Shanghai）启动 Electron，日志记录 `SUBSCRIPTIONS_ENABLED version=0.3.1`、`PREVIEW_ENABLED version=0.1.0` 和单一 `runtime ready origin=http://127.0.0.1:49891`。

## 人工检查

- [x] 应用启动与唯一内置 Runtime（自动日志）
- [x] 侧栏 DeepViewer mark/name 品牌视觉（维护者确认）
- [ ] About 版本与窗口视觉行为
- [ ] 核心会话、输入框和 Markdown 表格
- [ ] 代码文件与静态网页预览
- [ ] 订阅登录、状态/用量、一次实际调用和登出
- [ ] 权限、隐私和外部传输提示

## 残余风险

- PC-009 依赖维护者真实账户与外部服务。
- 上游 Web E2E golden 尚未全部改写为 DeepViewer 的品牌标题、绝对预览路径和手动侧栏契约；产品源码、桌面回归、DSH GUI 回归与 production build 均通过，本规格不把该补充套件误报为绿色。
- arm64 最终 DMG 为 `555,495,477` bytes，SHA-256 `4c86ca24958f74f9e049d5a97bb34cb51415724188065f8fdd501b6ca47b8adb`。
- x64 最终 DMG 为 `589,232,353` bytes，SHA-256 `1857891ae3b8a610656d7b6f77442e1aed6e7bfb6d5e57097c9b4669d552aec8`。
- 两个最终包已签名、公证并装订；公开 GitHub Release 与资产回读完成前仍不视为已发布。

## 结论

- 结果：自动范围和品牌视觉 Pass；因 PC-009 与其余维护者人工流程保持 `Implementing`
- 验证人：Codex（自动）/ Duoasa（人工）
- 日期：2026-08-22
