---
id: DV-0008
title: Local development and release-tier workflow - Design
status: Implementing
updated: 2026-08-17
---

# DV-0008：设计

## 方案摘要

新增无第三方依赖的 Node 开发 runner，复用现有快速 Vite production build 并管理单个
Electron 子进程；受控源码变化或本项目 Unix socket 的 restart 指令触发串行重建。现有
`package.mjs` 增加严格隔离的 `--preview` 分支，只生成 arm64 `DeepViewer Dev.app`。
正式发布入口继续调用既有双架构签名、公证脚本，GitHub 上传保持独立授权。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, R-002, NFR-001, NFR-002 | 开发 runner | build、watch、子进程和项目 socket |
| R-003, NFR-004 | 开发数据隔离 | Electron ready 前设置独立 userData |
| R-004, NFR-003 | ARM 预览封包 | `package.mjs --preview` 的名称、Bundle ID、staging 和输出边界 |
| R-005 | 正式发布入口 | 显式串联现有 runtime/sign/notarize，不含上传 |
| R-006, AC-006 | 治理与文档 | governance 默认触发规则和命令说明 |
| R-007, AC-007 | 文档批处理 | 同一里程碑复用规格，只在明确边界集中同步 |

## 组件与职责

### `scripts/dev.mjs`

- 初次和变更后调用现有 `pnpm build`。
- 只管理自己创建的 Electron 子进程。
- 监听 `src/`、Vite 配置、`package.json` 与 `tsconfig.json`，防抖并串行重启。
- 创建按项目绝对路径哈希隔离的 Unix socket；`--restart` 只发送固定 restart 指令。
- 在开发子进程环境设置 `DEEPVIEWER_PROFILE=development`。

### Electron 开发 profile

- `main.ts` 在 `app.setName` 和 single-instance lock 前检测显式环境标志或预览包初始名称。
- 命中后把 `userData` 设置为 `appData/DeepViewer Dev`。
- `DSH_HOME`、workspace 与日志已从 `userData` 派生，因此自动随之隔离。

### `package.mjs --preview`

- 固定 `arm64`，复用已有 Runtime manifest 检查。
- 使用独立 staging、`DeepViewer Dev` 名称、`com.deepviewer.desktop.dev` Bundle ID 和输出。
- 保留 allowlist、链接规范化、xattr 清理和隐私审计。
- 在 `.app` 审计通过后结束；不进入 DMG、签名或公证分支。

## 接口与事件

```text
pnpm desktop:dev
pnpm desktop:dev:restart
pnpm desktop:preview
pnpm desktop:release
```

开发控制 socket 只接受一行 `restart`。其他内容忽略并关闭连接。

## 状态与数据模型

```text
idle → building → running
  ↑       │          │
  └ change/restart ──┘

build failed → watching → next change/restart → building
```

runner 最多持有一个 build 和一个 Electron 子进程，不持久化任务或用户数据。

## 主要流程

### 开发模式

1. 清理失效的本项目 socket 并开始监听。
2. 执行一次 production build。
3. 构建成功后以开发 profile 启动 Electron。
4. 文件变化或 restart 指令到来时防抖；停止自己的 Electron，重新 build 并启动。
5. 收到退出信号后关闭 watcher/server/child 并移除 socket。

### 本地预览

1. production build。
2. 校验现有 arm64 Runtime manifest。
3. 清理开发专用 staging/output，封包和审计 `DeepViewer Dev.app`。
4. 打印应用路径并结束，不创建 DMG。

### 正式发布

只有显式 `desktop:release` 才依次执行 build、双架构 Runtime、签名封包和 Apple 公证。
上传和 GitHub Release 修改不在命令内。

### 文档同步

日常代码切片不把 Markdown 当作逐次工作日志。代码和基础测试可以连续推进；维护者明确要求、
里程碑验收、正式发布或发生实质范围变化时，再集中更新任务、验证证据和用户文档。规格进入
`Verified` 或 `Released` 前仍必须保持实现与文档一致。

## 权限、安全与隐私

- socket 名含项目路径哈希和当前用户 ID，不按通用进程名控制。
- 开发 runner 不读取或传输 API key；Electron/Harness 仍按既有逻辑读取本地环境。
- 预览产物位于忽略的 `out/`，不会成为公开资产。
- 正式发布安全门禁不因新增命令而降低。

## 可观察性

- runner 输出 build/restart 原因、Electron PID 和构建失败摘要。
- 不输出环境变量值、用户设置或 Harness 内容。
- preview 输出唯一 `.app` 路径和“未生成 DMG”的提示。

## 兼容、迁移与回滚

- 现有 `desktop:start`、package 和 release 脚本保持兼容。
- 删除新脚本和 package aliases 即可回滚；正式数据目录不迁移。
- 首次启用会新建 `DeepViewer Dev` 数据目录，不读取或复制正式目录。

## 测试策略

- 单元：开发 profile 判定、userData 路径、watch 路径过滤、socket 路径隔离。
- 静态：package aliases、preview/release 边界、禁止 upload/killall。
- 基础：TypeScript、Vitest、三个 Vite production build、Node 语法。
- 人工：维护者后续实际运行 dev、restart 和 preview 并验收应用交互；代理不代替。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| Vite build + Electron 自动重启 | 无新依赖；覆盖主进程注入式 UI；构建约 1 秒 | 不是 renderer HMR | 采用 |
| Vite dev server + Electron HMR | renderer 更新更细 | 主进程注入层仍需重启，增加 URL/CSP/生命周期分支 | 暂不采用 |
| 每次生成 ARM DMG | 最接近发布形态 | 仍有封包和磁盘镜像成本 | 仅保留 `.app` 预览层 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-17
