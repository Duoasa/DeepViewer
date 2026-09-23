# DV-0027 设计

R-001：在 ui-deliverables 宿主的 systemPrompt section 中维护独立的交付规则。
R-002 / NFR-001：tools/post-execute 以 Session fs 校验成功输出路径，tools/result 只在最终成功且未取消时提交既有交付事件；结果本身不变。
R-003：复用现有 PresentedFileCard 和按路径去重逻辑，不新增 UI 或数据事件格式。
NFR-002：使用官方插件扩展点，owned overrides 与 Host 构建同步；不改变内核版本或插件清单。

R-004～R-006：ui-deliverables 提供统一工作区交付器，通过 tools/post-execute 归一生成结果，通过 tool-present 的 deliverables/prepare 扩展点归一显式交付。当前 Session 的交付事件携带 sourcePaths 别名，避免模型选择规范化缓存对象后重复导出或损失原图。以排他文件创建和内容摘要校验发布到 outputs，不改动原始缓存。
NFR-003：本地文件映射与 Session policy 校验在写入前完成；目标目录拒绝符号链接。仅在最终成功结果提交时登记附件；失败显式反馈。
