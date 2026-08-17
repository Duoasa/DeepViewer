/**
 * macOS-only renderer chrome installed by the trusted desktop shell.
 *
 * The Harness runtime remains the owner of sidebar state. This layer only
 * presents that state with DeepViewer's native-window conventions: structural
 * safe-area rows inside the sidebar, conversation, and details columns, plus a
 * truly zero-width collapsed sidebar instead of the web client's compact rail.
 */

export const MACOS_TOP_SAFE_AREA_HEIGHT = 48

export const MACOS_WINDOW_CHROME_CSS = `
html,
body,
#root,
[data-deepviewer-macos-frame] {
  background: transparent !important;
}

[data-deepviewer-macos-main-column],
[data-deepviewer-macos-details-column] {
  background: var(--dsw-alias-bg-base);
}

[data-deepviewer-macos-sidebar-column] {
  background: var(--dsw-specific-sidebar-fill) !important;
}

[data-deepviewer-macos-sidebar] {
  background: transparent !important;
}

:root[data-deepviewer-macos-window-focused]
  [data-deepviewer-macos-sidebar-column] {
  --dsw-specific-sidebar-fill:
    color-mix(in srgb, var(--dsw-alias-bg-base) 58%, transparent);
}

[data-deepviewer-macos-sidebar-safe-area],
[data-deepviewer-macos-main-safe-area],
[data-deepviewer-macos-details-safe-area] {
  display: block !important;
  position: relative;
  flex: none;
  height: ${MACOS_TOP_SAFE_AREA_HEIGHT}px;
  box-sizing: border-box;
  -webkit-app-region: drag;
}

#deepviewer-macos-sidebar-toggle-host {
  position: absolute;
  inset: 0;
}

#deepviewer-macos-session-stats {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: 0 48px;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.58));
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
  font-size: 12px;
  line-height: ${MACOS_TOP_SAFE_AREA_HEIGHT}px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

#deepviewer-macos-session-stats[hidden] {
  display: none;
}

[data-deepviewer-macos-session-stats-source] {
  display: none !important;
}

[data-deepviewer-macos-workspace-fade] {
  display: none !important;
}

[data-deepviewer-macos-workspace-list] {
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(100% - 24px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(100% - 24px),
    transparent 100%
  );
}

#deepviewer-macos-sidebar-toggle {
  position: fixed;
  top: 13px;
  left: 88px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.68));
  cursor: pointer;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

:root[data-deepviewer-macos-fullscreen] #deepviewer-macos-sidebar-toggle {
  left: 16px;
}

#deepviewer-macos-sidebar-toggle:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
}

#deepviewer-macos-sidebar-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-focus-ring, rgba(112, 152, 255, 0.9));
  outline-offset: 2px;
}

#deepviewer-macos-sidebar-toggle > svg {
  display: block !important;
  width: 16px;
  height: 16px;
  color: currentColor;
}

[data-deepviewer-macos-sidebar-column] {
  display: flex;
  flex-direction: column;
}

[data-deepviewer-macos-sidebar] {
  flex: 1;
  min-height: 0;
  height: auto !important;
  padding-top: 0 !important;
}

[data-deepviewer-macos-frame] > [data-shell-overlay] {
  inset: ${MACOS_TOP_SAFE_AREA_HEIGHT}px 0 0 !important;
}

[data-deepviewer-macos-frame] > [data-side] {
  top: ${MACOS_TOP_SAFE_AREA_HEIGHT}px !important;
}

[data-deepviewer-original-sidebar-toggle] {
  display: none !important;
}

[data-deepviewer-static-brand] {
  cursor: default !important;
  pointer-events: none !important;
}

[data-deepviewer-macos-frame][data-sidebar-collapsed] {
  grid-template-columns: 0px minmax(0, 1fr) var(--deepviewer-details-column, 0px) !important;
}

[data-deepviewer-macos-frame][data-sidebar-collapsed]
  > [data-deepviewer-macos-sidebar-column] {
  border-right: 0 !important;
}

@media (prefers-reduced-motion: reduce) {
  [data-deepviewer-macos-frame] {
    transition: none !important;
  }
}
`

export const MACOS_FULLSCREEN_EVENT_STATE = Object.freeze({
  'enter-full-screen': true,
  'leave-full-screen': false,
})

export const MACOS_WINDOW_CHROME_SCRIPT = `
(() => {
  const TOGGLE_ID = 'deepviewer-macos-sidebar-toggle';
  const TOGGLE_HOST_ID = 'deepviewer-macos-sidebar-toggle-host';
  const STATS_ID = 'deepviewer-macos-session-stats';
  const SIDEBAR_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css"]';
  const FRAME_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css"]';
  const STATS_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-conversation/StatsLine.module.css"]';
  const WORKSPACE_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css"]';

  const moduleClass = (selector, suffix) => {
    const cssText = document.querySelector(selector)?.textContent ?? '';
    return cssText.match(new RegExp('\\\\.([\\\\w-]+_' + suffix + ')(?=[\\\\s.{:#,])', 'u'))?.[1];
  };

  const elementForClass = (className, root = document) => {
    if (className === undefined) return null;
    return root.querySelector('.' + CSS.escape(className));
  };

  const findParts = () => {
    const rootClass = moduleClass(SIDEBAR_STYLE, 'root');
    const brandClass = moduleClass(SIDEBAR_STYLE, 'brand');
    const toggleClass = moduleClass(SIDEBAR_STYLE, 'toggle');
    const panelIconClass = moduleClass(SIDEBAR_STYLE, 'panelIcon');
    const frameClass = moduleClass(FRAME_STYLE, 'frame');
    const mainColumnClass = moduleClass(FRAME_STYLE, 'centerCol');
    const detailsColumnClass = moduleClass(FRAME_STYLE, 'detailsCol');
    const workspaceFadeClass = moduleClass(WORKSPACE_STYLE, 'fade');
    const workspaceListClass = moduleClass(WORKSPACE_STYLE, 'list');
    const sidebar = elementForClass(rootClass);
    const frame = elementForClass(frameClass);
    const mainColumn = frame instanceof HTMLElement
      ? elementForClass(mainColumnClass, frame)
      : null;
    const detailsColumn = frame instanceof HTMLElement
      ? elementForClass(detailsColumnClass, frame)
      : null;
    const originalToggle = sidebar instanceof HTMLElement
      ? elementForClass(toggleClass, sidebar)
      : null;
    const wordmarkButton = sidebar instanceof HTMLElement
      ? elementForClass(brandClass, sidebar)
      : null;
    const panelIcon = originalToggle instanceof HTMLButtonElement
      ? elementForClass(panelIconClass, originalToggle)
      : null;
    const sidebarSafeArea = document.querySelector('[data-deepviewer-macos-sidebar-safe-area]');
    const mainSafeArea = document.querySelector('[data-deepviewer-macos-main-safe-area]');
    const detailsSafeArea = document.querySelector('[data-deepviewer-macos-details-safe-area]');
    const toggleHost = document.getElementById(TOGGLE_HOST_ID);
    const statsDisplay = document.getElementById(STATS_ID);
    const workspaceFade = elementForClass(workspaceFadeClass);
    const workspaceList = elementForClass(workspaceListClass);
    return {
      sidebar,
      frame,
      mainColumn,
      detailsColumn,
      originalToggle,
      panelIcon,
      wordmarkButton,
      sidebarSafeArea,
      mainSafeArea,
      detailsSafeArea,
      toggleHost,
      statsDisplay,
      workspaceFade,
      workspaceList,
    };
  };

  if (document.documentElement.dataset.deepviewerMacosChromeInstalled === 'true') return;

  const install = () => {
    const {
      sidebar,
      frame,
      mainColumn,
      detailsColumn,
      originalToggle,
      panelIcon,
      wordmarkButton,
      sidebarSafeArea,
      mainSafeArea,
      detailsSafeArea,
      toggleHost,
      statsDisplay,
    } = findParts();
    const sidebarColumn = frame instanceof HTMLElement ? frame.firstElementChild : null;
    if (!(sidebar instanceof HTMLElement)
      || !(frame instanceof HTMLElement)
      || !(mainColumn instanceof HTMLElement)
      || !(detailsColumn instanceof HTMLElement)
      || !(sidebarColumn instanceof HTMLElement)
      || !(originalToggle instanceof HTMLButtonElement)
      || !(panelIcon instanceof SVGElement)
      || !(sidebarSafeArea instanceof HTMLDivElement)
      || !(mainSafeArea instanceof HTMLDivElement)
      || !(detailsSafeArea instanceof HTMLDivElement)
      || !(toggleHost instanceof HTMLDivElement)
      || !(statsDisplay instanceof HTMLDivElement)) return false;

    sidebar.dataset.deepviewerMacosSidebar = '';
    mainColumn.dataset.deepviewerMacosMainColumn = '';
    detailsColumn.dataset.deepviewerMacosDetailsColumn = '';
    originalToggle.dataset.deepviewerOriginalSidebarToggle = '';
    frame.dataset.deepviewerMacosFrame = '';
    sidebarColumn.dataset.deepviewerMacosSidebarColumn = '';

    const makeWordmarkStatic = () => {
      const currentWordmark = findParts().wordmarkButton;
      if (!(currentWordmark instanceof HTMLButtonElement)) return;
      currentWordmark.disabled = true;
      currentWordmark.tabIndex = -1;
      currentWordmark.setAttribute('aria-hidden', 'true');
      currentWordmark.removeAttribute('aria-label');
      currentWordmark.removeAttribute('title');
      currentWordmark.dataset.deepviewerStaticBrand = '';
    };
    if (wordmarkButton instanceof HTMLButtonElement) makeWordmarkStatic();

    const syncWorkspaceFade = () => {
      const { workspaceFade: currentFade, workspaceList: currentList } = findParts();
      if (currentFade instanceof HTMLElement) {
        currentFade.dataset.deepviewerMacosWorkspaceFade = '';
      }
      if (currentList instanceof HTMLElement) {
        currentList.dataset.deepviewerMacosWorkspaceList = '';
      }
    };
    syncWorkspaceFade();

    const button = document.createElement('button');
    button.id = TOGGLE_ID;
    button.type = 'button';
    button.append(panelIcon.cloneNode(true));
    toggleHost.append(button);
    document.documentElement.dataset.deepviewerMacosChromeInstalled = 'true';

    const sync = () => {
      const collapsed = frame.hasAttribute('data-sidebar-collapsed');
      const widthTokens = frame.style.gridTemplateColumns.match(/-?\\d+(?:\\.\\d+)?px/gu) ?? [];
      const detailsWidth = widthTokens[widthTokens.length - 1] ?? '0px';
      if (frame.style.getPropertyValue('--deepviewer-details-column') !== detailsWidth) {
        frame.style.setProperty('--deepviewer-details-column', detailsWidth);
      }
      const desiredToggleHost = collapsed ? mainSafeArea : toggleHost;
      if (button.parentElement !== desiredToggleHost) desiredToggleHost.append(button);
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? '打开侧栏' : '收起侧栏');
      button.title = collapsed ? '打开侧栏' : '收起侧栏';
      makeWordmarkStatic();
    };

    const syncStats = () => {
      const statsClass = moduleClass(STATS_STYLE, 'root');
      const source = elementForClass(statsClass);
      const text = source instanceof HTMLElement ? (source.textContent ?? '').trim() : '';
      if (source instanceof HTMLElement) {
        source.dataset.deepviewerMacosSessionStatsSource = '';
      }
      if (statsDisplay.textContent !== text) statsDisplay.textContent = text;
      statsDisplay.hidden = text === '';
    };

    let nativeThemeSource = '';
    const syncNativeTheme = () => {
      const source = document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
      if (nativeThemeSource === source) return;
      nativeThemeSource = source;
      window.deepviewerDesktop?.setNativeThemeSource?.(source);
    };

    button.addEventListener('click', () => {
      const currentToggle = findParts().originalToggle;
      if (currentToggle instanceof HTMLButtonElement) currentToggle.click();
    });

    const frameObserver = new MutationObserver(sync);
    frameObserver.observe(frame, {
      attributes: true,
      attributeFilter: ['data-sidebar-collapsed', 'style'],
    });
    const sidebarObserver = new MutationObserver(() => {
      makeWordmarkStatic();
      syncWorkspaceFade();
    });
    sidebarObserver.observe(sidebar, { childList: true, subtree: true });
    const statsObserver = new MutationObserver(syncStats);
    statsObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    const themeObserver = new MutationObserver(syncNativeTheme);
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-ds-dark-theme'],
    });
    sync();
    syncStats();
    syncNativeTheme();
    return true;
  };

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
})();
`

export function createMacosFullscreenStateScript(fullscreen: boolean): string {
  return `document.documentElement.toggleAttribute('data-deepviewer-macos-fullscreen', ${String(fullscreen)})`
}

export function createMacosFocusStateScript(focused: boolean): string {
  return `document.documentElement.toggleAttribute('data-deepviewer-macos-window-focused', ${String(focused)})`
}
