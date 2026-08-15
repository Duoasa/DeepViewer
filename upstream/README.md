# DeepSeek Harness Upstream Checkout

本目录保留 DeepViewer 开发使用的官方上游源码副本。实际 checkout 位于 `upstream/deepseek-harness/`，并被 DeepViewer 的 Git 忽略，避免把嵌套仓库和数千个上游文件重复提交到本仓库。

## 当前分析基线

- 仓库：<https://github.com/deepseek-ai/deepseek-harness>
- 分支：`master`
- 提交：`47f943859bef60e4160492346772ded9b24f765a`
- 提交时间：`2026-08-13T19:38:46+08:00`
- 上游版本：`0.1.0-rc.5`
- 本地路径：`upstream/deepseek-harness/`

这是一个 `--depth 1` 的参考 checkout。它用于架构分析和后续上游对比，不代表 DeepViewer 已决定采用 fork、subtree、vendor 或依赖集成。

## 刷新上游副本

```sh
git -C upstream/deepseek-harness pull --ff-only origin master
```

刷新后，应把新的提交 SHA 写回本文件，并重新检查 [`DV-0002`](../docs/sdd/specs/DV-0002-upstream-foundation/spec.md) 中依赖的架构假设。
