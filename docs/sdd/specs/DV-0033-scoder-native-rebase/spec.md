# DV-0033 — Scoder 最新源码迁回 DeepViewer

Status: Implementing
Owner: Duoasa
Date: 2026-10-03
Approval: 维护者直接指令：使用 Duoasa/scoder 源码换回 DeepViewer，作为最新 DeepViewer。2026-10-03 维护者进一步明确授权制作 0.5.0 macOS arm64 正式签名公开安装包、发布到 Duoasa/DeepViewer 并合并 main。定向白屏诊断与 metadata 热更新验证按本次授权执行；其启动证据不代替完整人工验收。

## 来源与范围

源为 Scoder main `e277adc6ce512655095e6f65c63bdc72d24bae95`（0.7.0 Build 43），目标内核为 DSH `0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84`。DeepViewer 初始迁入开发基线为 0.4.0，build 从既有 75 递增；白屏修复已验证到 Build 88，本次公开安装包目标为 0.5.0，最终发布 build 待构建证据确认。保留现有 Git 历史、SDD 和公开发布记录；不导入 Scoder 的个人数据或将其发布记录当作 DeepViewer 发布。

## Requirements

- R-001: 导入该固定 Scoder 源码的原生 Electron/DesktopHost、adapter、模型能力、订阅、Work/Chat、编辑器/Git、Synapse 会话图谱、网络与隐私能力；不回放旧 0.1.5 整文件覆盖。
- R-002: 应用、菜单、关于、启动/欢迎页面、思考文案、图标、包名、环境变量和发布目标恢复 DeepViewer；使用既有 DeepViewer 原图标，不保留 Scoder 鸭形象。
- R-003: 稳定版/开发版继续使用 Application Support/DeepViewer 和 DeepViewer Dev，以及 harness-home、Documents/DeepViewer/Projects、既有布局 ledger；显式测试目录隔离，不扫描 Scoder/Saidex。
- R-004: 内核迁移在打开持久存储前创建私有完整性校验快照；移除旧侧栏/reasoning 挂载，由原生功能和模型能力模块承接，保留用户配置与凭据引用、回滚备份。
- R-005: 开发命令、固定依赖、插件/内置模块构建和更新配置均面向 DeepViewer；自动更新不得访问 Scoder release。
- R-006: 开发 watcher 按源码内容识别变化；client artifact 仅 ctime/权限等 metadata 改变且 mtime、大小、内容不变时，不发出重构建通知或卸载已挂载的浏览器模块；真实内容变化及 mtime 构建戳仍触发热更新。
- R-007: 从本次固定源码及依赖重新构建 DeepViewer 0.5.0 macOS arm64 安装资产，发布目标为 [Duoasa/DeepViewer](https://github.com/Duoasa/DeepViewer)；记录最终 build、源代码提交、签名/公证、净化审计、资产 SHA-256 与远端核验结果。
- NFR-001: 保留上游版权和许可证，不改上游 agent loop；源码仓库不提交凭据、用户数据或本地产物。
- NFR-002: 代理完成基础验证及维护者明确授权的本次正式签名公开安装包、源码推送/发布和 main 合并；视觉交互、旧数据完整性及真实账户验收保持维护者职责。未得到通过证据的发布与验收项保持 Pending，不因发布授权或启动状态自动提升规格。

## Acceptance

- AC-001: 导入来源固定、适配契约/原生模块/Synapse 检查可复现通过。
- AC-002: 当前源码及配置中品牌、图标、数据隔离和 DeepViewer 更新目标检查通过。
- AC-003: 同渠道迁移、配置承接、完整性快照与回滚的隔离测试通过；Scoder/Saidex 不成为候选。
- AC-004: 冻结依赖安装、typecheck、相关 smoke 和 production build 通过。
- AC-005: 维护者确认视觉、交互、旧会话与附件连续可用（Pending Manual）。
- AC-006: 插件 PC-001～PC-009 覆盖；真实订阅账户、实际模型调用和正式更新验收 Pending Manual。
- AC-007: metadata-only 变化不造成 renderer 热卸载；真实改字节及 mtime 构建戳仍触发更新。真实链路测试及定向 180 秒运行观察可复现通过。
- AC-008: 0.5.0 arm64 安装资产从本次源码和固定依赖全新生成；签名/公证、净化审计、DMG 完整性、SHA-256 清单和 GitHub 远端 digest 有最终证据。最终发布 build 与资产证据待完成后补齐。

## Plugin boundary

已读取 integrations/dsh-plugins.md：DVP-0001 subscriptions 0.3.1 保留为内置模块；DVP-0003 reasoning 被 model-capabilities 承接；DVP-0004 Better Sidebar 由 DSH 原生右侧工作台承接并退出挂载。DVP-0002 保持 Disabled，DVP-0005 保持 Removed。新增 DVP-0006 model-capabilities 1.0.2 与 DVP-0007 DeepViewer adapter，均为应用内置模块。兼容、安全降级、配置承接和打包契约必须检查，未获人工证据不得提升为 Verified。

## 回滚

源码可恢复既有 Git 基线；上游旧派生 checkout 在替换前保留本地副本。初始源码迁入未修改用户数据；实际内核启动通过 kernel-v020 快照及独立目标恢复函数回滚，不覆盖新内核已写入会话。
