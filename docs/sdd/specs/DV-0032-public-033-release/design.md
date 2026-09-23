# DV-0032 Design

Status: Released

1. 以公共 `main` 为基线建立隔离发布树，仅导入当前 0.3.3 产品源码与规格。保留历史 SDD，排除本地交接文件及运行数据。完整 Harness 差异形成 `upstream/snapshots/v0.3.3/harness.patch`，从官方基线独立验证 sourceTree。（R-001，R-002）
2. 使用 Node 24、锁文件和全新构建目录，分别构建 Harness、Runtime、桌面应用、签名 app 与 DMG。正式包先通过 ASAR 和 Runtime allowlist/隐私审计，再公证装订。（R-001，R-002，R-004）
3. README 以 0.2.5 为公开比较基线；第一方与第三方插件分栏列来源、许可证、版本和修改范围。正式发布仅 ARM64，旧 Release 保持不变。（R-003，NFR-001）
4. Apple 接受后生成最终 DMG SHA-256，创建公共源码标签与 Release；再校验远端 tag、asset 大小与 digest。（R-004）

不使用旧 0.3.2 安装包重新压缩或改名；不把用户数据目录放入构建输入。
