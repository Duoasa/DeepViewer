# 验证

2026-09-16；仅冒烟，不运行完整测试套件。规格保持 Implementing，AC-004 Pending Manual。

2026-09-17；按维护者要求仅做冒烟，并完成开发版启动前验收。规格保持 Implementing，AC-004/AC-006/AC-008 Pending Manual。

| AC | 结果 | 可复现证据 |
| --- | --- | --- |
| AC-001 | Passed | Node 24 下运行 `node apps/deepviewer-desktop/scripts/build-reasoning-plugin.mjs`；Host/Client bundle 构建成功；`pnpm desktop:build` 成功。 |
| AC-002 | Passed | `node apps/deepviewer-desktop/scripts/smoke-reasoning-plugin.mjs`：保存、恢复、其余模型字段保留、非法输入和 secret guard；原生 provider-card 注册、revision 传递和冲突不重试。 |
| AC-003 | Passed | Node 24 下运行 `node apps/deepviewer-desktop/scripts/smoke-reasoning-host.mjs`，需允许临时 loopback 端口：隔离 DSH_HOME 的 Host 页面声明插件；真实 settings Remote 保存 low/high 后 modelCatalog 同步反映；旧 revision 被拒绝；恢复后能力消失。模拟 endpoint 指向本地关闭端口，未发起模型推理。 |
| AC-004 | Pending Manual | 维护者在开发版检查设置 → 模型 → 模型思考强度，以及 easyrouter 实际档位效果；各模型可用性不代表思考参数兼容性。 |

本轮通用能力扫描扩展证据：

- `node apps/deepviewer-desktop/scripts/smoke-model-scanner.mjs` Passed：网关 pricing 声明优先、模型目录回退、图片识别成功/拒绝/不确定、权限受限模型保留、404 连续两次确认后才标记 delisted、应用/恢复、报告持久化、取消和单作业限制。
- `node apps/deepviewer-desktop/scripts/smoke-reasoning-plugin.mjs`、`smoke-reasoning-wire.mjs` Passed：手动图片输入配置、图片 data URL 保留及原生载荷映射。
- `node apps/deepviewer-desktop/scripts/smoke-reasoning-host.mjs` Passed（需临时 loopback 权限）：隔离 Host 的扫描 RPC、本地模拟 API、图片能力应用/恢复及 `resolveModelInfo` 映射。
- `pnpm desktop:smoke` Passed（2 个测试文件、8 个测试）；`pnpm typecheck` 与 `pnpm desktop:build` Passed。没有调用真实 easyrouter，也没有扩大为完整回归测试。
- 开发构建号：`apps/deepviewer-desktop/scripts/bump-build-number.mjs` 已接入 `desktop:build`，本次从 Build 2 自动递增到 Build 3；开发 watcher 忽略仅由该字段变化产生的 `package.json` 事件，避免递增触发循环重启。

额外启动冒烟：直接导入 resource-locator.ts，临时 profile 原生插件链接、显式停用、缺包降级均通过。临时 Host 已退出，没有启动 Electron GUI 或开发 watcher。

本轮只接入开发 staging 与 ARM runtime 构建脚本，未重新生成发行 runtime、签名包或安装至正式 app。已签名应用未修改，未提交/推送 GitHub。

关联 API 排查：104 项中 37 个最小文本流请求成功，43 个连续两次 403，24 个非文本模型未发起生成。用户本机配置已备份并保留 37 个通过模型；含具体模型清单的本机报告在 `out/model-audit/report.md`，不纳入版本控制。


## 通用扫描扩展冒烟（2026-09-16）

- AC-005 Passed：`node apps/deepviewer-desktop/scripts/smoke-model-scanner.mjs`，两个不同提供方的有界探测、非法值对照、401/403/404 二次确认、未知保留、配置过期拒绝、应用/恢复、报告重载、取消和单作业限制。
- AC-005 Passed：Node 24 `node apps/deepviewer-desktop/scripts/smoke-reasoning-host.mjs`，隔离 Host 通过认证插件 RPC 调用本地模拟 API，8 次短探测，实际设置应用/恢复及 modelCatalog 联动通过；没有访问真实 API。
- Client bundle 构建、原生 provider-card 注册及纯配置冒烟通过。AC-006 位置与交互仍 Pending Manual；未代替维护者验收。
- 适用范围：OpenAI Chat Completions 兼容聚合 API。新增 API 显示扫描提示，由用户点击启动；不自动后台收费。不存在 easyrouter 专属模型名单或域名。

0.3.3 的公开源码、安装包及模型插件冒烟证据见 DV-0032；此前本地交付材料不包含在公开源码中。
