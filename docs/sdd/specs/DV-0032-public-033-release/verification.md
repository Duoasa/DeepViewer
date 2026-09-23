# DV-0032 Verification

Status: Released
Target: DeepViewer 0.3.3 Build 75 / macOS arm64 / DSH 0.1.5-rc.2

- AC-001 — Pass: `harness.patch` 从官方 `fb2c4b9e698e30edb738bca4cf0618587db7d203` 应用到独立工作树后，Git tree 与 `manifest.json` 的 `sourceTree` 一致；源码审计结果见发布记录。
- AC-002 — Pass with limitation: Node 24 冻结依赖安装、官方 Harness 构建、vendor/DSH 两种 `release:pack`、桌面三进程构建、ARM64 Runtime 及签名包均成功；根目录 `pnpm typecheck`、桌面目标测试 42/42、`desktop:smoke` 21/21、Harness 冷列表测试 54/54、v2→v3 用户数据迁移冒烟均通过。完整桌面旧套件 149/165 通过，15 项遗留 UI/预览断言在本次修改前已有相同失败，另 1 项为 Electron 安装竞争并在补装后重测通过；详情及隔离启动、隐私扫描见发布记录。
- AC-003 — Pass: Apple 公证提交 `9f94569c-8360-4031-8379-c6de585adab5` Accepted、零 issue；ARM64 app/DMG Developer ID 签名、票据装订/验证、DMG 完整性及挂载应用 Gatekeeper 均通过。最终装订后 SHA-256 与资产大小见发布记录。
- AC-004 — Pass: 双语 README 保留原有居中图标、标题、徽章和导航的正式开头，已按功能安置七张维护者截图，图片 EXIF/XMP/iDOT 元数据已去除且 IDAT 像素流校验一致；旧产品图已从当前资源目录移除。公共 `main` 与注释标签 `v0.3.3` 均指向 `de275d56ce203140f14e584fe019c27246028568`；GitHub Latest Release `https://github.com/Duoasa/DeepViewer/releases/tag/v0.3.3` 为非草稿、非预发布，DMG 与 SHA-256 清单远端大小和 digest 与本地一致。CI `35811657995`、`35812396129` 成功；详细值见发布记录。

DV-0031 AC-005 的 UI 验收仍由维护者完成；本规格不代替该人工验收。
