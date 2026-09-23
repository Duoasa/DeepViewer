/** Desktop adaptation of Better Sidebar's documented, stable data attributes.
 * The native DSH sidebar and plugin store continue to own all panel state.
 */
export const BETTER_SIDEBAR_CHROME_CSS = `
/* A body-level toolbar avoids both the conversation stacking context and
   the right panel's transform. Only rendered buttons participate in layout. */
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
[data-dsh-native-tab-host],
[data-dsh-bottom-panel] {
  min-width: 0;
  min-height: 0;
  -webkit-app-region: no-drag;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
}
/* The plugin marks our inner flex body, preserving the 48px native title row.
   Its margin reserves bottom-panel height; never add a second reservation. */
[data-deepviewer-macos-main-column] > [data-dsh-center-col] {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
}
/* Keep centered token statistics clear of the three top-right controls. */
body:has([data-dsh-bottom-toggle]) #deepviewer-macos-session-stats {
  padding-inline: 112px;
}
@media (max-width: 960px) {
  body:has([data-dsh-bottom-toggle]) #deepviewer-macos-session-stats {
    padding-inline: 96px;
    font-size: 11px;
  }
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
  const sourceSelector = '[data-dsh-bottom-toggle], [data-sidebar-right-expand], [data-sidebar-right-toggle], [data-sidebar-right-mode]';
  const controls = new Map();
  const selectSources = () => {
    const bottom = document.querySelector('[data-dsh-bottom-toggle]');
    if (!bottom) return [];
    const panel = document.querySelector('[data-sidebar-right-panel][data-sidebar-right-open]');
    return [
      ['bottom', bottom],
      ['mode', panel?.querySelector('[data-sidebar-right-mode]')],
      ['sidebar', panel?.querySelector('[data-sidebar-right-toggle]') ?? document.querySelector('[data-sidebar-right-expand]')],
    ].filter(([, source]) => source instanceof HTMLButtonElement);
  };
  const sync = () => {
    const sources = selectSources();
    toolbar.hidden = sources.length === 0;
    for (const source of document.querySelectorAll(sourceSelector)) {
      if (sources.length) {
        if (!source.hasAttribute('data-deepviewer-panel-control-source')) source.setAttribute('data-deepviewer-panel-control-source', '');
      } else source.removeAttribute('data-deepviewer-panel-control-source');
    }
    const active = new Set(sources.map(([key]) => key));
    for (const [key, button] of controls) {
      if (!active.has(key)) { button.remove(); controls.delete(key); }
    }
    for (const [index, [key, source]] of sources.entries()) {
      let button = controls.get(key);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.deepviewerPanelControl = key;
        button.addEventListener('click', () => {
          const current = selectSources().find(([name]) => name === key)?.[1];
          if (current && !current.disabled) current.click();
          sync();
        });
        controls.set(key, button);
      }
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
      if (toolbar.children[index] !== button) toolbar.insertBefore(button, toolbar.children[index] ?? null);
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
    attributeFilter: ['data-sidebar-right-open', 'data-sidebar-right-panel', 'data-sidebar-right-mode', 'aria-label', 'aria-pressed', 'aria-expanded', 'disabled'],
  });
  sync();
})();
`;
