---
id: ADR-0004
title: Separate macOS Apple Silicon and Intel artifacts
status: Accepted
date: 2026-08-15
supersedes: []
---

# ADR-0004：分别发布 macOS Apple Silicon 与 Intel 产物

## 背景

DeepViewer 的 macOS 首发需要同时覆盖 Apple Silicon 新机和仍在大量使用的 Intel Mac。Harness 包含 Node 运行时以及可能按 CPU 架构编译的原生依赖，只发布 arm64 会直接排除 Intel 用户。

## 决策

1. macOS 封包阶段必须分别生成 `arm64` 和 `x64` 两套应用与未签名测试安装包。
2. 两套产物使用相同的 DeepViewer/Harness 版本、功能和配置契约，但各自携带匹配架构的 Electron 与原生依赖。
3. 文件名必须明确包含架构，避免用户下载错误产物。
4. 自动化构建至少验证两套产物的 Mach-O 架构和资源清单。运行冒烟优先在原生架构执行；Apple Silicon 上的 x64 Rosetta 测试可以作为补充，不能永久替代真实 Intel 环境验收。
5. 当前不合并为 Universal Binary。稳定发行阶段可以重新评估 Universal 包，但不得因此取消独立架构构建和测试能力。

## 后果

### 正面

- Intel Mac 用户可以安装运行 DeepViewer。
- 原生依赖按架构分开构建，包体积和问题定位更清晰。
- 两个架构可以独立重试、签名和发布。

### 代价与风险

- 构建、存储、下载和验证成本接近翻倍。
- 当前 arm64 开发机无法完全替代真实 Intel Mac 的运行验证。
- 所有 Harness 原生依赖必须存在对应 x64 构建，缺失时不能只验证 Electron 外壳。

## 备选方案

### 只发布 arm64

拒绝。不能覆盖明确要求支持的 Intel Mac 用户。

### 只发布 Universal Binary

当前不采用。单文件更方便，但会增大体积，并使原生依赖缺失或架构混装更难诊断。

## 后续行动

- 更新 DV-0003 的构建脚本、验收条件和验证矩阵。
- 在可用的 Intel Mac 或 CI macOS x64 runner 上补充原生运行证据。
- 稳定发行规格决定签名、公证、DMG 布局和 Universal 包是否有价值。
