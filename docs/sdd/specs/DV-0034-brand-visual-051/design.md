# DV-0034 Design

Status: Implementing

## D-001：恢复旧发行版品牌表现 (R-001, NFR-001)

以 Git v0.3.3 的 EmptyHero 与品牌 CSS 为事实来源，在新内核现有 conversation hero brand mark 槽恢复双 path SVG，使鱼标与 cursor 独立呈现。恢复尺寸、透明度、间距、字体与 reduced-motion。使用局部 ConversationContent 呈现 seam 将 hero 与 composerStack 分开，恢复旧版窗口顶部至底部输入区之间的居中待机位置；保留新内核的 resident composer、slot、overlay、inert、交互与会话状态。与应用启动 loading 页分开定位。

## D-002：原生图标资源与选择链路 (R-002, NFR-001)

检查源 PNG/ICNS、透明画布、各尺寸 renditions、bundle icon 声明及运行时 Dock override。使用原生图标表示与构建工具修复根因，保留原始鱼标设计；不把当前已含底板的整图简单缩小，不通过窗口/CSS 或运行时缩放补偿。具体根因、工具与实际资源证据在本次实现与发布同步边界补齐。

已确认 0.5.0 的源 PNG 与最大 ICNS rendition 的底板占满 1024 画布；运行时在所有 macOS 渠道调用 dock.setIcon，覆盖了原生 bundle 图标。修复采用未变更几何的鱼标 SVG 作为 Icon Composer 前景，由 Xcode 26 的 Apple actool 编译分层 Assets.car 与 legacy ICNS；透明边界、底板及各尺寸由编译器生成，不缩放旧整图。稳定包与开发载体声明同名 CFBundleIconName 并携带 catalog，不再用运行时 PNG 覆盖。实际 release packaging 必须成功编译原生资源；CI 的 core-only 构建不要求调用 Xcode 图标编译器，编译器集成验证与其基础源码检查分别记录。

## D-003：全新发布与验证边界 (R-003, NFR-001, NFR-002)

复用 0.5.0 已验证的固定依赖、严格 ASAR 库存、精确 Developer ID 证书、公证与净化审计链路，全新构建 0.5.1 arm64。只公开 DMG 与新生成 SHA256SUMS.txt；ZIP 与自动更新 feed 无实际安装升级 qualification 时不公开。实际用户环境、界面与 Dock 验收保留 Pending Manual；版本与资产权威证据记录在 releases/v0.5.1.md。
