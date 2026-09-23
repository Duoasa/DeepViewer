# DeepSeek Harness Upstream Checkout

本目录保留 DeepViewer 开发使用的官方上游源码副本。实际 checkout 位于 `upstream/deepseek-harness/`，并被 DeepViewer 的 Git 忽略，避免把嵌套仓库和数千个上游文件重复提交到本仓库。

## 当前分析基线

- 仓库：<https://github.com/deepseek-ai/deepseek-harness>
- 标签：`dsh-v0.1.5-rc.2`
- 提交：`fb2c4b9e698e30edb738bca4cf0618587db7d203`
- 上游版本：`0.1.5-rc.2`
- 本地路径：`upstream/deepseek-harness/`

这是正式构建使用的固定官方 checkout。DeepViewer 通过上游 release-pack 和 DSH 扩展点集成，
不把该目录提交为 fork、subtree 或 vendored 源码。

## 刷新上游副本

```sh
git -C upstream/deepseek-harness fetch --tags origin
git -C upstream/deepseek-harness checkout dsh-v0.1.5-rc.2
```

刷新后，应把新的提交 SHA 写回本文件，并重新检查 [`DV-0002`](../docs/sdd/specs/DV-0002-upstream-foundation/spec.md) 中依赖的架构假设。

## 私有 0.3.1 固化快照

当前 0.3.3 公共版本的派生源码完整差异保存在 [snapshots/v0.3.3](snapshots/v0.3.3/README.md)，包含可从上述官方基线还原的源码 patch、源树与 SHA-256 校验。它不改变官方基线版本，也不包含安装包或用户数据。
