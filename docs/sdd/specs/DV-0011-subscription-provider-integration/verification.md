---
id: DV-0011
title: Subscription provider plugin integration - Verification
status: Implementing
updated: 2026-08-18
---

# DV-0011：验证

## DSH 插件检查

- 目标内核：DeepSeek Harness `0.1.0-rc.7`
- 登记插件：[`DVP-0001`](../../integrations/dsh-plugins.md)
- `PC-001`—`PC-007`：Pass；对应固定依赖、配置树、Web client、能力注册、安全边界和降级测试。
- `PC-008`：Pending；缺少 rc7 release-pack tarballs，本轮未进入封包边界。
- `PC-009`：Partial Pass / Pending Manual；维护者已确认真实订阅账户登录成功，状态/用量、
  实际调用与登出仍待确认。

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 契约测试 + rc7 冒烟 | Pass | 配置树、实际启动图与插件 client 均包含固定插件 |
| AC-002 | 契约测试 + 人工 | Automated Pass / Pending Manual | 独立订阅导航已隐藏；模型页按 API、通用分割线、订阅组合；维护者检查主题与交互 |
| AC-003 | 人工 | Partial Pass / Pending Manual | 维护者已确认真实账户登录成功；登出、模型与工具仍待检查 |
| AC-004 | 自动契约测试 | Pass | 缺失/禁用/版本不符降级与启动失败重试测试通过 |
| AC-005 | Runtime 构建检查 | Pending | 当前无 rc7 release-pack tarballs；本轮不执行封包 |
| AC-006 | 自动检查 + 人工 | Automated Pass | 83 tests、28 项 rc7 设置测试、typecheck、桌面与上游 production build 通过 |
| AC-007 | 适配器测试 + 生成物检查 | Pass | 31% 已用显示为 69% 剩余；三级阈值、周期窗口、幂等适配和源码漂移阻断通过 |

## 执行摘要

- 冻结锁文件离线安装通过；插件固定为 `0.3.1`，未自动安装 rc6 peer 依赖。
- rc7 `--dump-config` 与真实 Web 启动通过；DeepViewer Dev 日志显示插件启用并一次就绪。
- 插件运行时 peer 显式解析到 rc7 checkout；启动图包含其 Web client 与本地化依赖。
- 插件保留标准 `settings.section` 契约；DeepViewer 外壳将其组合到模型页，不复制插件组件。
- `deepviewer-remaining-usage-v1` 同步适配开发 staging 与 Runtime，并记录在 Runtime 插件清单。
- 凭据实现仍为隔离 DSH home 下的原子 `0600` 文件；日志脱敏测试覆盖 OAuth code/token。
- 维护者于 2026-08-18 确认真实订阅账户登录成功。

## 残余风险

- 外部订阅服务使用非稳定协议；自动检查不能替代真实账户冒烟。
- 完整 Runtime 封装等待显式封包边界和 rc7 release-pack tarballs。
- 正式分发前仍需完成 Keychain 凭据适配。

## 结论

- 结果：Pending
- 验证人：
- 日期：
