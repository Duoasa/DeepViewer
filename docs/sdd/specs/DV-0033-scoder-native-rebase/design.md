# DV-0033 Design

Status: Implementing

## D-001：固定来源与适配层 (R-001, R-005, NFR-001)

导入 Scoder 固定 main 的 apps、依赖清单及构建工作流，并将 scoder-adapter 统一为 deepviewer-adapter、@deepviewer scope。DSH 固定 0.2.0-rc.2 源码独立 checkout；兼容契约校验锚点后写入，不把旧派生源码覆盖到新内核。保留 DeepViewer 文档历史和许可证。长期决策见 ADR-0012。

## D-002：身份与数据 (R-002, R-003, R-004)

恢复 DeepViewer PNG/ICNS/SVG；思考文案恢复“深度求索中”。沿用现有数据根和 .deepviewer-layout.json；移除 Scoder/Saidex 历史目录候选。新 desktop profile 仅在所属 home 内复制旧 web 配置，创建 kernel-v020 备份并退休旧插件声明，模型能力读取既有 reasoning 配置。数据测试只使用临时目录。

## D-003：验证与交付边界 (NFR-002, R-005)

执行冻结安装、typecheck、隔离数据/模块/源码契约/Synapse 测试和构建。保留 Pending Manual；在维护者明确要求的发布同步边界补齐本规格与发布记录；历史版本记录保留。初始构建不启动桌面应用，后续定向诊断与运行观察只记录实际获得的启动/热更新证据。

## D-004：metadata 与热更新连续性 (R-006, AC-007)

开发 watcher 对允许的源码输入计算内容指纹，忽略 metadata-only 变化和相同字节重写。DSH client artifact 的固定兼容契约先检查 mtime、大小与已缓存 bundle 字节；三者不变时只刷新 metadata baseline，保留当前 graph/revision，不发布 rebuilt frame。字节变化即使保留 mtime 和大小也必须产生新 revision；mtime 构建戳必须继续通知 sibling chunk 构建，不能仅以入口字节相同为由忽略。

验证将真实 ClientArtifactRegistry、HmrSupervisor、browser runtime 与模拟传输连接成一条链路，分别验证 metadata-only、字节变化和 mtime 构建戳。180 秒实际运行观察检查四个核心模块的 metadata 变化、rebuilt 计数与 root 挂载状态；不据此判定视觉交互或真实账户通过。

## D-005：0.5.0 arm64 发布 (R-007, AC-008, NFR-001, NFR-002)

按维护者 2026-10-03 的明确授权，从本次源码与锁文件清理并重新生成 Runtime、staging、应用和安装资产。签名/公证、最终包净化审计、DMG 完整性与校验清单必须绑定实际产物；发布到 Duoasa/DeepViewer 后核验远端 digest。最终源提交、build、资产大小和 SHA-256 以 [v0.5.0 发布记录](../../releases/v0.5.0.md) 为权威位置，待完成项明确为 Pending。源码推送和 main 合并结果独立记录；发布授权不构成已发布证据。自动更新 feed 仍受真实安装/更新 qualification 门禁约束；本次 installer 发布不绕过或自动满足该门禁。

### D-005a：builder metadata 与库存一致性

Electron builder 会转换依赖 package.json，若先封存未转换字节，实际 ASAR 会与库存 SHA-256 不一致。`normalizeNativePackageMetadata` 在 `writeDesktopRuntime` 封存前使用本次固定 electron-builder 的真实 transformer 规范化 runtime 下的依赖清单，并要求二次转换返回明确的 no-change 结果；无效 JSON、链接/特殊条目、转换失败或不幂等均阻断。运行时依赖入口、exports/imports、依赖关系、版本、许可与许可证原件保留。

随后封存确切字节并由原验证器对实际 builder ASAR 逐文件核验。不能通过跳过 package.json、放宽哈希比较或只检查包名来消除漂移。Build 90 的真实 staging 扫描 755 份清单、规范化其中 268 份，实际 ASAR 库存验证通过。
