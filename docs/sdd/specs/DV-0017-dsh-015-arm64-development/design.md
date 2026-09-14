---
id: DV-0017
status: Implementing
owner: Duoasa
created: 2026-09-14
updated: 2026-09-14
---

# 设计

1. **来源与构建（R-001、R-003）**：从 v0.2.3 独立 checkout 开始；上游放在忽略目录 `upstream/deepseek-harness`，固定提交。将旧 UI 接点迁移到 0.1.5 客户端插件、槽位和服务；覆盖由 tracked 同步脚本生成。
2. **ARM（R-002）**：删除对外 x64 script，所有架构参数仅接受 arm64；开发启动校验当前宿主。历史发布资产与历史规格不变。
3. **插件（R-004、NFR-001）**：DVP-0001 保留 0.3.1，在 staging 上适配 DSH peer 与实际运行接口；预览完全采用官方 documentpreview/browser 与右侧面板状态服务，DVP-0002 不再挂载。原生文件菜单桥接到官方 fileAddressFor/openResource，右上角按钮继续调用官方 actions，桌面样式固定在窗口控制区。
4. **开发数据（R-005、R-006）**：使用版本专属 Dev userData/DSH home，不读取已有用户会话或订阅凭据；冒烟使用临时空目录和无账户配置。
5. **验证（NFR-002）**：构建是运行前提；仅增加/运行能证明版本、架构、启动、插件加载与退出的冒烟检查。真实交互由维护者完成。

## 0.1.5 接口适配

- 启动 URL 携带 process token；健康检查先换取 cookie，再读取根页面。Electron 自行完成相同交换，日志只保存脱敏地址。
- 订阅插件 Host 将 `CallId` 对应到新版 `ToolCallId`；Client 从固定 0.3.1 source map 恢复源码并以官方 preset 重建。被移除的跨插件 ImageGallery 导出改为固定上游私有源码副本，同时保留许可证。
- Cordis 4.0.2 的 Connection accessor 带有 shadow context。通用 RPC 注册用公开的 `owner.get('webServer')` 解析服务，注册仍由 `owner.effect` 管理；原 Host/Origin 和 browser-auth 校验不变。仅修改该注册接点，不涉及 Agent 循环。
