---
id: DV-0015
title: DeepSeek Harness 0.1.1-rc.2 core upgrade and DeepViewer 0.2.3 - Design
status: Implementing
updated: 2026-08-22
---

# DV-0015：设计

## 方案摘要

沿用固定上游 checkout、受控覆盖、官方 build/release-pack、插件 staging、Electron 开发启动链
和既有双架构安全封包管线。升级只改变固定核心、应用版本和必要的插件契约适配；订阅插件仍
固定 0.3.1，预览插件仍固定 0.1.0。所有适配发生在源码构建或 staging 阶段；每个候选包从
全新 Runtime 和 allowlist staging 生成后再签名，不修改已签名 Runtime。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, NFR-001 | 固定核心与版本门禁 | 同时校验 rc.2 manifest、标签提交和 Runtime 元数据 |
| R-002 | 应用身份 | package manifest、About 注入与测试统一为 0.2.3 Build 1 |
| R-003, NFR-003 | 插件兼容矩阵 | 对两个 Active 插件逐项执行 PC-001—PC-009 |
| R-004 | 预览插件适配 | 更新精确 peer，使用 rc.2 client/host 类型重建并验证 RPC/详情栏 |
| R-005 | 订阅插件适配 | staging manifest 明确加入 rc.2，保留本地用量 UI adapter 和禁用开关 |
| R-006 | 受控覆盖 | 继续由确定性锚点脚本修改干净 checkout，失败时停止构建 |
| R-007 | 开发启动 | 保留随机 loopback 端口、`--no-open`、Electron readiness 与单实例管理 |
| R-008 | 品牌插槽 | 分离 DeepViewer SVG mark 与文本 name，在本地 profile 中显式注册 rc.2 侧栏品牌槽位 |
| R-009, NFR-005 | 双架构签名候选包 | 独立清理和构建 arm64/x64 Runtime、应用与 DMG，执行 allowlist 隐私审计、签名和完整性验证 |
| R-010 | 文档与主线 | 在证据确定后同步双语 README、SDD 与插件登记，提交发布分支并快进合并远端 `main` |
| R-011 | 公开发布 | 版本化保存产品图，公证并装订最终 DMG，创建 tag/Release，上传资产后回读 digest 与 Latest |

## 组件与职责

- `build-runtime.mjs`、`package.mjs`：固定 rc.2 commit/version并生成一致 Runtime 元数据。
- `sync-upstream-overrides.mjs`：适配 rc.2 源码锚点、预览 peer 和订阅 staging manifest。
- `adapt-subscriptions-plugin.mjs`：保留 DeepViewer 用量展示适配；新增版本声明适配时必须幂等。
- `dsh-plugins/preview`：更新 rc.2 peer 并在 rc.2 client 构建面重新编译。
- `ui-brand-official` 受控覆盖：在 DeepViewer checkout 中用独立 mark/name occupant 取代官方
  profile 门禁，确保本地与候选构建均占用新品牌槽位。
- `package.mjs`、`macos-signing.mjs`、`release-audit.mjs`：以 allowlist staging 生成独立架构
  应用，净化 Runtime 符号链接，审计个人数据并验证每个 Mach-O 与 DMG 的 Developer ID 签名。
- `notarize.mjs`：只接受 Keychain profile，等待 Apple Accepted 后装订 ticket，验证 DMG、
  Gatekeeper，并只读挂载应用再次评估；公证回执保存在 gitignored 的本地证据目录。
- `Resources/DeepViewer-0.2.3.png` 与双语 README：保存维护者原始产品图，在顶图、下载入口、
  当前版本说明和校验值之间保持同一 0.2.3 发布身份。
- Desktop tests：固定版本、启动参数、插件启用/禁用和打包契约。

## 接口与事件

不新增 preload/IPC。预览继续使用 `connection.rpc`、WebServer prefix route、
`conversation.details.view` 和 `shell.overlay`。订阅继续使用 DSH provider/model/tool、settings slot 与
OAuth 回环接口。rc.2 的凭据事件变化由上游 settings/adapter 层拥有，DeepViewer 只验证插件行为。

## 状态与数据模型

默认 JSONL 与隔离 `DSH_HOME` 不变。rc.2 新增的凭据记录和图片上传索引由上游在 DSH home 中拥有；
DeepViewer 不迁移或复制其内容。开发启动和正式 Runtime 继续使用不同的用户数据目录。

## 主要流程

1. 校验官方 rc.2 标签和提交，冻结依赖。
2. 更新版本门禁与插件 peer，在干净 checkout 应用受控覆盖。
3. 构建 rc.2 host/client、预览插件和完整 Web。
4. 运行 DeepViewer 单元、类型、生产构建和插件启用/禁用启动检查。
5. 启动 arm64 本地 DeepViewer Dev，由维护者检查品牌与工作区行为。
6. 清理并重建两个架构的 release-pack、Runtime、应用和 DMG，执行隐私、架构与签名验证。
7. 记录大小、SHA-256 与签名证据，同步双语 README/SDD，提交并快进合并到远端 `main`。
8. 将维护者产品图版本化保存，使用 Keychain profile 公证并装订两个最终 DMG，执行 Gatekeeper
   与只读挂载回读，重新计算最终大小和 SHA-256。
9. 提交最终 README/SDD 发布源码并推送 `main`；创建 `v0.2.3` tag 与公开 Latest Release，
   上传两个 DMG 和 `SHA256SUMS.txt`，回读服务器端资产与 CI 后补齐发布证据。

## 权限、安全与隐私

保持 loopback Web host、随机端口、工作区 containment、预览 CSP、订阅凭据权限和日志脱敏。
不读取或输出真实 token。插件禁用检查使用环境开关，不删除凭据或会话。

## 可观察性

启动日志记录 DeepViewer、DSH 和插件版本、启用状态与 loopback URL；不记录 OAuth code、token、
账户标识、消息正文或预览文件内容。失败必须指出组件和阶段。

## 兼容、迁移与回滚

- 0.2.2 Build 2 保持不变，可作为应用与 rc.8 核心回滚版本。
- 默认 JSONL 原位复用；不声明新的 SQLite 迁移。
- 任一插件可通过既有环境开关禁用，纯核心继续运行。
- 订阅 peer 修改只作用于构建 staging 副本，不修改 npm 缓存中的第三方包。

## 测试策略

- 静态：commit/version、peer、锁文件、唯一内核、受控锚点、默认 JSONL。
- 自动：上游 host/client/Web build，预览插件 type/bundle，DeepViewer tests/typecheck/build。
- 插件：两个插件分别启用、同时启用和分别禁用；RPC、设置、能力、降级及安全测试。
- 图片：依赖上游 rc.2 图片套件并检查桌面 Runtime 的 sharp/libvips 架构可用性。
- 封包：双架构 Runtime manifest/原生库架构、ASAR allowlist、符号链接 containment、敏感值扫描、
  逐 Mach-O 严格签名、DMG 签名与 `hdiutil verify`。
- 公开发布：notary Accepted、ticket staple/validate、Gatekeeper、只读挂载应用、tag/Release target、
  远端资产名称/大小/digest、Latest 与 GitHub Actions CI。
- 人工：开发窗口、品牌 mark/name、会话、输入框、预览、订阅真实账户和 About 版本。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 升级订阅插件主线版本 | 可能包含上游适配 | 同时引入大量提供方和 UI 功能变化 | 拒绝，本规格保持 0.3.1 |
| 忽略 peer 警告直接打包 | 改动少 | 不能证明无重复旧核心或契约兼容 | 拒绝 |
| 对 staging manifest 做最小 rc.2 适配 | 范围小、可回滚、保持 npm 原包不可变 | DeepViewer 需要维护适配测试 | 采用 |

## 设计决定

- 决策：Approved by direct maintainer instructions；2026-08-22 追加双架构签名候选包、文档
  同步与 `main` 合并设计，随后追加 0.2.3 产品图、公证与公开发布设计
- 审批人：Duoasa
- 日期：2026-08-22
