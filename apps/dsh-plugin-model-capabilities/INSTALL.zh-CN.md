# 模型能力插件 1.0.1：构建、安装与迁移

本版包名为 `@deepviewer/dsh-plugin-model-capabilities`，适配 DSH `0.1.7-rc.2` / Cordis `4.0.4`。DeepViewer 开发版已将它作为原生集成，替换旧 reasoning 插件，无需重复安装。下列安装命令用于其他兼容 DSH 环境；未发布到公共 npm。

## 安装本地包（推荐）

安装包 `deepviewer-dsh-plugin-model-capabilities-1.0.1.tgz` 已包含编译产物、完整源码和测试。在已安装兼容 DSH 的机器上，无需重新编译：

```sh
dsh plugin --profile web add /absolute/path/deepviewer-dsh-plugin-model-capabilities-1.0.1.tgz
```

完成后重启目标 DSH 客户端。安装前在分发文件夹中运行 `shasum -a 256 -c SHA256SUMS.txt` 可验证文件完整性。旧能力插件的替换要求见下文。

## 从源码使用

在独立插件目录安装开发依赖和 DSH peers 后：

```sh
npm ci
npm test
npm run check
npm run build
dsh plugin --profile web add /absolute/path/dsh-plugin-model-capabilities
```

然后重启目标 DSH 客户端。构建文件为 `lib/index.js` 与 `lib/client.js`，配置补丁为 `cordis.patch.yml`。可用 `DSH_TOOLCHAIN=/path/to/build-tools npm run build` 指定含 esbuild 的工具目录；源码不依赖某个 `/Applications/*.app` 路径。

## 替换旧版

旧 `@deepviewer/dsh-plugin-model-capabilities` 与本版共用 Host id / RPC 通道，不能同时激活。先从目标 profile 移除旧能力插件，再添加本版；移除插件不会删除扫描记录。

DeepViewer 原先的 reasoning 插件只贡献模型设置页扫描和编辑面板；会话思考档位选择由 DSH 原生提供。新的桌面启动路径只挂载 model-capabilities，原生菜单继续读取同一模型配置。现有模型、凭据与旧扫描文件保留，只移除该 Runtime 自己管理的旧插件符号链接。独立 DeepViewer 不参与迁移。

其他环境如果曾手动安装旧 reasoning 插件，应先核实自己的 profile 条目并移除重复挂载。旧 Host id 可能为 `deepviewer-model-reasoning` 或 `deepviewer-model-reasoning`。新插件仍使用 keyed slot 避免重复扫描面板。

## 使用规则

设置 → 模型 → API 提供方卡片 → 模型能力扫描。

- 默认仅扫描已添加模型，可切换为扫描 API 列出的模型。
- 优先找能跑通的请求：角色降级、token 字段切换、输出预算重试，最后验证图片与思考参数组合。
- 组合失败先尝试保留图片并关闭思考档位，再尝试纯文本。失败或中断的响应不会标为可用。
- 查看“将应用”的实际配置，再点“应用扫描结果”。验证成功的配置可以覆盖以前的手动能力设置。
- 应用前的配置可恢复；修改配置或手动保存后，旧扫描失效，避免覆盖新操作。
- 目录声明只用于参考；未验证的档位不冒充已生效。
- 默认每模型最多 12 个请求，会产生 API 费用。内网服务仍需 HTTPS，localhost/loopback 可使用 HTTP。

## 旧记录迁移

新文件：`$DSH_HOME/deepviewer-model-capability-scans.json`（schema 4，权限 0600）。仅在同一个 DSH_HOME 中依次寻找旧 `model-capability-scans.json`、`deepviewer-model-scans.json`、`deepviewer-model-scans.json`。

保留旧原件，只迁移历史摘要并要求重新扫描；不导入旧错误正文和旧恢复快照，也不搜索独立 DeepViewer 的数据目录。新文件存在时优先读取新文件。显式指定旧 `storeFile` 时先创建唯一备份；无法识别的文件不会被覆盖。

## 验证与卸载

`npm test` 为离线模拟测试，`npm run check` 检查类型，`npm run build` 构建。`scripts/smoke-runtime.mjs` 在发送前捕获真实 pi-ai 参数；`DSH_ROOT=/path/to/dsh node scripts/smoke-host.mjs` 使用临时 profile 做 Host 冒烟。它们不调用你的内部 API，也不承担真实账户验收。

卸载：

```sh
dsh plugin --profile web remove @deepviewer/dsh-plugin-model-capabilities
```

重启目标客户端。扫描记录和旧版备份保留，按需单独管理。
