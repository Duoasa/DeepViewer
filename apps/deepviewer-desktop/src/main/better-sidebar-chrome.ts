/** Desktop adaptation of Better Sidebar's documented, stable data attributes.
 * The native DSH sidebar and plugin store continue to own all panel state.
 */
export const BETTER_SIDEBAR_CHROME_CSS = `
/* A body-level toolbar avoids both the conversation stacking context and
   the right panel's transform. Visible actions pack against the right edge. */
#deepviewer-panel-controls {
  position: fixed;
  top: var(--deepviewer-window-control-top);
  right: var(--deepviewer-window-control-right);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 55;
  -webkit-app-region: no-drag;
}
#deepviewer-panel-controls[hidden] { display: none; }
/* Hide new React source buttons before the observer's next update. */
:root[data-deepviewer-panel-controls-installed] :is([data-sidebar-right-expand], [data-sidebar-right-toggle], [data-sidebar-right-mode]),
[data-deepviewer-panel-control-source] { display: none !important; }
#deepviewer-panel-controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--deepviewer-window-control-size);
  height: var(--deepviewer-window-control-size);
  margin: 0;
  padding: 0;
  border: 0;
  box-sizing: border-box;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}
#deepviewer-panel-controls button[hidden] {
  display: none;
}
#deepviewer-panel-controls button:disabled { opacity: 0.4; cursor: default; }
body:has([data-deepviewer-settings-sidebar]) #deepviewer-panel-controls { display: none; }
#deepviewer-panel-controls button > svg {
  display: block;
  width: var(--deepviewer-window-control-icon-size);
  height: var(--deepviewer-window-control-icon-size);
}
#deepviewer-panel-controls button:hover,
#deepviewer-panel-controls button[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
#deepviewer-panel-controls button:focus-visible {
  outline: 2px solid var(--dsw-alias-focus-ring, rgba(112, 152, 255, 0.9));
  outline-offset: 2px;
}
/* No shell drag region may swallow editor, terminal, resize, or tab gestures. */
[data-dsh-native-tab-host] {
  min-width: 0;
  min-height: 0;
  -webkit-app-region: no-drag;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
}

`;


/** Presentation-only proxies, matching the desktop's existing left-sidebar
 * control. React keeps ownership of the source buttons and all panel state.
 */
export const BETTER_SIDEBAR_CHROME_SCRIPT = `
(() => {
  const ID = 'deepviewer-panel-controls';
  if (document.getElementById(ID)) return;
  const toolbar = document.createElement('div');
  toolbar.id = ID;
  toolbar.hidden = true;
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', document.documentElement.lang.startsWith('zh') ? '面板控制' : 'Panel controls');
  document.body.append(toolbar);
  document.documentElement.setAttribute('data-deepviewer-panel-controls-installed', '');
  const sourceSelector = '[data-sidebar-right-expand], [data-sidebar-right-toggle], [data-sidebar-right-mode]';
  const controls = new Map();
  const active = element => element && !element.closest('[hidden], [inert], [aria-hidden="true"]');
  const activePanel = () => Array.from(document.querySelectorAll('[data-sidebar-right-panel][data-sidebar-right-open]')).find(active);
  const activeButton = (root, selector) => Array.from(root?.querySelectorAll(selector) ?? []).find(active);
  const selectSources = () => {
    const panel = activePanel();
    return [
      ['mode', activeButton(panel, '[data-sidebar-right-mode]')],
      ['sidebar', activeButton(panel, '[data-sidebar-right-toggle]') ?? activeButton(document, '[data-sidebar-right-expand]')],
    ].filter(([, source]) => source instanceof HTMLButtonElement);
  };
  for (const key of ['mode', 'sidebar']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.hidden = true;
    button.disabled = true;
    button.dataset.deepviewerPanelControl = key;
    button.addEventListener('click', () => {
      const current = selectSources().find(([name]) => name === key)?.[1];
      if (current && !current.disabled) current.click();
      sync();
    });
    controls.set(key, button);
    toolbar.append(button);
  }
  const sync = () => {
    const sources = selectSources();
    const hidden = sources.length === 0;
    if (toolbar.hidden !== hidden) toolbar.hidden = hidden;
    const maximized = activePanel()?.getAttribute('data-sidebar-right-panel') === 'fullscreen';
    document.documentElement.toggleAttribute('data-deepviewer-right-maximized', maximized);
    for (const source of document.querySelectorAll(sourceSelector)) {
      if (sources.length) {
        if (!source.hasAttribute('data-deepviewer-panel-control-source')) source.setAttribute('data-deepviewer-panel-control-source', '');
      } else source.removeAttribute('data-deepviewer-panel-control-source');
    }
    const available = new Set(sources.map(([key]) => key));
    for (const [key, button] of controls) {
      const missing = !available.has(key);
      if (button.hidden !== missing) button.hidden = missing;
      if (missing && !button.disabled) button.disabled = true;
    }
    for (const [key, source] of sources) {
      const button = controls.get(key);
      // Copy only the glyph; never move a React-owned DOM node or duplicate ids.
      const glyph = source.querySelector('svg')?.outerHTML ?? '';
      if (button.innerHTML !== glyph) button.innerHTML = glyph;
      for (const attr of ['aria-label', 'aria-pressed', 'aria-expanded']) {
        const value = source.getAttribute(attr);
        if (value === null) { if (button.hasAttribute(attr)) button.removeAttribute(attr); }
        else if (button.getAttribute(attr) !== value) button.setAttribute(attr, value);
      }
      const title = source.getAttribute('aria-label') ?? source.title;
      if (button.title !== title) button.title = title;
      if (button.disabled !== source.disabled) button.disabled = source.disabled;
    }
  };
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-sidebar-right-open', 'data-sidebar-right-panel', 'data-sidebar-right-mode', 'aria-label', 'aria-pressed', 'aria-expanded', 'aria-hidden', 'hidden', 'inert', 'disabled'],
  });
  sync();
})();
`;
