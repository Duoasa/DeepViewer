---
id: ADR-0009
title: Workspace-free Chat uses an official Agent preset
status: Accepted
date: 2026-09-20
---

# Chat 复用官方 Agent 预设

维护者批准 DV-0023 的 Chat / Work 方案并要求实现第一版。

使用系统预设 `deepviewer-chat` 和官方持久化 `agentPreset` 投影标记 Chat；无此标记的历史会话保持 Work。Chat 不注册工作区，内部 cwd 仅用于满足现有执行入口，不作为用户项目展示。

Chat 在 Host 创建及恢复时限制为 web_search/web_fetch，并安装最终执行守卫；独立 Persona 不读取项目规则。模型、会话日志、图片及附件存储继续复用官方服务。文本附件通过已经校验的附件对象读取，不能将模型提供的路径作为本地文件入口。

避免另建聊天引擎或仅以 UI 开关表示模式。代价是增加一个发行预设和少量可复现的 Host/Client 适配；旧版没有此预设时不能执行新 Chat 会话。已有 Work 数据及固化的 0.2.9 产物不迁移。
