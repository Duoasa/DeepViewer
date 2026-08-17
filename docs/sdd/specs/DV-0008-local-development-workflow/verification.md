---
id: DV-0008
title: Local development and release-tier workflow - Verification
status: Implementing
updated: 2026-08-17
---

# DV-0008：验证

## 验证环境

- 提交：Pending
- 平台：macOS Apple Silicon
- 配置：本地开发 profile；现有 arm64 Runtime
- 外部依赖：固定 DeepSeek Harness checkout

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 自动测试/维护者人工 | Pass | watcher 输入过滤、命令边界和 production build 已验证；维护者在本轮 UI 迭代中持续使用开发 runner 完成自动重建与重启 |
| AC-002 | 自动测试/实际命令 | Pass | 项目 socket 隔离与禁止 `killall` 已测试；受限沙箱拒绝 socket 后获准执行，同一 `desktop:dev:restart` 只向当前 runner 成功排队 |
| AC-003 | 单元测试 | Pass | development profile 判定、独立 userData 路径及稳定模式不变通过测试 |
| AC-004 | 静态与包体检查 | Partial | arm64、开发名称/Bundle ID、preview 提前退出均通过测试；依照默认规则未生成预览包，包体待明确指令后验证 |
| AC-005 | 静态检查 | Pass | release alias 先同步受控上游覆盖，再包含双架构 Runtime、文件级 staging/ASAR 隐私门禁、签名与公证，且不包含上传 |
| AC-006 | 文档检查 | Pass | 根命令、README、governance 与规格已同步三个层级和默认触发规则 |
| AC-007 | 总规范检查 | Pass | `AGENTS.md` 与 governance 已允许同一里程碑小改动只改代码和基础验证，并定义批量同步边界 |

## 执行的命令

```sh
node --check apps/deepviewer-desktop/scripts/dev.mjs
node --check apps/deepviewer-desktop/scripts/package.mjs
CI=true pnpm typecheck
CI=true pnpm test
CI=true pnpm desktop:build
CI=true pnpm desktop:dev:restart
git diff --check
```

- TypeScript：通过。
- Vitest：9 个测试文件、50 项测试全部通过。受限沙箱阻止 Runtime 回环端口时，在允许本机
  回环后同一命令通过，确认不是代码失败。
- Vite：main、preload、renderer 三个 production build 全部通过。
- 活跃 runner 的 restart：受限沙箱首次拒绝连接项目 socket；允许本机 socket 后同一命令成功
  排队，未影响其他 Electron 应用。
- 代理未代替维护者操作应用；维护者使用开发版完成本轮 UI 交互验收。未运行 preview/release，
  未生成 DMG，未执行签名、公证或上传。

## 人工检查

- [x] 维护者运行开发模式并确认修改后应用自动重启
- [x] 维护者运行显式 restart；当前项目控制 socket 成功接收请求且实现禁止按进程名杀死应用
- [ ] 维护者打开 ARM 预览 `.app` 并确认与正式数据隔离
- [x] 维护者确认本轮日常开发未产生 DMG、签名、公证或 GitHub 变更

## 残余风险

- ARM 预览 `.app` 的实际包体与数据隔离仍等待维护者在明确预览指令后验收。

## 结论

- 结果：开发 runner 与受控 restart 已通过；ARM 预览包体仍为 `Pending Manual`，保持 Implementing
- 验证人：Codex（代码和基础验证）；Duoasa（交互验收）
- 日期：2026-08-17
