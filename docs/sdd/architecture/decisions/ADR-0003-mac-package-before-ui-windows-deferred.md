---
id: ADR-0003
title: macOS packaging first, UI and features next, Windows deferred
status: Accepted
date: 2026-08-15
supersedes: [ADR-0002]
---

# ADR-0003：macOS 封包优先，UI/功能紧随，Windows 后置

## 背景

ADR-0002 确定了 Electron、macOS 优先和最终支持 Windows 的总体方向，并要求在 macOS 桌面骨架后立即进行 Windows 冒烟验证。产品负责人进一步明确了当前优先级：先把 macOS 封包和运行生命周期验证到没有阻断问题，然后直接投入 DeepViewer 的 UI 与功能改造；Windows 适配不应打断 macOS 产品价值的形成。

## 决策

1. 继续使用 Electron，并保留 DeepViewer 最终支持 macOS 和 Windows 的产品目标。
2. 当前实施顺序改为：
   - macOS arm64 桌面封包与 Harness 生命周期验证；
   - macOS DeepViewer UI、信息架构与功能改造；
   - macOS 产品路径稳定后进行 Windows 适配；
   - 双平台签名、安装、自动更新与稳定发行。
3. DV-0003 按 [ADR-0004](ADR-0004-separate-macos-arm64-x64-artifacts.md) 验收 macOS arm64 与 Intel x64 独立产物，不要求 Windows 构建或启动冒烟。
4. 共享 RuntimeManager 仍需把 macOS 进程、路径和封包细节隔离在明确边界内，但本阶段不为尚未验证的 Windows 行为编写占位实现。
5. Windows 适配必须建立独立规格，基于已经稳定的产品流程定义等价行为和平台差异。

## 后果

### 正面

- 团队可以集中解决首个可安装客户端，不在早期分散到两套平台工具链。
- macOS 封包验证通过后可以立即开始用户可见的 UI 和功能价值建设。
- Windows 需求不会混入 macOS Spike 的完成定义，阶段边界更清晰。

### 代价与风险

- Windows 的 Shell、PTY、路径、编码和进程树问题会更晚暴露。
- 如果共享代码隐含 macOS 假设，后续 Windows 适配成本可能增加。
- 必须通过目录和接口边界控制平台耦合，而不能依靠提前实现 Windows 来验证。

## 备选方案

### macOS 骨架后立即做 Windows 冒烟

不再采用。它有助于提前发现平台问题，但会推迟已经确认优先的 UI 与功能改造。

### macOS 与 Windows 同时完整开发

拒绝。当前阶段会显著增加打包、测试和发布变量，降低首个产品闭环速度。

### 永久只支持 macOS

拒绝。Windows 仍是明确目标，只是实施优先级后置。

## 后续行动

- 更新 [DV-0003](../../specs/DV-0003-desktop-packaging-spike/spec.md)，移除 Windows 冒烟验收并保持平台边界约束。
- DV-0003 通过后建立 DeepViewer UI 与功能改造规格。
- macOS 产品路径稳定后建立独立 Windows 客户端规格。
