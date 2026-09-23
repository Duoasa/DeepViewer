# Verification

Status: Implementing. 2026-09-20 基础验证完成；最终视觉和真实交互由维护者验收，Pending Manual。

- AC-001: 新建项目应用内名称弹窗与添加已有目录入口已实现，沿用主题和图标。既有/新建目录路径分离，提交中防重复、错误保留输入。
- AC-002: 默认统一根目录为 Documents/DeepViewer/Projects，首次创建才落盘；独占创建子目录、名称校验和同名冲突测试通过，不移动已有项目。
- AC-003: 133 项相关测试通过；隔离 Host 新建项目及同配置重启恢复验证通过；Host/Client/Web 完整构建通过。

此前插件加载故障已定位为旧端口认证 Cookie 累积导致 HTTP 431，由仅清理本机历史 DSH 认证 Cookie 的修复解决。Runtime ready 和自动检查不等于维护者视觉验收。

0.3.0 曾用于本地固化；公开包构建和验证见 DV-0032。
