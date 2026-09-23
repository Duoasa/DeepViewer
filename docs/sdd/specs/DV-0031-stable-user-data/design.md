# Design

Status: Implementing

R-001/R-004: 在申请 Electron 单实例锁前固定 userData，安装版为 Application Support/DeepViewer，开发版为 Application Support/DeepViewer Dev。resource-locator 从该目录派生 harness-home 和默认 workspace。显式 DEEPVIEWER_DEV_USER_DATA 不扫描外部历史目录。

R-002/R-003: 启动 DSH 前执行目录布局 schemaVersion 1。安装版只扫描 DeepViewer Preview/<semver-preview>，开发版只扫描自身 dsh-<version>。按会话/配置/工作区登记的真实文件更新时间确定主数据源。所有源先复制为私有快照并校验 SHA-256；合并在 staging 中完成，校验后以 journal + rename 切换。现有目标作为 previous-home 保留；旧版本目录不改动，以维持旧附件和工作区绝对路径。

同一会话的日志目录不可拆分，重复分支采用主源，冲突副本保留在 snapshots；其他文件补齐缺失项，配置采用最近使用的主源。工作区登记 v2 按路径合并并保持单一会话归属。未知登记结构、未完成的工作区事务、异常链接、活跃旧进程或复制期间源变化均阻止切换。凭据内容不解析、不输出，备份文件权限 0600、目录 0700。

迁移完成标记放在随 staging 原子发布的 harness-home 中。重启恢复三种断点（准备完成、旧目录移入备份、发布完成）；之后不重新扫描，避免恢复用户已删除的记录。DSH 自行处理已有的 session 格式迁移，桌面不重写事件、id、cwd、预设或会话正文。

R-005: session_projcache 是派生数据，不能成为 Work/Chat 分类的唯一来源。首次列表读取或缓存缺失时，使用持久化层只读 handle 与 DSH projection registry 恢复真实预设、标题和列表元数据，回填有效缓存；不创建 Agent、不发送模型请求。保留没有 cwd 的 Chat，按事件中最终选定的预设识别带 cwd 的历史 Chat。模式搜索复用同一分类，通用搜索保留原先的低 I/O 行为。

此次手动反馈证明仅做文件/持久化读取冒烟不足以证明侧栏可见性，因此增加后端列表与模式搜索回归，以及真实数据的空分类缓存列表冒烟。
