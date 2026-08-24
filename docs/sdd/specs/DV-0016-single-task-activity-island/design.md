---
id: DV-0016
title: Single-task activity island - Design
status: Implementing
updated: 2026-08-24
---

# DV-0016：设计

## 方案摘要

采用“当前会话发布器 → 受限 preload IPC → 主进程单任务协调器 → 本地只读岛窗口”数据流。
Harness 页面内的发布器只从现有当前会话 hook 派生安全快照；Electron 主进程校验并拥有设置、
自动收起状态机和窗口生命周期；单独的本地 renderer 只接收渲染模型。设置页作为 Harness
`settings.section` 的桌面专属分区注入。所有上游改动从跟踪覆盖文件同步。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001-R-003 | 当前会话发布器 | 只观察选中会话并按优先级派生单状态 |
| R-004, NFR-004 | 单任务协调器 | 主进程统一拥有展开、紧凑、隐藏及计时器 |
| R-005, R-006 | 设置分区与存储 | 四类设置、即时推送、原子持久化和归一化 |
| R-007 | 岛窗口 | macOS 非激活、置顶、穿透的本地透明窗口 |
| R-008, NFR-002 | 岛 renderer | 30fps 上限、两种 Canvas 表现和减少动态效果 |
| R-009, NFR-001 | IPC 边界 | 独立 API、来源校验、运行时值校验和最小字段 |
| R-010 | 版本元数据 | 桌面应用更新为 0.2.4 Build 1，根 workspace 保持基线语义 |
| R-011 | 上游覆盖同步 | 跟踪文件复制与带锚点的注册改动 |
| R-012 | 0.2.3 基线兼容 | 在 rc.2、全局设置和两个 Active 插件上增量集成 |

## 组件与职责

### Harness 当前会话发布器

- 作为无视觉 React 组件挂在 resident `ConversationRoot` 中。
- 只使用 `sessionId`、`useSession` 与 `useSessions` 读取当前会话 ID、显示标题和会话快照。
- 状态优先级：待确认 > 错误 > 运行中工具 > 运行中思考 > 刚完成 > 待机。
- 对安全字段构造稳定签名，仅在签名变化时发布；组件卸载或无会话时发布 `null`。
- 不读取消息节点正文、partial 文本、工具参数或凭据。

### Electron preload 与主进程 IPC

- Runtime surface 使用现有 `deepviewerDesktop` bridge 发布安全活动、读写设置并订阅设置变化。
- main 通过现有 runtime-origin allowlist 校验发送者，再做对象形状、枚举、长度和数值校验。
- 专用 island preload 仅暴露 `onRenderState` 单向订阅，不暴露写接口。

### `ActivityIslandPreferencesStore`

- 文件：`userData/activity-island.json`。
- 默认值：`enabled=true`、`orbAnimation=particleOrb`、`compactDelaySeconds=20`、
  `hideDelaySeconds=100`。
- 写入临时文件后 rename；失败由 logger 记录并保留当前内存值。

### `ActivityIslandCoordinator`

- 保存最后接受的当前活动、偏好和单一 presentation 状态。
- 活动状态进入时取消所有旧计时器并展开。
- 待机、完成、错误进入时启动 compact timer；紧凑后启动 hide timer。
- 等待确认、思考、执行状态不启动 inactivity timer。
- 设置关闭立即隐藏；重新开启时按最后活动重新评估。
- 向窗口发送完整不可变渲染模型，使 renderer 不承担业务状态机。

### `ActivityIslandWindowController`

- 仅 macOS 创建透明、无框、不可聚焦、鼠标穿透、always-on-top panel。
- 直接使用 QuotaView 的状态尺寸：待机 `304×112`、完成/错误 `374×132`、不可用
  `390×132`、活动/确认 `444×152`、紧凑 `270×72`，并用系统 ease-in-out 窗口动画切换。
- 透明 BrowserWindow 保持 `10px` 外层阴影区域透明；renderer 仅在 surface 内用 backdrop
  blur 模拟 QuotaView 的 HUD material，并叠加 `72%` 黑色 tint、`0.5px` 描边、连续圆角和
  阴影，避免 Electron 的整窗 vibrancy 污染透明留白。
- 根据主窗口 bounds 选择 display，并在 display/work-area/main-window 变化时重新定位顶部中央。
- 关闭岛不销毁主窗口；renderer 失败只记录诊断。

### 岛 renderer

- 本地 HTML/CSS/TypeScript，不加载 Runtime origin，不允许导航。
- DOM 提供状态和标题文本；Canvas 只绘制动画球，颜色不作为唯一状态信息。
- 粒子球把 QuotaView Metal shader 等价翻译为 WebGL 2，保留 `0.535` 球体半径、20 次体积
  采样、状态色、运动周期、响应、能量、湍流、脉冲、折射和 60fps 更新。
- 波澜光晕沿用 QuotaView style-9 玻璃液体 shader 的状态配置、色板、速度、warp、ridge、
  sharpness、exposure 和 `1.5×` 速度系数。
- 文案、字号、透明度、状态点、三行居中布局、2.6 秒 operation shimmer、紧凑态球与标题位置
  均来自 QuotaView `0.3.6` 稳定实现；AstaSans 不可用时按原实现回退系统字体。
- `prefers-reduced-motion`、页面 hidden 或 presentation hidden 时停止 RAF，并绘制静态帧。

### 独立设置分区

- 在 `ui-settings-general` 插件中注册 `activity-island` section，与 `general` 并列。
- 使用桌面 bridge 初始化、更新和订阅设置；浏览器环境无 bridge 时显示不可用提示而不抛错。
- 两个延迟使用范围输入和明确秒数，动画使用互斥按钮，开关使用原生 checkbox + 自定义视觉。

### 上游覆盖同步

- `upstream-overrides/ui-conversation` 保存发布器及挂载片段。
- `upstream-overrides/ui-settings-general` 保存设置组件、样式和注册/本地化片段。
- 同步脚本复制完整新文件、插入带 marker 的固定锚点，并将所有来源加入 digest。
- 新文件并入 v0.2.3 既有 `fileOverrides`，注册片段并入既有 `textOverrides` 与 digest；同步后继续
  使用基线命令构建 Harness `build:lib`、预览插件和 `build:web`，不替换 rc.2 构建管线。
- 不新增 credentials-local 覆盖；rc.2 的 versioned 凭据行为保持上游原样，岛接口不接触凭据。

## 接口与事件

核心内部类型：

```ts
type ActivityIslandState =
  | 'standby' | 'thinking' | 'working' | 'awaitingConfirmation'
  | 'completed' | 'error' | 'unavailable'

type ActivityIslandPresentation = 'expanded' | 'compact' | 'hidden'
type ActivityIslandOrbAnimation = 'particleOrb' | 'rippleGlow'

interface ActivityIslandActivity {
  schemaVersion: 1
  sequence: number
  sessionId: string
  state: ActivityIslandState
  title: string
  occurredAt: number
}
```

Runtime bridge：

```ts
publishActivityIsland(activity: ActivityIslandActivity | null): void
getActivityIslandPreferences(): Promise<ActivityIslandPreferences>
setActivityIslandPreferences(patch: Partial<ActivityIslandPreferences>): Promise<ActivityIslandPreferences>
onActivityIslandPreferences(listener): () => void
```

Renderer 不能指定 presentation；只有主进程协调器能输出 `ActivityIslandRenderState`。

## 状态与数据模型

```text
current Harness session snapshot
  pending.length > 0                 -> awaitingConfirmation
  lastAgentError | promptError       -> error
  running && runningCalls.length > 0 -> working
  running                            -> thinking
  running true -> false              -> completed
  otherwise                          -> standby

terminal/standby --compactDelay--> compact --hideDelay--> hidden
any new active edge -------------------------------------> expanded
```

`sequence` 在页面生命周期内递增；协调器对同一 session 拒绝不大于已接受序号的活动。切换
session 时新 session 立即成为当前并重置该比较边界。设置是唯一持久化数据，活动与 presentation
只存在内存。

## 主要流程

1. 应用 ready 后读取设置并创建协调器；岛窗口保持隐藏。
2. Runtime 页面装载当前会话发布器，发布第一份安全快照。
3. main 校验来源和值，协调器将其转为展开渲染模型；窗口创建、定位并显示。
4. 会话状态变化时页面只在派生值变化后发布，协调器取消旧计时并更新模型。
5. 完成后协调器依次进入紧凑和隐藏；新任务会在任意阶段恢复展开。
6. 设置页写入 patch，main 归一化、持久化并广播；协调器和所有设置页实例同步更新。
7. Runtime 失败时 main 直接生成不可用状态，不依赖已失效的 Runtime renderer；rc.2 现有凭据、
   设置、预览与订阅插件路径不被灵动岛覆盖改变。

## 权限、安全与隐私

- runtime 与 launch/island surface 使用不同来源检查和不同 IPC 能力。
- 标题去除控制字符并限制为 120 个 Unicode code point；session ID 限 128 字符。
- activity 对象拒绝未知字段语义所需之外的值；设置 patch 只接受四个白名单键。
- 不记录标题或会话 ID；日志只记录错误代码和组件级失败。
- 无网络、外部连接、Hook 或系统辅助功能权限；凭据只经过 rc.2 Harness 现有 provider，灵动岛
  代码和 IPC 永远不接触凭据。

## 可观察性

- logger 记录设置读取/写入失败、岛 renderer load failure 和非法 IPC 拒绝，不含活动内容。
- 单元测试可注入调度器验证 presentation 事件顺序。
- 开发者工具可从本地 island renderer 检查 `data-state`、`data-presentation` 和动画模式。

## 兼容、迁移与回滚

- 这是新设置文件，不需要旧版本迁移；未知字段忽略，已知字段逐项归一化。
- 非 macOS 构建保留设置接口但不显示窗口，避免 Runtime 页面调用失败。
- 回滚删除窗口控制器与覆盖注册即可；孤立设置文件对旧版本无影响。
- 固定 Harness 锚点变化时同步失败，禁止部分应用覆盖。

## 测试策略

- 单元：设置默认/归一化、活动校验、状态机优先级、完成计时、新活动取消、disabled 行为。
- 静态/契约：BrowserWindow 安全参数、preload API、设置字段、无连接文案、覆盖 digest。
- 构建：DeepViewer typecheck、Vitest、main/preload/renderer production build、上游 host/client/web build。
- 人工：macOS 顶部定位、两种动画、减少动态效果、多屏移动、设置重启恢复。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 复用 QuotaView Hook/连接桥 | 已有独立采集路径 | 重复连接与权威源，增加故障面 | 拒绝 |
| 多任务聚合岛 | 可观察后台任务 | 超出当前范围，交互和仲裁复杂 | 延后 |
| DOM 注入主窗口顶部 | 实现较少 | 离开主窗口不可见，不是桌面岛 | 拒绝 |
| 主进程协调的独立 panel | 权威、被动、隔离、可测试 | 需要第二 renderer 和 IPC | 采用 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-24
