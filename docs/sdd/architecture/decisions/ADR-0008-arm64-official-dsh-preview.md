---
id: ADR-0008
title: ARM-only development and official DSH preview
status: Accepted
date: 2026-09-14
supersedes: [ADR-0004, ADR-0007]
---

# ARM 与官方 DSH 预览

维护者在 DV-0017 中明确要求放弃 x86，只支持 arm64，并指定使用 DSH 官方预览，保留右上角展开、收起与全屏操作。

开发与后续构建入口只接受 macOS arm64。维护者追加授权以 `v0.2.5-preview.1` 发布 ARM 公开预览。历史双架构发布不变；ADR-0005 的签名、公证要求继续执行，其双架构范围由本决策收敛为 arm64。

预览采用 DSH 0.1.5-rc.2 的官方右侧面板、资源寻址与文档/网页渲染。DVP-0002 保留历史源码但停止参与构建和启动。原生文件菜单桥接到官方 Chat 使用的 fileAddressFor/openResource；按钮保持窗口右上角位置，展开、收起、全屏的操作继续调用同一官方状态服务，不创建第二份面板状态。

订阅插件继续固定 0.3.1，适配 ToolCallId 改名、客户端服务和私有图片组件构建。开发数据按 DSH 版本隔离，旧会话和凭据不自动迁移。

代价是 Intel 无法使用本轮及后续 ARM 构建，旧预览定制退出当前产品，实际交互需维护者实机验收。公开 Preview 使用版本专属数据目录，验证范围为发布产物检查与冒烟，完整回归未执行。
