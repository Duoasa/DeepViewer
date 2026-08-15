---
id: DV-0002
title: DeepSeek Harness foundation and DeepViewer customization direction - Verification
status: Review
updated: 2026-08-15
---

# DV-0002：评估验证

## 验证环境

- DeepViewer 分支：`main`
- 上游仓库：`deepseek-ai/deepseek-harness`
- 上游提交：`47f943859bef60e4160492346772ded9b24f765a`
- 上游版本：`0.1.0-rc.5`
- 平台：macOS

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | Git checkout 检查 | Pass | 本地 `upstream/deepseek-harness`，origin 指向官方仓库，HEAD 与记录一致 |
| AC-002 | 文档和源码阅读 | Pass | `docs/architecture.zh.md`、client AGENTS、Web/RPC/projection/bundle 文档与关键入口源码 |
| AC-003 | 改造位置映射 | Pass | `design.md` 的“改造位置决策表” |
| AC-004 | 方案对比 | Pass | `design.md` 的“三种路线比较” |
| AC-005 | 分阶段方案 | Pass | `design.md` 的 Phase 0–4 |

## 已检查的主要来源

- `AGENTS.md`
- `docs/architecture.zh.md`
- `packages/client/AGENTS.md`
- `packages/client/README.zh.md`
- `packages/client/web/README.zh.md`
- `packages/client/web-react/README.zh.md`
- `packages/client/connection/README.zh.md`
- `packages/client/runtime/README.zh.md`
- `packages/session/session-projection/README.zh.md`
- `packages/api/gateway/README.zh.md`
- `packages/bundle/web-app/README.zh.md`
- `packages/bundle/web-app/cordis.patch.yml`
- `apps/web/src/main.ts`
- `apps/web/vite.config.ts`
- `packages/client/ui-layout/src/client/index.ts`
- `packages/client/ui-layout/src/client/AppFrame.tsx`
- Web client、slot 和 RPC 的 implemented Agent Notes

## 执行的命令

```text
git clone --depth 1 --branch master https://github.com/deepseek-ai/deepseek-harness.git upstream/deepseek-harness
git -C upstream/deepseek-harness rev-parse HEAD
git -C upstream/deepseek-harness log -1 --date=iso-strict --format='%H%n%ad%n%s'
git -C upstream/deepseek-harness remote -v
rg --files upstream/deepseek-harness
rg -n 'electron|tauri|desktop shell|native window|BrowserWindow|WebView' upstream/deepseek-harness
```

## 结果边界

- 本次只验证源码结构和方案可行性，没有安装依赖或执行构建测试。
- 本次没有把上游源码合并进 DeepViewer Git 历史。
- Electron 由 ADR-0002 选择，当前平台顺序由 ADR-0003 替代确定；上游同步策略仍待独立 ADR。

## 结论

- 结果：Assessment complete; design approval pending
- 验证人：Codex
- 日期：2026-08-15
