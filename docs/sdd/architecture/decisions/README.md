# Architecture Decision Records

ADR 记录影响多个功能、难以逆转或会持续影响上游同步的架构选择。

## 状态

- `Proposed`：等待评审
- `Accepted`：当前有效
- `Deprecated`：仍可能存在，但不再推荐
- `Superseded`：被后续 ADR 替代

## 索引

| ADR | 标题 | 状态 | 日期 |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-sdd-as-source-of-truth.md) | 使用仓库内 SDD 作为开发事实来源 | Accepted | 2026-08-15 |
| [ADR-0002](ADR-0002-electron-mac-first-cross-platform.md) | Electron 桌面壳与 macOS 优先的双平台路线 | Superseded | 2026-08-15 |
| [ADR-0003](ADR-0003-mac-package-before-ui-windows-deferred.md) | macOS 封包优先，UI/功能紧随，Windows 后置 | Accepted | 2026-08-15 |
| [ADR-0004](ADR-0004-separate-macos-arm64-x64-artifacts.md) | 分别发布 macOS Apple Silicon 与 Intel 产物 | Accepted | 2026-08-15 |
| [ADR-0005](ADR-0005-developer-id-notarized-macos-dmgs.md) | 使用 Developer ID 签名并公证 macOS DMG | Accepted | 2026-08-16 |
| [ADR-0006](ADR-0006-version-pinned-dsh-plugin-integration.md) | 固定版本并通过 DSH 扩展点集成第三方插件 | Accepted | 2026-08-18 |
| [ADR-0007](ADR-0007-extensible-details-preview-panel.md) | 可扩展详情栏与工作区范围预览插件 | Accepted | 2026-08-18 |

## 模板

```markdown
---
id: ADR-NNNN
title: Decision title
status: Proposed
date: YYYY-MM-DD
supersedes: []
---

# ADR-NNNN：标题

## 背景

## 决策

## 后果

### 正面

### 代价与风险

## 备选方案

## 后续行动
```

接受后的 ADR 不重写历史。新信息通过新 ADR 替代旧决策，并在双方文件中建立链接。
