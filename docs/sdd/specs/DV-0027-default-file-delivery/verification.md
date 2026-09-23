# DV-0027 验证

Status: Implementing；视觉与真实生成仍为 Pending Manual。

2026-09-21：维护者要求仅做自动化冒烟，最终效果由维护者手动确认。

- AC-001：prompt.host.spec.ts 验证应用级交付规则装配与卸载。
- AC-002 / AC-005：auto-delivery.host.spec.ts 覆盖外部原图、无后缀哈希对象、错误扩展名、原图/规范化对象别名、内容保持、文件冲突、只读、符号链接逃逸、取消、策略阻止及无效别名；只有最终成功结果登记交付。
- AC-003：present.spec.ts、present-open.host.spec.ts、produced-files.client.spec.tsx 验证原生工具兼容性、鉴权打开、卡片与去重。上述 5 个文件合计 98 项测试通过。宿主/客户端 TypeScript build 通过；owned overrides 包含交付器、present 扩展点、客户端与持久化别名校验。
- AC-005 / AC-006：`node apps/deepviewer-desktop/scripts/smoke-file-delivery.mjs` 在隔离 DSH Home/临时工作区启动真实编译 Host，fixture 工具不访问生成 API、不消耗订阅额度。两个错误输入均物化为 workspace/outputs 中的 PNG；模型 paths、自动交付与显式 present 的缓存别名指向同一原图；绝对/相对卡片路径经真实侧栏 fileUrl 读取均为 HTTP 200/image/png 且逐字节相同。匿名请求拒绝，原缓存位置仍返回 403，workspaceFence 未关闭。
- AC-004：桌面 Build 64 构建通过；开发版重启记录见本次任务输出。没有自动点击用户应用或替代维护者做视觉验收。

重现：在开发工作树根目录使用 Node 24 运行上述 smoke 脚本；在 upstream/deepseek-harness 运行 `node_modules/.bin/vitest run packages/client/ui-deliverables/tests/auto-delivery.host.spec.ts packages/client/ui-deliverables/tests/prompt.host.spec.ts packages/client/ui-deliverables/tests/present-open.host.spec.ts packages/client/ui-deliverables/tests/produced-files.client.spec.tsx packages/fs/tool-present/tests/present.spec.ts`。

0.3.1 固化复核（2026-09-21）：上述文件交付冒烟重新通过；附件/Present 98 项与侧栏状态 31 项，共 129 项自动测试通过；完整 Host/Client 编译通过。最终视觉/真实生成仍 Pending Manual。
