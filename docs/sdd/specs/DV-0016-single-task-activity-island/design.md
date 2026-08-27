---
id: DV-0016
title: Single-task activity island - Design
status: Implementing
updated: 2026-08-28
---

# DV-0016：设计

## 方案摘要

采用“当前会话发布器 → 受限 preload IPC → 主进程单任务协调器 → 附着主窗口的只读岛窗口”数据流。
Harness 页面内的发布器只从现有当前会话 hook 派生安全快照；Electron 主进程校验并拥有设置、
自动收起状态机和窗口生命周期；单独的本地 renderer 只接收渲染模型。设置页作为 Harness
`settings.section` 的桌面专属分区注入。所有上游改动从跟踪覆盖文件同步。

## 需求映射

| 需求 | 设计章节 | 说明 |
| --- | --- | --- |
| R-001-R-003 | 当前会话发布器 | 只观察选中会话并按优先级派生单状态 |
| R-004, NFR-004 | 单任务协调器 | 主进程统一拥有展开、紧凑、隐藏及计时器 |
| R-005, R-006 | 设置分区与存储 | 四类设置、即时推送、原子持久化和归一化 |
| R-007 | 岛窗口 | macOS 非激活、穿透、随主窗口移动与显隐的普通透明 child window |
| R-008, NFR-002 | 岛 renderer | 60fps 上限、两种 WebGL 2 表现和减少动态效果 |
| R-009, NFR-001 | IPC 边界 | 独立 API、来源校验、运行时值校验和最小字段 |
| R-010 | 版本元数据 | 桌面应用更新为 0.2.4 Build 1，根 workspace 保持基线语义 |
| R-011 | 上游覆盖同步 | 跟踪文件复制与带锚点的注册改动 |
| R-012 | 0.2.3 基线兼容 | 在 rc.2、全局设置和两个 Active 插件上增量集成 |
| R-014 | 标题栏与统计布局 | token 统计在 Runtime DOM 内镜像到标题栏靠下的固定位置，原位置隐藏 |
| R-015, NFR-005 | 透明主题与锚点边界 | 无容器材质的前景令牌与严格校验的主内容安全区域锚点 |
| R-016 | 设置实际预览 | 设置卡片与岛复用同一个 WebGL renderer，不保留手绘近似图 |
| R-017 | 中心收缩 | 紧凑窗口用展开尺寸作为参考，以不变几何中心计算上下边界 |

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
- Runtime surface 只发布主内容标题栏安全区域的有限矩形；main 校验后由窗口控制器解释为屏幕坐标。
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

- 仅 macOS 创建以主窗口为 parent 的普通透明、无框、不可聚焦、鼠标穿透 child window；不使用
  原生 `panel` 类型、跨应用 always-on-top 或 visible-on-all-workspaces。
- child window 只在主窗口可见、未最小化且获得焦点时显示；主窗口 `blur` 时立即隐藏，`focus`
  时按最后状态恢复。已经显示时只更新内容和位置，不重复调用 `showInactive()` 改变原生窗口顺序。
- 直接使用 QuotaView 的状态尺寸：待机 `304×112`、完成/错误 `374×132`、不可用
  `390×132`、活动/确认 `444×152`、紧凑 `270×72`，并用系统 ease-in-out 窗口动画切换。
- 展开到紧凑时使用当前状态的展开高度作为 reference size，把高度差平均分到上、下边界；
  水平方向继续由 anchor 居中，因此两个 presentation 的几何中心完全一致。
- 透明 BrowserWindow 保持 `10px` 外层布局留白；renderer 的 surface 本身完全透明，不使用
  tint、描边、backdrop blur、圆角底板或容器阴影，使内容层直接叠入主窗口标题栏。
- 使用主内容安全区域锚点与主窗口 content bounds 计算屏幕坐标；在锚点、主窗口 move/resize、
  show/restore/focus/blur/hide/minimize 变化时重新定位或同步显隐。
- 关闭岛不销毁主窗口；renderer 失败只记录诊断。

### 岛 renderer

- 本地 HTML/CSS/TypeScript，不加载 Runtime origin，不允许导航；球体实现由可复用的
  `ActivityIslandOrbRenderer` 提供，岛 renderer 与设置页均引用这一份源码。
- DOM 提供状态和标题文本；Canvas 只绘制动画球，颜色不作为唯一状态信息。
- 粒子球把 QuotaView Metal shader 等价翻译为 WebGL 2，保留 `0.535` 球体半径、20 次体积
  采样、状态色、运动周期、响应、能量、湍流、脉冲、折射和 60fps 更新。
- 波澜光晕沿用 QuotaView style-9 玻璃液体 shader 的状态配置、色板、速度、warp、ridge、
  sharpness、exposure 和 `1.5×` 速度系数。
- 文案、字号、透明度、状态点、三行居中布局、2.6 秒 operation shimmer、紧凑态球与标题位置
  均来自 QuotaView `0.3.6` 稳定实现；AstaSans 不可用时按原实现回退系统字体。
- 浅色主题使用深色文字，深色主题使用浅色文字；muted 文本与 shimmer 使用同一组反相 CSS
  前景令牌，不引入 surface 令牌，状态色与动画参数不变。
- `prefers-reduced-motion`、页面 hidden 或 presentation hidden 时停止 RAF，并绘制静态帧。

### 独立设置分区

- 在 `ui-settings-general` 插件中注册 `activity-island` section，与 `general` 并列。
- 使用桌面 bridge 初始化、更新和订阅设置；浏览器环境无 bridge 时显示不可用提示而不抛错。
- 两个延迟使用范围输入和明确秒数，动画使用互斥按钮，开关使用原生 checkbox + 自定义视觉。
- 每个动画按钮内挂载真实 canvas，使用同一个 `QuotaViewActivityOrbRenderer` 和 `thinking`
  状态参数实时绘制对应模式；页面隐藏、减少动态效果或组件卸载时停止 RAF 并释放 WebGL context。

### 标题栏与 token 统计

- `CenterColumn` 的 macOS safe area 同时提供岛的几何锚点和无底板统计文字宿主。
- 主内容 safe area 恢复原有 `48px` 结构高度，不为岛增加布局行；会话原生 header 与 safe area
  共同构成原有顶栏。统计宿主位于相对 safe-area `top: 96px`、高度 `20px`，与“对话 / 轨迹”
  标签文字行垂直对齐，并与原顶栏底部分隔线保留间距，避免进入其后的消息 scroll body。
- 桌面注入脚本识别上游 `StatsLine`，把文字镜像到 safe-area 宿主并隐藏输入框下方的来源节点；
  宿主固定在展开态最大 surface 下边缘后 `4px` 的标题栏靠下位置，岛紧凑或隐藏时不移动。
  文本始终留在 Runtime renderer，同步过程不经过 preload 或主进程。
- safe area 通过 `ResizeObserver` 在侧栏、详情栏或窗口尺寸变化时发布去重后的矩形。

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
publishActivityIslandAnchor(anchor: { x: number; y: number; width: number; height: number }): void
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
3. Runtime 发布主内容 safe-area 锚点；main 校验后保存为 child window 的定位基准。
4. main 校验活动来源和值，协调器将其转为展开渲染模型；窗口创建、定位并显示。
5. 会话状态变化时页面只在派生值变化后发布，协调器取消旧计时并更新模型。
6. 完成后协调器依次进入中心收缩的紧凑态和隐藏态；token 行保持固定，新任务会在任意阶段恢复展开。
7. 设置页写入 patch，main 归一化、持久化并广播；协调器和所有设置页实例同步更新。
8. Runtime 失败时 main 直接生成不可用状态，不依赖已失效的 Runtime renderer；rc.2 现有凭据、
   设置、预览与订阅插件路径不被灵动岛覆盖改变。

## 权限、安全与隐私

- runtime 与 launch/island surface 使用不同来源检查和不同 IPC 能力。
- 标题去除控制字符并限制为 120 个 Unicode code point；session ID 限 128 字符。
- activity 对象拒绝未知字段语义所需之外的值；设置 patch 只接受四个白名单键；token 文字不离开
  Runtime DOM，renderer 不能通过岛接口提供 token 或任意样式值。
- anchor 只接受非负有限坐标、正的有限宽高和固定上限，不接受窗口标志、URL 或任意命令。
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
- 静态/契约：BrowserWindow 安全参数、preload API、设置字段、无连接文案、原始主内容顶栏
  高度与固定统计行边界、覆盖 digest。
- 构建：DeepViewer typecheck、Vitest、main/preload/renderer production build、上游 host/client/web build。
- 人工：标题栏透明嵌入、两种动画、浅/深色前景、减少动态效果、侧栏与窗口变化、设置重启恢复。

## 备选方案

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 复用 QuotaView Hook/连接桥 | 已有独立采集路径 | 重复连接与权威源，增加故障面 | 拒绝 |
| 多任务聚合岛 | 可观察后台任务 | 超出当前范围，交互和仲裁复杂 | 延后 |
| DOM 注入主窗口顶部 | 实现较少 | 会侵入 Harness DOM 并复制 WebGL 生命周期 | 拒绝 |
| 跨应用置顶独立 panel | 离开主窗口仍可见 | 与“无缝集成”冲突，会遮挡其他应用 | 拒绝 |
| 主进程协调的普通附着 child window | 权威、隔离、可测试、视觉融入标题栏且不跨应用浮动 | 需要第二 renderer 和锚点 IPC | 采用 |

## 设计决定

- 决策：Approved by direct project instruction
- 审批人：Duoasa
- 日期：2026-08-28
