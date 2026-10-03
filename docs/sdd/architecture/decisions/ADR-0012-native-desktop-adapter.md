# ADR-0012 — DeepViewer 原生 DesktopHost 与应用适配层

Status: Accepted
Date: 2026-10-03
Specification: DV-0033

## Context

Scoder 已从 DeepViewer 旧自建桌面壳迁到 DSH 0.2.0-rc.2 官方 Electron/DesktopHost。维护者要求将其最新实现迁回 DeepViewer。

## Decision

采用固定 DSH 原生桌面架构，产品功能集中于 apps/deepviewer-adapter 和可校验的契约接点。原生服务负责会话、文件、预览、Finder 和权限；应用内置模块负责品牌、Work/Chat、订阅、模型能力和 Synapse。旧整文件覆盖与 Better Sidebar 不参与新默认构建。不改上游 agent loop。

## Consequences

DeepViewer 保留独立品牌、数据目录、版本和发布通道；上游 checkout 是可重建输入。内核升级须重新验证契约与内置模块。旧安装包继续由历史发布记录解释，不将新开发基线误记为已发布。
