---
id: DV-0011
title: Subscription provider plugin integration - Design
status: Implementing
updated: 2026-08-18
---

# DV-0011：设计

## 方案摘要

桌面包固定插件依赖。开发态从工作区依赖解析插件，封包态从不可变 Runtime 解析插件；适配器
校验 manifest 后把插件自带 `cordis.patch.yml` 传给 `dsh web`，并提供模块解析路径。校验
失败则不注入插件。Web client 仍由 DSH 的 `dsh.client` 契约发现并注册标准设置 slot；
DeepViewer 设置外壳将该 slot 组合进“模型”页面，不复制插件组件。

## 需求映射

| 需求 | 设计 |
| --- | --- |
| R-001, R-008 | 精确依赖、Runtime 清单与只读封装 |
| R-002, R-007 | 主进程插件解析器、manifest 预检、禁用开关和诊断 |
| R-003, R-004 | DSH bundle/client/provider 官方扩展点 |
| R-005, R-006 | 隔离 DSH home；正式分发 Keychain 门禁 |

## 组件与职责

- `build-runtime.mjs`：把固定插件装入 Runtime，净化无运行价值的开发元数据并写入清单。
- `resource-locator.ts`：按开发/封包位置解析插件，校验版本和入口，生成 patch 参数与
  `NODE_PATH`；绝不读取凭据。
- `adapt-subscriptions-plugin.mjs`：对固定 `0.3.1` Web client 执行可重复、严格锚点校验的
  本地展示适配；开发 staging 与 Runtime 使用同一适配器。
- DSH 插件：拥有 provider、OAuth RPC、设置 UI、本地化和凭据生命周期。
- RuntimeManager：只记录适配器诊断，不记录插件输入、响应或凭据。

## 主要流程

1. 启动时定位 DSH 与插件；禁用或预检失败则生成无插件启动规格。
2. 预检通过后，以 `web --patch <plugin>/cordis.patch.yml --port 0` 启动 rc.7。
3. DSH 从插件 manifest 发现 Web client；插件继续通过 `settings.section` 注册 `subscriptions`。
4. DeepViewer 设置外壳隐藏独立订阅导航，在 `models` 内容后以通用分割线组合渲染订阅 slot；
   模型内层标题本地化为“API”，页面级“模型”标题保持不变。
5. OAuth 授权页交给系统浏览器，回调与令牌生命周期由插件处理。

## 权限、安全与隐私

`DSH_HOME` 继续位于 DeepViewer 独立 userData。插件的 `auth.json` 使用原子替换和 0600；
DeepViewer 不增加凭据 IPC。正式发行前必须另行完成 Keychain 适配和迁移/删除语义评审。

## 兼容、迁移与回滚

无历史数据迁移。设置 `DEEPVIEWER_DISABLE_SUBSCRIPTIONS=1` 或移除固定 patch 即可回滚为
纯 rc.7 核心。插件升级必须显式更新版本与契约测试。

## 测试策略

- 单元/契约：开发与封包解析、版本/入口校验、禁用和缺失降级、无敏感诊断。
- 用量适配：剩余量换算、三级阈值、本地化周期文案、重复应用幂等性和锚点漂移失败。
- 构建：Runtime 清单、路径净化、类型检查、测试与 production build。
- 人工：中英文/主题、登录/登出、模型与工具、外部服务失败。视觉检查由维护者执行。

## 备选方案

| 方案 | 结论 |
| --- | --- |
| 完整复制插件源码 | 拒绝；扩大分叉和审计面 |
| 运行时安装插件 | 拒绝；破坏可复现与签名边界 |
| 精确版本 + 薄适配器 | 采用 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-18
