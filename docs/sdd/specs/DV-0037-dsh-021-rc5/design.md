# DV-0037 Design

Status: Implementing

- D-001 (R-001): `prepare-upstream.mjs`、`bootstrap-native-upstream.mjs`、`stage.mjs`、`client/build-info.ts`、`resource-locator.ts`、`adapt-subscriptions-plugin.mjs` 和 `smoke-native-host.mjs` 使用同一组 rc.5 版本与提交。契约仍先校验全部锚点再写入。
- D-002 (R-002): `deepviewer-statistics-navigation-row` 按 rc.5 的 `tabs` / `viewTabs` / `ViewsMoreMenu` 重写，统计节点与 tablist 的父级不同，导航行是 tablist 的祖父。`deepviewer-synapse-blank-map-tabs` 改写已有的 `useMemo`，回调里不再声明 `visibleTabs`。`deepviewer-synapse-bind-header-target-actions` 在绑定 Synapse 动作时保留 `entryPins`、`entryActions` 和 `setPinned`。
- D-003 (R-003): `presentation/SidebarRoot.module.css` 吸收 rc.5 的 More 规则和 `gap: 2px`。`styles.json` 的 sha256 改为 rc.5 原文件 `28ced089f6a9f4f48b164b8cb28f3ec8bf18d34c3a8a889a034c9dae3b21c9f0`。`smoke:ui-regression` 额外运行上游 `sidebar-styles.client.spec.ts` 与 `panel-list.client.spec.tsx`。
- D-004 (R-004, NFR-001): model-capabilities 的 peer 与 shrinkwrap 对齐 rc.5。Figma staging 保持严格 semver。13 个被契约引用且在 rc.2…rc.5 有差异的上游文件已复核；除三处失败契约和侧栏样式外，锚点仍匹配，语义沿用上游（含 New Session 草稿复用和设置页 analytics）。

## Rejected

- 隐藏 More 菜单或禁用 `entry-customization`：会丢掉固定/隐藏入口，而 DeepViewer 没有替代交互。
- 在空白地图头继续做宽度截断：Synapse 测试要求同时看见 Chat 和 Map，并排除 Trajectory。
- 放宽 Figma peer：偏离 0.2.1 来源一致性，且 0.3.1 尚未发布。
