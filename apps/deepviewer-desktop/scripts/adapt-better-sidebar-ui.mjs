import { removeBottomWorkbench, stripWorkbenchStyles } from './remove-bottom-workbench.mjs'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

// Only the pinned published bundle is adapted. Fail on upstream drift.
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Sidebar desktop adapter anchor mismatch: ${before.slice(0, 90)}`)
  return source.replace(before, after)
}
// RC2 navigation belongs to uiWorkspace; catalog ownership is exposed through projections.
export function deepviewerMainSession(snapshot) {
  return Object.values(snapshot.byId).find(row => (row.retainedBy.mainView ?? 0) > 0)?.id
}
export function deepviewerSubagentCatalogs(snapshot) {
  return Object.fromEntries(Object.entries(snapshot.projectionsBySession).map(([id, projection]) => [id, {
    state: projection.state === 'idle' ? projection.values.subagentCatalog === undefined ? 'loading' : 'ready' : projection.state,
    error: projection.error,
    entries: (projection.values.subagentCatalog ?? []).map(entry => ({
      ...entry, activity: snapshot.byId[entry.id]?.running === true ? 'running' : 'inactive',
    })),
  }]))
}
export function adaptBetterSidebarUI(root) {
  const marker = '// deepviewer-sidebar-management-dsh017-v1'
  for (const file of ['client.js', 'client-registry.js', 'client-editor.js']) {
    const path = resolve(root, 'lib', file)
    if (file === 'client-registry.js' && !existsSync(path)) continue
    let source = readFileSync(path, 'utf8')
    if (source.includes(marker)) continue
    source = source.replace(/\b(Icon[A-Za-z]+)(?:14|16)\b/gu, '$1Regular')
    if (file !== 'client-editor.js') {
      source = replaceOnce(source, 'return registerTurnTailInterception(ctx, sidebarStore);', 'return () => {}; // RC2 deliverables owns turn-tail cards and resource opening; do not duplicate removed produced-file chips.')
      if (source.split('ctx.sessions.list.getSnapshot().current').length !== 3) throw new Error('Sidebar session selection anchors drifted')
      source = source.replaceAll('ctx.sessions.list.getSnapshot().current', 'deepviewerMainSession(ctx.sessions.list.getSnapshot())')
      source = replaceOnce(source, 'const current = sessionList.current;', 'const current = deepviewerMainSession(sessionList);')
      source = replaceOnce(source, '() => list.subagentsByParent ?? {}, [list.subagentsByParent]', '() => deepviewerSubagentCatalogs(list), [list.projectionsBySession, list.byId]')
      source = replaceOnce(source, 'sessions.setSubagentCatalogOpen?.(parentSessionId, open);', 'if (open) void sessions.refreshProjections(parentSessionId);')
      source = source.replaceAll('sessions.setSubagentCatalogOpen?.(parentSessionId, false);', '{} // Projection reads own no Session reference to release.')
      source = replaceOnce(source, 'sessions.openSubagent?.(address);', 'ctx.get("uiWorkspace").openSession(address);')
      source = replaceOnce(source, 'sessions.open?.(rootId);', 'ctx.get("uiWorkspace").openSession(rootId);')
      source = replaceOnce(source, 'sessions.refreshSubagents?.(parentSessionId);', 'void sessions.refreshProjections(parentSessionId);')
      source = `${deepviewerMainSession.toString()}\n${deepviewerSubagentCatalogs.toString()}\n// deepviewer-rc2-session-helpers-end\n${source}`
    }
    source = source.replaceAll('侧边卡片', '侧栏管理').replace('管理侧栏管理的显示内容与默认行为', '管理侧栏内容与默认行为').replaceAll('settingsNav: "Side card"', 'settingsNav: "Sidebar Management"')
    source = replaceOnce(source, 'function SandboxStatusBar(props) {', 'function SandboxStatusBar(props) {\nreturn null; // Desktop preview policy is fixed; no temporary unlock UI.')
    if (file === 'client-editor.js') {
      source = replaceOnce(source, 'const htmlNoSandbox = props.store?.getPrefs().htmlViewerNoSandbox === true || localUnlock;', 'const htmlNoSandbox = true;')
    } else {
      source = replaceOnce(source, 'const noSandbox = store.getPrefs().browserNoSandbox === true || localUnlock;', 'const noSandbox = true;')
      source = replaceOnce(source, 'const scheme = snapshot.prefs.titleBarScheme;', 'const scheme = "web"; // Electron owns window chrome, including legacy custom layouts.')
      source = replaceOnce(source,
        'props.enabled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {\n\t\t\t\t\t\t\t\t\tclassName: SideCardSection_module_css_default.cardSwitch,',
        '/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {\n\t\t\t\t\t\t\t\t\tclassName: SideCardSection_module_css_default.cardSwitch,')
      const sidechatStart = source.indexOf('\n\t\t\t\t{\n\t\t\t\t\tid: "sidechat",')
      const sidechatEnd = source.indexOf('\n\t\t\t\t{\n\t\t\t\t\tid: "terminal",', sidechatStart)
      if (sidechatStart < 0 || sidechatEnd < 0) throw new Error('Sidebar sidechat descriptor anchor missing')
      source = source.slice(0, sidechatStart) + source.slice(sidechatEnd)
      // Native DSH page navigation names the address `url`; BrowserView consumes `path`.
      source = replaceOnce(source, 'ensure({ id, kind, title, params, scope, mint }) {',
        'ensure({ id, kind, title, params, scope, mint }) {\n' +
        '\t\t\t\t\tif (kind === "browser" && typeof params?.url === "string") params = { ...params, path: params.url };\n' +
        // Native file resources carry session-relative paths; plugin file APIs require absolute paths.
        // Keep empty explorer paths and unresolved cwd untouched. The host still enforces its fence.
        '\t\t\t\t\tif ((kind === "editor" || kind === "files") && typeof params?.path === "string" && params.path !== "") params = { ...params, path: resolveSidebarPath(scope.cwd, params.path) };')
      source = replaceOnce(source, 'const noSandbox = true;', `const noSandbox = true;
      (0, react.useEffect)(() => {
        setUrl(tab.path);
        setInput(tab.path ?? "");
        setHistory(tab.path === void 0 ? [] : [tab.path]);
        setCursor(tab.path === void 0 ? -1 : 0);
        setMessage(null);
      }, [tab.id, tab.path]);`)
      source = replaceOnce(source, '输入网址开始浏览（沙箱模式）', '输入网址开始浏览')
      source = replaceOnce(source, 'Enter a URL to start browsing (sandbox mode)', 'Enter a URL to start browsing')
      source = replaceOnce(source, 'function BrowserView(props) {',
        readFileSync(new URL('./sidebar-browser-client.js', import.meta.url), 'utf8') + '\nfunction LegacyBrowserView(props) {')
      // RC2 defaults to one instance per kind and unmounts hidden bodies unless opted in.
      source = replaceOnce(source, 'kind: descriptor.id,', `kind: descriptor.id,
                        multiple: descriptor.id === "browser",
                        keepMounted: ["browser", "editor", "terminal"].includes(descriptor.id),`)
      source = replaceOnce(source, 'const options = {\n\t\t\t\t\t\tparams: entry.params,', `if (entry.tabKind === "browser") {
          const address = 'dsh-resource://browser/' + crypto.randomUUID() + '?url=' + encodeURIComponent(entry.params?.url ?? '');
          if (onScreen) api.openResource(address, { kind: "browser", revealIfOpened: false });
          else if (api.openResourceIn) api.openResourceIn(entry.sessionId, address, { kind: "browser", revealIfOpened: false });
          else return false;
          return true;
        }
        const options = {
                        params: entry.params,`)
      source = replaceOnce(source, 'const derived = props.paramsOf?.(info);', `const derived = descriptorId === "browser" && nativeTab.contentId.startsWith("dsh-resource://browser/")
        ? { path: new URL(nativeTab.contentId).searchParams.get("url") || void 0 }
        : props.paramsOf?.(info);`)
      source = replaceOnce(source, 'canOpen: (address) => parseFileAddress(address) !== void 0\n\t\t\t\t\t\t} : {},',
        'canOpen: (address) => parseFileAddress(address) !== void 0\n\t\t\t\t\t\t} : descriptor.id === "browser" ? { patterns: ["dsh-resource://browser/**"], canOpen: address => address.startsWith("dsh-resource://browser/") } : {},')
      source = replaceOnce(source, 'document.addEventListener("click", onClick, true);',
        'const offBrowserOpen = window.deepviewerDesktop?.onBrowserOpen?.(url => opts.openInSidebar(url));\n\t\t\tdocument.addEventListener("click", onClick, true);')
      source = replaceOnce(source, 'document.removeEventListener("click", onClick, true);',
        'offBrowserOpen?.();\n\t\t\t\tdocument.removeEventListener("click", onClick, true);')
      // Remove whole rendered controls, rather than hiding focusable elements.
      const badgeStart = source.lastIndexOf('/* @__PURE__ */', source.indexOf('className: SideCardSection_module_css_default.versionBadge,'))
      const badgeEnd = source.indexOf('/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {\n\t\t\t\t\t\tclassName: SideCardSection_module_css_default.group,', badgeStart)
      if (badgeStart < 0 || badgeEnd < 0) throw new Error('Sidebar version badge anchor missing')
      source = source.slice(0, badgeStart) + source.slice(badgeEnd)
      const title = source.indexOf('children: t("settingsTitleBarTitle")', source.indexOf('function SideCardSection('))
      const rowStart = source.lastIndexOf('/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {', title)
      const rowEnd = source.indexOf('\n\t\t\t\t\t\t]', title)
      if (title < 0 || rowStart < 0 || rowEnd < 0) throw new Error('Sidebar position row anchor missing')
      source = source.slice(0, rowStart) + 'null' + source.slice(rowEnd)
      for (const key of ['bottomPanelAutoTerminal', 'browserNoSandbox', 'browserAllowedLoopback', 'htmlViewerNoSandbox', 'htmlViewerDefaultUnsafe']) {
        const pattern = new RegExp('\\{\\s*key: "' + key + '",[\\s\\S]*?\\}')
        if (!pattern.test(source)) throw new Error(`Sidebar preference anchor missing: ${key}`)
        source = source.replace(pattern, 'null')
      }
      // Filter fixed-policy controls out of built-in definitions, retaining third-party controls.
      source = source.replace(/settings: \{ toggles: (\[[\s\S]*?\]) \}/g, 'settings: { toggles: $1.filter(Boolean) }')
      const cssMatch = source.match(/const css\$5 = ("[^\n]*");/)
      if (!cssMatch) throw new Error('Sidebar settings stylesheet anchor missing')
      const css = JSON.parse(cssMatch[1]) + `
._2vuxea_section{max-width:720px;gap:24px;color:var(--dsw-alias-label-primary)}
._2vuxea_intro{font-size:14px;line-height:22px;padding:0}
._2vuxea_group{padding:0;gap:12px;background:transparent;border:0;border-radius:0}
._2vuxea_group+._2vuxea_group{border-top:0.5px solid var(--dsw-alias-border-l4);padding-top:24px}
._2vuxea_groupHeading{padding:0;font-size:14px;line-height:22px;font-weight:500}
._2vuxea_count{background:transparent;padding:0;color:var(--dsw-alias-label-tertiary)}
._2vuxea_grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
._2vuxea_card,._2vuxea_cardOn{background:transparent;border:0.5px solid var(--dsw-alias-border-l4);border-radius:12px;min-height:100px}
._2vuxea_card:hover{background:var(--dsw-alias-interactive-bg-hover)}
._2vuxea_cardMain{padding:12px 14px;gap:6px;box-sizing:border-box}
._2vuxea_cardIconChip,._2vuxea_cardOn ._2vuxea_cardIconChip{border:0;background:transparent;color:var(--dsw-alias-label-secondary);width:24px;height:24px}
._2vuxea_cardTitle{font-weight:500;font-size:14px}
._2vuxea_cardDesc,._2vuxea_cardOn ._2vuxea_cardDesc{color:var(--dsw-alias-label-tertiary);font-size:12px}
._2vuxea_cardSettings,._2vuxea_cardOn ._2vuxea_cardSettings{border-top:0.5px solid var(--dsw-alias-border-l4);padding:7px 14px;color:var(--dsw-alias-label-secondary)}
._2vuxea_addCard{border-style:dashed;padding:12px 14px}
._2vuxea_row{padding:8px 0;border:0}
._2vuxea_popupRow{background:transparent;border:0;border-bottom:0.5px solid var(--dsw-alias-border-l4);border-radius:0;padding:12px 0}
._2vuxea_popupRow:last-child{border-bottom:0}
._2vuxea_selectAnchor,._2vuxea_typedInput,._2vuxea_cssTextArea,._2vuxea_openWithEditorInput,._2vuxea_openWithEditorTemplate{background:transparent}
`
      source = source.replace(cssMatch[0], `const css$5 = ${JSON.stringify(css)};`)
    }
    if (file !== 'client-editor.js') source = removeBottomWorkbench(source)
    source = stripWorkbenchStyles(source).replace(/^\/\/# sourceMappingURL=.*$/gmu, '')
    writeFileSync(path, marker + '\n' + source)
    rmSync(path + '.map', { force: true })
  }
  for (const name of ['client-terminal.js', 'client-mermaid.js']) {
    const path = resolve(root, 'lib', name)
    if (!existsSync(path)) continue
    const source = readFileSync(path, 'utf8')
    const trimmed = stripWorkbenchStyles(source).replace(/^\/\/# sourceMappingURL=.*$/gmu, '')
    if (trimmed !== source) { writeFileSync(path, trimmed); rmSync(path + '.map', { force: true }) }
  }

}
