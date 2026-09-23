# 设计

R-001/R-004：插件注册 settings.models.provider-card，通过宿主公开 settings.describe/mutate 读取脱敏设置并保存既有 llm-pi-ai.providers 模型字段；Host 通过认证 Connection RPC 提供逐提供方扫描。DSH 自身向 picker 发布模型能力，使用其现有 dispatch 参数映射。

R-002/R-003：编辑草稿显式选择启用档位，可填写服务商 wire value；默认不启用任何能力。按 namespace revision 写回所选 route 的 models 数组，只改变匹配 id 的 reasoningEfforts，保留其余模型与字段。检测重名、无效档位及秘密路径，拒绝不安全写回。冲突提示重新读取，不自动重试覆盖。

服务商是否实际支持某档位仍需用户确认；选项显示不表示远端推理效果已经验收。


通用扫描扩展：唯一入口位于对应 llm-pi-ai 提供方卡片，手动能力编辑也移入该卡片。新增保存后提示未扫描，不自动发起收费请求。Host 仅接受已配置 route，不接受 Client 传入 URL 或密钥；从 credentials 解析该 route 的引用，以禁止重定向的有界请求探测。原生 Connection 提供 Host/Origin 与 Cookie 认证。

扫描报告及一层应用前备份存于 DSH_HOME/deepviewer-model-scans.json（0600），按 route 分离。运行中的扫描在插件卸载/进程重启后取消或标记中断。配置指纹变化后停止后续请求，应用和恢复均验证指纹并通过 namespace revision 写入；报告不含密钥、完整请求或模型回答。

图片输入扩展：Host 为每个模型产生随机排列的六色色块 PNG，通过标准 image_url data URL 请求短答案。只有完整颜色顺序正确才记 supported；明确图片能力拒绝为 unsupported，错误/无答案/图片被忽略为 uncertain。结果只包含状态与说明，不保留模型原文。成功应用写入 llm-pi-ai 的 input 字段，DSH 原生 adapter 将其映射为 inputModalities 并驱动上传门禁。手动编辑共享原有模型数组 CAS，不修改上游代码。
