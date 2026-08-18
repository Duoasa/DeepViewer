# DV-0013：设计

文件入口使用现有 `resolveWorkspacePath(cwd, path)` 生成绝对路径，并通过专用
`data-deepviewer-native-file-path` 标记交给桌面壳；可见文本保持相对路径。会话 turn-tail owner
增加可选 `cwd`，使工具行、产出按钮和回复内文件引用使用同一解析规则。

左键入口调用 ui-primitives 中的单一预览路由器。路由器派发可取消的
`deepviewer:preview-file` 事件；预览插件在接受有效路径时同步 `preventDefault()`，随后选择文件并
打开 `preview` 详情视图。事件无人接管、路径无效或插件未加载时，路由器调用入口原有的
`openFile(path)`，因此不会产生无响应的文件按钮，也不新增跨进程文件接口。

Electron 优先使用原生链接参数；按钮没有稳定链接参数时，在右键坐标读取最近的专用标记，并再次
执行绝对路径校验。菜单点击调用既有 `shell.showItemInFolder(path)`；不新增 IPC 或文件读取。

“在 DeepViewer 中预览”由主进程向当前 Runtime 页面派发同一固定名称、仅含已验证绝对路径的事件。
预览插件把路径限定并转换为当前工作区相对路径，打开 `preview` 详情视图并选择该文件；HTML 进入
网页模式，其他文件进入代码模式。最终读取仍经过 DV-0012 的工作区 Host 校验。
