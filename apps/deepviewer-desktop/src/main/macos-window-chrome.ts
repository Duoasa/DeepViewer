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
:root {
  --deepviewer-window-control-top: 13px;
  --deepviewer-window-control-size: 24px;
  --deepviewer-window-control-icon-size: 16px;
  --deepviewer-window-control-right: max(16px, env(safe-area-inset-right));
}

/* Keep the existing right-corner controls while official DSH owns their actions. */
[data-sidebar-right-expand],
[data-sidebar-right-toggle],
[data-sidebar-right-mode] {
  position: fixed !important;
  top: var(--deepviewer-window-control-top) !important;
  right: var(--deepviewer-window-control-right) !important;
  z-index: 50;
  width: 24px !important;
  height: 24px !important;
  padding: 4px !important;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}
[data-sidebar-right-mode] {
  right: calc(var(--deepviewer-window-control-right) + 32px) !important;
}
[data-sidebar-right-panel] > div {
  padding-top: ${MACOS_TOP_SAFE_AREA_HEIGHT}px;
}
[data-sidebar-right-panel]::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: ${MACOS_TOP_SAFE_AREA_HEIGHT}px;
  background: var(--dsw-alias-bg-base);
  z-index: var(--dsh-dockkit-dock-layer, 10);
  border-left: 0.5px solid var(--dsw-alias-border-l4);
  box-sizing: border-box;
  transform: translateX(var(--dsh-sidebar-width));
  visibility: hidden;
  transition: transform var(--ds-transition-duration-slow) var(--ds-ease-in-out), visibility 0s linear var(--ds-transition-duration-slow);
  -webkit-app-region: drag;
}
[data-sidebar-right-panel][data-sidebar-right-open]::before {
  transform: none;
  visibility: visible;
  transition: transform var(--ds-transition-duration-slow) var(--ds-ease-in-out);
}

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

[data-deepviewer-macos-sidebar-column],
[data-deepviewer-settings-sidebar] {
  background: var(--dsw-specific-sidebar-fill) !important;
}

[data-deepviewer-macos-sidebar] {
  background: transparent !important;
}

:root[data-deepviewer-macos-window-focused]
  [data-deepviewer-macos-sidebar-column],
:root[data-deepviewer-macos-window-focused]
  [data-deepviewer-settings-sidebar] {
  --dsw-specific-sidebar-fill:
    color-mix(in srgb, var(--dsw-alias-bg-base) 58%, transparent);
}

/* Keep the workspace mounted while settings uses the same native backdrop. */
body:has([data-deepviewer-settings-sidebar]) [data-deepviewer-macos-frame] {
  opacity: 0;
  pointer-events: none;
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

/* The details tabs double as the right-column titlebar so the preview does not
   stack a blank safe-area row above its own header. The fixed preview toggle
   occupies the reserved space at the right edge. */
[data-deepviewer-macos-details-safe-area] {
  height: 0;
}

[data-deepviewer-details-header] {
  min-height: ${MACOS_TOP_SAFE_AREA_HEIGHT}px !important;
  box-sizing: border-box;
  padding: 7px 48px 0 12px !important;
  -webkit-app-region: drag;
}

[data-deepviewer-details-header] button {
  -webkit-app-region: no-drag;
}

#deepviewer-macos-sidebar-toggle-host {
  position: absolute;
  inset: 0;
}

#deepviewer-macos-session-stats {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 48px;
  min-width: 0;
  pointer-events: none;
}
#deepviewer-macos-session-stats [data-composer-stats] {
  pointer-events: auto;
  -webkit-app-region: no-drag;
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
  width: var(--deepviewer-window-control-size);
  height: var(--deepviewer-window-control-size);
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

/* The maximized preview owns the title row, including the traffic-light area. */
:root[data-deepviewer-right-maximized] #deepviewer-macos-sidebar-toggle {
  visibility: hidden;
  pointer-events: none;
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
  width: var(--deepviewer-window-control-icon-size);
  height: var(--deepviewer-window-control-icon-size);
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

/* RC2 owns all three interpolatable tracks, including zero-width collapse. */
[data-deepviewer-macos-frame][data-sidebar-collapsed]
  > [data-deepviewer-macos-sidebar-column] {
  border-right: 0 !important;
}

@media (prefers-reduced-motion: reduce) {
  [data-deepviewer-macos-frame],
  [data-sidebar-right-panel]::before {
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
    const detailsColumnClass = moduleClass(FRAME_STYLE, 'rightbarCol');
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
      const desiredToggleHost = collapsed ? mainSafeArea : toggleHost;
      if (button.parentElement !== desiredToggleHost) desiredToggleHost.append(button);
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? '打开侧栏' : '收起侧栏');
      button.title = collapsed ? '打开侧栏' : '收起侧栏';
      makeWordmarkStatic();
    };

    let nativeThemeSource = '';
    const syncNativeTheme = () => {
      // Forward the preference, not its resolved palette: forcing light/dark
      // also overrides prefers-color-scheme and breaks the system preference.
      const preference = document.body.getAttribute('data-deepviewer-theme-source');
      const source = preference === 'dark' || preference === 'light' ? preference : 'system';
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
      attributeFilter: ['data-sidebar-collapsed'],
    });
    const sidebarObserver = new MutationObserver(() => {
      makeWordmarkStatic();
      syncWorkspaceFade();
    });
    sidebarObserver.observe(sidebar, { childList: true, subtree: true });
    const themeObserver = new MutationObserver(syncNativeTheme);
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-deepviewer-theme-source'],
    });
    sync();
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
