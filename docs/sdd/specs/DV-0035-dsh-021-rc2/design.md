# DV-0035 Design

Status: Implementing

- D-001 (R-001): 使用独立 checkout 和新内核，精确 pin 版本、提交、Cordis 和工具链；测试元数据由同一 pin 派生。
- D-002 (R-002): 原生随机回环端口与 manifest 更新 channel 替代旧补丁；DeepViewer preview 仅映射现有 feed 文件名，稳定版不可被环境变量切换；clientBundle 使用 packageDir；源码适配先校验全部锚点再写入，已上游实现的字段扩展退休。
- D-003 (R-003): 按新版 Session create/reuse 与导航入口重接 Chat 策略；保留取消、并发、归档、子代理归属和 cwd 校验。样式基线吸收必要的新结构，自有前端设计不改。
- D-004 (R-004, NFR-001): 隔离 profile 运行 Host/模块测试；建立构建、源码、DOM、API 分层证据；真实账户与视觉 Pending Manual。

## D-005 — 0.7.1 发布 (R-005, AC-006)

沿用 package-native 的全新 runtime/staging、Developer ID 和双公证流程。保持数据根目录和自动更新 feed；公开 DMG 与本次校验清单。tag 指向通过 CI 的合并源码；包内源码与 tag 只允许发布证据文档差异。界面验收引用维护者直接反馈，账户验收不推定完成。
