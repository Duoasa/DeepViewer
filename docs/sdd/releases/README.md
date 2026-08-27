# Release Records

本目录记录 DeepViewer 的公开发布与正在准备的候选版本，包括版本元数据、源代码提交、下载资产、校验值、验证范围和已知限制。

发布记录是历史事实，不替代功能规格的验收流程。预发布版本可以关联仍处于 `Implementing` 的规格；只有全部验收条件具备证据后，规格才可按治理规则进入 `Verified` 或 `Released`。

## 版本索引

| 版本 | 类型 | 发布日期 | 关联规格 | 记录 |
| --- | --- | --- | --- | --- |
| `v0.2.4-preview.2` | Public source preview / Candidate | 2026-08-28 | DV-0016 | [DeepViewer 0.2.4 Integrated Activity Island source preview](v0.2.4-preview.2.md) |
| `v0.2.4-preview.1` | Public source preview / Published | 2026-08-24 | DV-0016 | [DeepViewer 0.2.4 Activity Island source preview](v0.2.4-preview.1.md) |
| `v0.2.3` | Public preview / Preparing Latest | 2026-08-22 | DV-0015 | [DeepViewer 0.2.3 (Build 1)](v0.2.3.md) |
| `v0.2.2-build.2` | Public hotfix / Latest | 2026-08-20 | DV-0014 | [DeepViewer 0.2.2 (Build 2)](v0.2.2-build.2.md) |
| `v0.2.2` | Public preview / Rollback | 2026-08-20 | DV-0014 | [DeepViewer 0.2.2 (Build 1)](v0.2.2.md) |
| `v0.2.1` | Public preview / Rollback | 2026-08-19 | DV-0007, DV-0008, DV-0010—DV-0013 | [DeepViewer 0.2.1](v0.2.1.md) |
| `v0.1.2-build.2` | Public hotfix | 2026-08-17 | DV-0007, DV-0008, DV-0009 | [DeepViewer 0.1.2 (Build 2)](v0.1.2.md) |
| `v0.1.1` | Public release | 2026-08-16 | DV-0003, DV-0004, DV-0005, DV-0006, DV-0007 | [DeepViewer v0.1.1](v0.1.1.md) |
| `v0.0.1` | Public pre-release | 2026-08-16 | DV-0003 | [DeepViewer v0.0.1](v0.0.1.md) |

## 记录要求

每个版本至少记录；尚未公开的候选版本对 tag、GitHub Release 地址和发布时间明确记为
`null` / 未发布：

- Git tag、源代码提交和 GitHub Release 地址
- 每个安装资产的目标平台、架构、大小和 SHA-256
- 双语 README 开头必须使用当前版本产品图；新版本发布时同步替换并提交对应 `Resources/DeepViewer-<version>` 资产
- 已执行的验证及其边界
- 签名、公证、兼容性和其他已知限制
- 对关联规格状态的判断
