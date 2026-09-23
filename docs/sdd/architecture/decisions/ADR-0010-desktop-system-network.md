---
id: ADR-0010
title: Desktop system routing and private web access consent
status: Accepted
date: 2026-09-22
supersedes: []
---

# 桌面系统网络与内网授权

DV-0029 的维护者授权要求自动适配网络，内网访问改为弹窗授权。Electron 的 Chromium 会读取 macOS 系统代理/PAC，但启动的 Node DSH 不会自动继承该路由；Surge fake-IP 又会被公共网页工具按非公网地址拦截。

桌面进程拥有临时、随机鉴权的 loopback HTTP 中继，每条新连接通过 `session.resolveProxy` 查询当前系统路由。进程与 DSH home `.env` 显式代理优先，其策略保存在中继，不持久化修改用户配置。HTTP CONNECT、HTTPS CONNECT 和 SOCKS 按配置执行，仅按明确的 PAC 顺序回退，不另加直连退路，不重放业务 POST。

网页抓取使用单独鉴权的匿名 GET 接口。DSH 仅从启动时的 process 环境快照接收此能力，项目 `.env` 不能开启它。每个跳转重新判断目标；公网直连固定 DNS 地址，可信代理负责公网名称的远端解析。内网、loopback、非公网字面地址须弹窗批准，授权绑定主机、端口和解析地址集合；批准后直接连接这些地址。提供拒绝、一次、本次运行三种选择。普通模型/MCP/终端请求保持其既有权限语义。

保持 TLS 验证，不共享浏览器 Cookie，只记录目标主机、端口和错误码。退出时取消授权等待并关闭连接。代价是增加桌面传输适配与测试责任；代理自身、证书环境和目标网站的登录/反爬要求仍可能导致请求失败。原生 CLI 不启用此桌面能力，保留原有公共网络检查。
