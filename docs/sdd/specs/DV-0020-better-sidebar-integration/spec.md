---
id: DV-0020
status: Implementing
owner: Duoasa
created: 2026-09-19
---

# Better Sidebar 原生集成

维护者直接要求集成 https://github.com/omdsh-dev/DSH-better-sidebar 并适配 UI；据此批准本目标。

## 需求

- R-001：固定 npm `dsh-better-sidebar@0.19.1`（MIT，已发布包 integrity 由 pnpm-lock.yaml 固定），使用官方 bundle patch 和客户端注册，复用 DSH 0.1.5-rc.2 唯一核心。
- R-002：开发默认挂载，正式 Runtime 构建路径包含完整包和许可证；提供 DEEPVIEWER_DISABLE_BETTER_SIDEBAR=1，缺包/不兼容/启动失败时优先退回原订阅和 reasoning 组合，最后纯核心。
- R-003：右侧页签继续由官方 sidebarRight 承载；底部工作台与主对话布局联动。适配 macOS 顶栏 48px 安全区、窗口控件、点击/拖动区域、深浅主题及窄窗口；不创建第二套面板状态。
- R-004：保留插件默认工作区边界及浏览器请求鉴权；按维护者 2026-09-19 明确要求，浏览器和 HTML 预览固定取消内容沙箱；不主动开启模型终端工具、模型打开工具，不改变 DSH 官方权限选择；插件 UI 终端属于用户交互能力。
- NFR-001：保留已有改动、插件 MIT 版权；不开新发布、不封包、不提交、不改用户会话/设置。视觉交互由维护者验收。

## 设计与任务

- T-001（R-001）：安装固定 npm 包，受控 staging 到开发核心，链接现有官方 peer；不下载第二套 DSH。
- T-002（R-002）：启动链加入插件、独立禁用与渐进回退，Runtime 构建复用固定包并校验 chunks/license。
- T-003（R-003）：桌面 CSS 适配稳定 data 属性，插件状态仍由原服务控制；核对底部工作台尺寸与 centerBody 的 flex 收缩。
- T-004（R-004）：插件清单/加载/鉴权/chunk/PTY 冒烟，类型检查与开发构建、重启。

## 验收

- AC-001：固定包、许可证、client/editor/terminal/mermaid chunks 与 peer 解析通过。
- AC-002：默认、禁用、缺包、失败回退路径有冒烟证据。
- AC-003：隔离 DSH Host 启动，认证后 sidebar API/chunks 可用，未认证访问拒绝；无真实模型调用。
- AC-004：开发版启动就绪；维护者验收文件树/编辑保存、终端、Git、底部工作台、右栏开合/全屏和深浅主题（Pending Manual）。

## 风险与回退

终端需 node-pty 可用，第三方插件的 workspaceFence 不等同于 Agent 权限预设。HTML 预览取消 iframe 与响应 CSP sandbox 后，同源本地页面具有界面会话权限；Electron 的进程 sandbox、contextIsolation 和禁用 Node integration 不变。远程站点仍遵循其 CSP/frame 与登录限制，不承诺 iframe 等同独立浏览器；禁用开关可回退官方侧栏。npm 发布包为集成事实来源，远端 main 仅供理解接口，不混用未发布代码。

## 集成核对补充

发布包的自有路由只校验 Host/Origin，不验证官方浏览器 cookie。构建时用确定性锚点适配统一 fence，注入官方 connection 服务并调用 requestRejection；API、文件、chunks 和 WebSocket 共用该检查，缺少适配标记拒绝加载。适配升级必须重验鉴权冒烟。

安装依赖触发现有 dev watcher 的静态 manifest 指纹失效、构建号递增被反复识别为实质改动；本次更新指纹以识别后续 build-only 更新，作为完成集成所需的开发流程修复。

## 维护者批准的桌面设置精简

- R-005：设置导航与标题统一为“侧栏管理”；移除版本徽章与位置兼容选择，固定 Web 布局，由 Electron 控件层处理顶栏；不应用遗留自定义位置 CSS。分组、卡片与弹窗沿用官方设置色彩。按维护者追加要求移除侧边对话注册与 API，保留既有会话数据；开关关闭后仍可见且可重新开启。
- R-006：浏览器和 HTML 预览固定无内容沙箱，移除临时解锁与失效设置；保留请求鉴权和工作区文件检查。
- T-005（R-005、R-006）：版本锚点校验的 staging 适配；检查冷启动、旧偏好、HTML 相对资源与匿名访问拒绝。
- AC-005：重启后设置精简生效；浏览器和 HTML 不含 sandbox，HTML 响应无 sandbox CSP；认证边界仍有效。视觉由维护者验收。

## 维护者批准的持久浏览器扩展（2026-09-19）

- R-007：会话链接每次新建独立网页资源标签；普通网页跳转在原标签进行，新窗口请求在侧栏新建标签。使用 Electron 独立 guest 网页容器，与 DSH 会话隔离的 `persist:deepviewer-browser` 保存站点 cookie/storage；提供真实前进、后退、刷新、地址与标题更新、上传/下载。
- T-006（R-007）：浏览器注册采用唯一 resource 地址，保留 DSH 标签生命周期；Electron webview 随 DOM 布局和标签可见性管理，以避免原生浮层遮挡菜单。主进程固定 guest 安全偏好、验证来源和 URL，禁止 Node/preload 暴露；新窗口统一回侧栏。Webview 有 Electron 上游稳定性风险，后续可替换为 WebContentsView。
- AC-006：隔离环境验证两次链接两标签、网页内跳转、弹出新标签、前进后退与持久存储；浏览器页面不能访问桌面桥接。第三方登录、DRM 和浏览器扩展不宣称全面兼容。
