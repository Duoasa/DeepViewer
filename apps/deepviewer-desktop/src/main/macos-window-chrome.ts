/**
 * macOS-only renderer chrome installed by the trusted desktop shell.
 *
 * The Harness runtime remains the owner of sidebar state. This layer only
 * presents that state with DeepViewer's native-window conventions: a fixed
 * toolbar beside the traffic lights, a full-width drag strip, and a truly
 * zero-width collapsed sidebar instead of the web client's compact rail.
 */

export const MACOS_TOP_SAFE_AREA_HEIGHT = 48

export const MACOS_WINDOW_CHROME_CSS = `
#deepviewer-macos-window-toolbar {
  position: fixed;
  inset: 0 0 auto;
  height: ${MACOS_TOP_SAFE_AREA_HEIGHT}px;
  z-index: 2147483647;
  box-sizing: border-box;
  -webkit-app-region: drag;
}

#deepviewer-macos-sidebar-toggle {
  position: absolute;
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
  transition: left 200ms var(--ds-ease-in-out, ease);
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

[data-deepviewer-macos-sidebar] {
  padding-top: ${MACOS_TOP_SAFE_AREA_HEIGHT}px !important;
}

[data-deepviewer-macos-main-column],
[data-deepviewer-macos-details-column] {
  padding-top: ${MACOS_TOP_SAFE_AREA_HEIGHT}px !important;
  box-sizing: border-box;
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
  const TOOLBAR_ID = 'deepviewer-macos-window-toolbar';
  const TOGGLE_ID = 'deepviewer-macos-sidebar-toggle';
  const SIDEBAR_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css"]';
  const FRAME_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css"]';

  const moduleClass = (selector, suffix) => {
    const cssText = document.querySelector(selector)?.textContent ?? '';
    return cssText.match(new RegExp('\\\\.([\\\\w-]+_' + suffix + ')(?=[\\\\s.{:#,])', 'u'))?.[1];
  };

  const elementForClass = (className, root = document) => {
    if (className === undefined) return null;
    return root.querySelector('.' + CSS.escape(className));
  };

  const ensureToolbar = () => {
    const existing = document.getElementById(TOOLBAR_ID);
    if (existing instanceof HTMLDivElement) return existing;
    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.setAttribute('aria-hidden', 'true');
    document.body.append(toolbar);
    return toolbar;
  };

  const findParts = () => {
    const rootClass = moduleClass(SIDEBAR_STYLE, 'root');
    const toggleClass = moduleClass(SIDEBAR_STYLE, 'toggle');
    const panelIconClass = moduleClass(SIDEBAR_STYLE, 'panelIcon');
    const frameClass = moduleClass(FRAME_STYLE, 'frame');
    const mainColumnClass = moduleClass(FRAME_STYLE, 'centerCol');
    const detailsColumnClass = moduleClass(FRAME_STYLE, 'detailsCol');
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
    const panelIcon = originalToggle instanceof HTMLButtonElement
      ? elementForClass(panelIconClass, originalToggle)
      : null;
    return { sidebar, frame, mainColumn, detailsColumn, originalToggle, panelIcon };
  };

  const toolbar = ensureToolbar();
  if (toolbar.dataset.deepviewerInstalled === 'true') return;

  const install = () => {
    const {
      sidebar,
      frame,
      mainColumn,
      detailsColumn,
      originalToggle,
      panelIcon,
    } = findParts();
    if (!(sidebar instanceof HTMLElement)
      || !(frame instanceof HTMLElement)
      || !(mainColumn instanceof HTMLElement)
      || !(detailsColumn instanceof HTMLElement)
      || !(originalToggle instanceof HTMLButtonElement)
      || !(panelIcon instanceof SVGElement)) return false;

    sidebar.dataset.deepviewerMacosSidebar = '';
    mainColumn.dataset.deepviewerMacosMainColumn = '';
    detailsColumn.dataset.deepviewerMacosDetailsColumn = '';
    originalToggle.dataset.deepviewerOriginalSidebarToggle = '';
    frame.dataset.deepviewerMacosFrame = '';
    const sidebarColumn = frame.firstElementChild;
    if (sidebarColumn instanceof HTMLElement) {
      sidebarColumn.dataset.deepviewerMacosSidebarColumn = '';
    }

    const button = document.createElement('button');
    button.id = TOGGLE_ID;
    button.type = 'button';
    button.append(panelIcon.cloneNode(true));
    toolbar.append(button);
    toolbar.removeAttribute('aria-hidden');
    toolbar.dataset.deepviewerInstalled = 'true';

    const sync = () => {
      const collapsed = frame.hasAttribute('data-sidebar-collapsed');
      const widthTokens = frame.style.gridTemplateColumns.match(/-?\\d+(?:\\.\\d+)?px/gu) ?? [];
      const detailsWidth = widthTokens[widthTokens.length - 1] ?? '0px';
      if (frame.style.getPropertyValue('--deepviewer-details-column') !== detailsWidth) {
        frame.style.setProperty('--deepviewer-details-column', detailsWidth);
      }
      toolbar.toggleAttribute('data-sidebar-collapsed', collapsed);
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? '打开侧栏' : '收起侧栏');
      button.title = collapsed ? '打开侧栏' : '收起侧栏';
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
    sync();
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
