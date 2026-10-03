import ts from 'typescript'

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Bottom-workbench adapter drift: ${before.slice(0, 90)}`)
  return source.replace(before, after)
}
function parse(source) {
  const file = ts.createSourceFile('sidebar.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  if (file.parseDiagnostics.length) throw new Error('Invalid sidebar JavaScript after workbench removal')
  return file
}
function editFunction(source, name, replacement) {
  const file = parse(source)
  const matches = []
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (matches.length !== 1) throw new Error(`Expected one sidebar function ${name}, found ${matches.length}`)
  const node = matches[0]
  return source.slice(0, node.getFullStart()) + '\n' + replacement + source.slice(node.end)
}
// Remove unreachable factory-local function declarations, including the entire
// workbench renderer, split reducers, drag handlers and layout measurements.
// References outside function declarations are roots; this conservative pass
// leaves all side-effectful variable initializers and shared view code intact.
function pruneFunctions(source) {
  const file = parse(source)
  let factory
  const find = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'factory' && ts.isArrowFunction(node.initializer)) factory = node.initializer.body
    ts.forEachChild(node, find)
  }
  find(file)
  if (!factory || !ts.isBlock(factory)) throw new Error('Sidebar module factory missing')
  const functions = new Map(factory.statements.filter(ts.isFunctionDeclaration).map(node => [node.name.text, node]))
  const refs = node => {
    const names = new Set()
    const visit = child => {
      if (ts.isIdentifier(child) && functions.has(child.text)
        && !(ts.isPropertyAccessExpression(child.parent) && child.parent.name === child)
        && !(ts.isPropertyAssignment(child.parent) && child.parent.name === child)) names.add(child.text)
      ts.forEachChild(child, visit)
    }
    visit(node)
    return names
  }
  const live = new Set()
  const queue = factory.statements.filter(node => !ts.isFunctionDeclaration(node)).flatMap(node => [...refs(node)])
  while (queue.length) {
    const name = queue.pop()
    if (live.has(name)) continue
    live.add(name)
    queue.push(...refs(functions.get(name).body))
  }
  for (const node of [...functions.values()].filter(node => !live.has(node.name.text)).sort((a, b) => b.pos - a.pos)) {
    source = source.slice(0, node.getFullStart()) + source.slice(node.end)
  }
  return source
}

export function removeBottomWorkbench(source) {
  source = replaceOnce(source, 'ctx.effect(() => registerBottomToggle(ctx, sidebarStore), "dsh-better-sidebar: bottom-workbench toggle");', '')
  source = editFunction(source, 'makeDefaultState', `function makeDefaultState() {
    return { nextTerminal: 1, nextBrowser: 1, expanded: [], revealed: [], agentWaits: {} };
  }`)
  source = editFunction(source, 'maxCounterId', 'function maxCounterId() { return 0; }')
  source = editFunction(source, 'sanitizeState', `function sanitizeState(record) {
    if (!record || typeof record !== 'object') return;
    return {
      ...makeDefaultState(),
      nextTerminal: Number.isSafeInteger(record.nextTerminal) && record.nextTerminal > 0 ? record.nextTerminal : 1,
      nextBrowser: Number.isSafeInteger(record.nextBrowser) && record.nextBrowser > 0 ? record.nextBrowser : 1,
      expanded: Array.isArray(record.expanded) ? record.expanded.filter(path => typeof path === 'string') : [],
    };
  }`)
  source = editFunction(source, 'tabOpenIn', 'function tabOpenIn() { return false; }')
  // Every open now uses the native right surface, including legacy target hints.
  source = replaceOnce(source, 'surface !== void 0 && seed.target !== "bottom"', 'surface !== void 0')
  const fallback = source.indexOf('\n\t\t\t\tconst activeSessionId = store.getSnapshot().sessionId;', source.indexOf('const openTab = (seed, scope) =>'))
  const close = source.indexOf('\n\t\t\tconst closeTab$1 =', fallback)
  if (fallback < 0 || close < 0) throw new Error('Sidebar open fallback missing')
  source = source.slice(0, fallback) + '\n\t\t\t};' + source.slice(close)
  const closeFallback = source.indexOf('\n\t\t\t\tlet closed;', source.indexOf('const closeTab$1 ='))
  const snapshot = source.indexOf('\n\t\t\t/** The snapshot', closeFallback)
  if (closeFallback < 0 || snapshot < 0) throw new Error('Sidebar close fallback missing')
  source = source.slice(0, closeFallback) + '\n\t\t\t};' + source.slice(snapshot)
  const updateStart = source.indexOf('const updateTab = (tabId, patch) =>')
  const openFile = source.indexOf('\n\t\t\t/** Open a file', updateStart)
  if (updateStart < 0 || openFile < 0) throw new Error('Sidebar tab operations missing')
  source = source.slice(0, updateStart) + `const updateTab = (tabId, patch) => { surface?.update(tabId, patch); };
    const activateTab$1 = tabId => { surface?.activate(tabId); };
` + source.slice(openFile)
  source = replaceOnce(source, 'const nativeRecords = createNativeTabRecords();', `const nativeRecords = createNativeTabRecords();
    sidebarStore.tabOpen = (sessionId, tabId) => nativeRecords.values().some(view => view.scope.sessionId === sessionId && (view.tab.id === tabId || view.tab.meta?.agentTabId === tabId));
    sidebarStore.countTerminals = () => nativeRecords.values().filter(view => view.scope.sessionId === sidebarStore.getSnapshot().sessionId && view.tab.type === 'terminal' && !view.tab.meta?.agentTabId).length;`)
  source = replaceOnce(source, 'get: (id) => views.get(id),', 'get: (id) => views.get(id),\n values: () => [...views.values()],')
  source = replaceOnce(source, 'version: SIDEBAR_SERVICE_VERSION,', 'version: SIDEBAR_SERVICE_VERSION,\n countTerminals: () => store.countTerminals?.() ?? 0,')
  source = editFunction(source, 'uiTerminalCount', '')
  source = source.replaceAll('uiTerminalCount(state)', '(ctx.get("betterSidebar")?.countTerminals() ?? 0)')
  source = replaceOnce(source, 'const tabs = allLeaves(snapshot.state.bottomSplits).flatMap((leaf) => leaf.tabs);', 'const tabs = nativeRecords.values().map(view => view.tab);')
  source = replaceOnce(source, 'store,\n\t\t\t\t\t\ttabId: tab.id', 'store,\n\t\t\t\t\t\ttabId: tab.meta?.agentTabId ?? tab.id')
  // Host waits and agent requests remain alive independently of any panel.
  source = editFunction(source, 'reconcileAgentTerminals', `function reconcileAgentTerminals(state, list) {
    return mirrorAgentWaits(state, list);
  }`)
  source = replaceOnce(source, 'if (!Array.isArray(list)) return;', `if (!Array.isArray(list)) return;
    if (store.getPrefs().tabsEnabled.terminal !== false) {
      const service = ctx.get('betterSidebar');
      for (const item of list) if (!seenAgentTerminals.has(item.uuid)) {
        seenAgentTerminals.add(item.uuid);
        service?.openTab({ type: 'terminal', title: item.title, meta: { agentTabId: 'agent:' + item.uuid } }, { sessionId });
      }
    }`)
  source = replaceOnce(source, 'const { ctx, store, sessionList, sessionId } = feeds;', 'const { ctx, store, sessionList, sessionId } = feeds;\nconst seenAgentTerminals = (0, react.useMemo)(() => new Set(), [sessionId]);')
  source = editFunction(source, 'Sidebar', `function DeepViewerSidebarRuntime({ ctx, store }) {
    const sessionList = (0, react.useSyncExternalStore)(callback => ctx.sessions.list.subscribe(callback), () => ctx.sessions.list.getSnapshot());
    const sessionId = deepviewerMainSession(sessionList);
    (0, react.useEffect)(() => { store.setSession(sessionId); }, [sessionId, store]);
    useHostFeeds({ ctx, store, sessionList, sessionId });
    return null;
  }`)
  const shellStart = source.indexOf('//#region src/client/Sidebar.tsx');
  const runtimeStart = source.indexOf('function DeepViewerSidebarRuntime(', shellStart);
  if (shellStart < 0 || runtimeStart < 0) throw new Error('Sidebar shell region missing');
  source = source.slice(0, shellStart) + source.slice(runtimeStart);
  const mountStart = source.indexOf('\n\t\t\t\tctx.effect(() => {\n\t\t\t\t\tlet disposed = false;')
  const mountEndMarker = '}, "dsh-better-sidebar: sidebar mount");'
  const mountEnd = source.indexOf(mountEndMarker, mountStart)
  if (mountStart < 0 || mountEnd < 0) throw new Error('Sidebar mount anchor missing')
  source = source.slice(0, mountStart) + `
    ctx.effect(() => {
      let disposed = false, generation = 0, root, host;
      const unmount = () => { root?.unmount(); root = undefined; host?.remove(); host = undefined; };
      const sync = async () => {
        const revision = ++generation;
        const decision = await Promise.race([loadBootDecision(api), new Promise(resolve => window.setTimeout(() => resolve(null), 2000))]);
        if (disposed || revision !== generation) return;
        if (decision) { sidebarStore.setPrefs(decision.prefs); sidebarStore.setSuspended(decision.suspended); }
        if (decision?.suspended) { unmount(); return; }
        if (root) return;
        host = document.createElement('div');
        host.setAttribute('data-deepviewer-sidebar-runtime', '');
        document.body.appendChild(host);
        root = (0, react_dom_client.createRoot)(host);
        root.render((0, react.createElement)(DeepViewerSidebarRuntime, { ctx, store: sidebarStore }));
      };
      void sync();
      const off = ctx.get('remote')?.$on?.('settings/document-updated', () => { void sync(); });
      return () => { disposed = true; off?.(); unmount(); };
    }, 'deepviewer: native sidebar runtime');` + source.slice(mountEnd + mountEndMarker.length)
  source = source.replace(/^\s*(?:bottomPanelAutoTerminal|collapseBottomPanel|expandBottomPanel|settingsBottomTerminalTitle|settingsBottomTerminalDesc):[^\n]*\n/gmu, '')
  source = editFunction(source, 'pathTabsOf', `function pathTabsOf(store) {
    return (store.nativeTabs?.() ?? []).filter(tab => tab.path !== undefined);
  }`)
  source = source.replaceAll('pathTabsOf(store.getSnapshot())', 'pathTabsOf(store)')
  source = replaceOnce(source, 'sidebarStore.tabOpen =', 'sidebarStore.nativeTabs = () => nativeRecords.values().filter(view => view.scope.sessionId === sidebarStore.getSnapshot().sessionId).map(view => view.tab);\n sidebarStore.tabOpen =')
  const sideStart = source.indexOf('const openFileSide = (absolute) => {')
  const sideEnd = source.indexOf('\n\t\t\t/** The context menu', sideStart)
  if (sideStart < 0 || sideEnd < 0) throw new Error('Editor side-open anchor missing')
  source = source.slice(0, sideStart) + `const openFileSide = absolute => {
    ctx.get('sidebarRight')?.split?.();
    openSidebarFile(ctx, store, scope.sessionId, absolute);
  };` + source.slice(sideEnd)
  source = replaceOnce(source, 'store.reduce((state) => patchTab(state, tab.id, {\n\t\t\t\t\tpath: nextUrl,\n\t\t\t\t\ttitle: host\n\t\t\t\t}));',
    'ctx.get("betterSidebar")?.updateTab(tab.id, { path: nextUrl, title: host });')
  source = pruneFunctions(source)
  // Remove the deleted surface's CSS rules and exported class names as well.
  source = source.replace(/const css\$6 = ("[^\n]*");/u, (_, literal) => {
    const css = JSON.parse(literal).replace(/([^{}]+)\{([^{}]*)\}/gu, (rule, selectors, body) => {
      const kept = selectors.split(',').filter(selector => !/nArs4W_bottom|data-dsh-panel-host/u.test(selector));
      return kept.length ? kept.join(',') + '{' + body + '}' : '';
    });
    return `const css$6 = ${JSON.stringify(css)};`;
  });
  source = source.replace(/^\s*"bottom[A-Za-z]+": "nArs4W_[^"]+",?\n/gmu, '');

  // Only keep layout rules needed by right-side tab views and menus. The old
  // stylesheet before the settings marker solely reserved workbench geometry.
  source = source.replace(/const css = ("[^\n]*");/u, (_, literal) => {
    let css = JSON.parse(literal)
    const start = css.indexOf('/* DSH 0.1.x gives external settings')
    if (start < 0) throw new Error('Sidebar shared layout stylesheet drift')
    css = css.slice(start).replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/u, '')
    return `const css = ${JSON.stringify(css)};`
  })
  parse(source)
  return source
}

/** Shared CSS is duplicated into lazy chunks by the upstream bundler. */
export function stripWorkbenchStyles(source) {
  source = source.replace(/const css(?:\$\d+)? = ("[^\n]*");/gu, (declaration, literal) => {
    if (!literal.includes('data-dsh-panel-host') && !literal.includes('nArs4W_bottom')) return declaration
    const css = JSON.parse(literal)
    const trimmed = css.replace(/([^{}]+)\{([^{}]*)\}/gu, (_rule, selectors, body) => {
      const kept = selectors.split(',').filter(selector => !/nArs4W_bottom|data-dsh-panel-host/u.test(selector))
      return kept.length ? kept.join(',') + '{' + body + '}' : ''
    })
    return declaration.replace(literal, JSON.stringify(trimmed))
  })
  return source.replace(/^\s*"bottom[A-Za-z]+": "nArs4W_[^"]+",?\n/gmu, '')
}
