---
id: DV-0010
title: Global settings and About DeepViewer experience - Design
status: Verified
updated: 2026-08-19
---

# DV-0010：设计

## 方案摘要

沿用 Harness 现有 `settings.section` 扩展点和所有设置数据/控件，只替换
`ui-settings-general` 的 shell 布局并由同一插件注册 DeepViewer 关于分区。DeepViewer 跟踪完整
的 shell、样式、关于组件和本地化覆盖；同步脚本把它们写入固定上游 checkout，并从桌面包清单
替换版本占位符、复制现有应用图标。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001, NFR-002 | 全局 takeover shell | fixed 全视口、两列布局、各自滚动，无 mask/圆角/阴影 |
| R-002, NFR-003 | 导航与退出 | 左上返回、Escape、活动标题、既有 section 与 action slot |
| R-003 | 关于分区 | 导航底部独立入口、品牌图标/名称/说明/版本层级 |
| R-004, NFR-001 | 受控覆盖与元数据 | 文件覆盖、PNG 复制、版本 token 替换，不新增 IPC 或依赖 |

## 组件与职责

### `SettingsRoot.tsx`

- 继续拥有 open 与 active section 视图状态。
- 打开时渲染全视口 takeover surface；左侧按普通分区与底部 `about` 分组。
- 返回按钮和 Escape 调用既有 close；右侧标题来自当前 section label。
- 继续通过 `renderSlot` 渲染所有既有 action、section 与 onboarding contribution。

### `SettingsRoot.module.css`

- 使用现有 Harness token 建立 sidebar fill 与 base content 两列。
- macOS 顶部预留交通灯和拖动区所需空间，导航与内容独立滚动。
- 常规窗口为约 `260px + 1fr`，窄窗口收缩导航与内容 padding，不隐藏核心入口。

### `AboutSection.tsx`

- 使用 `/deepviewer-icon.png`、文本标题和本地化文案形成居中品牌信息层级。
- `__DEEPVIEWER_VERSION__` 与 `__DEEPVIEWER_BUILD_NUMBER__` 只存在于跟踪模板，写入上游时由
  同步脚本替换为桌面 package 元数据。

### 覆盖同步脚本

- 新增二进制/文本全文件覆盖能力，逐字节比较后才写目标。
- 把 DeepViewer 图标复制到 `upstream/deepseek-harness/apps/web/public/`。
- digest 同时包含新增源文件、图标和版本/Build 元数据，任一变化都会触发客户端与 Web 重建。

## 状态与数据模型

不新增持久化状态。`open`、`activeId` 与 onboarding 状态仍为组件本地视图状态；关于页版本为
构建输入，不进入用户设置或 Runtime 数据。

## 主要流程

1. 用户点击侧栏设置入口，shell 覆盖完整应用视口并聚焦返回按钮。
2. 左侧选择 section，右侧标题与唯一 section 内容同步切换。
3. 选择关于页时显示 DeepViewer 品牌与构建元数据。
4. 点击返回或按 Escape，shell 卸载并恢复原工作区。

## 权限、安全与隐私

不新增 preload、IPC、文件读取或网络能力。图标和版本在 build 时成为静态 Web 资源；设置写入
仍通过现有 namespace scope 和 loopback-only RPC。

## 兼容、迁移与回滚

不改变设置文档或 section 插件契约，无数据迁移。回滚时移除本规格的受控覆盖和同步项即可
恢复上游模态 shell。

## 测试策略

- DeepViewer 契约测试：全局布局关键选择器、关于文案/版本 token、图标与同步目标。
- Harness 组件测试：打开/退出、焦点、分区切换、底部关于导航、动态分区回退。
- 静态与构建：桌面测试、类型检查、production build、上游覆盖同步 build。
- 人工：维护者检查浅色/深色、常规/最小窗口、滚动、返回和各设置页。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 新建独立原生设置窗口 | 接近 macOS 偏好设置 | 与用户要求的应用内全局页不一致 | 拒绝 |
| 仅用 Electron DOM 注入改现有模态 | 改动少 | 关于页与 React 状态难以可靠集成 | 拒绝 |
| 重写全部设置控件 | 视觉自由 | 重复现有数据与插件逻辑，风险高 | 拒绝 |
| 受控替换 shell、复用 section slot | 保留功能并实现目标信息架构 | 需维护固定上游文件基线 | 采用 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-18
