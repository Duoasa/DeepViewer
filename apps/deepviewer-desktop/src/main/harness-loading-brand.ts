import launchBrandCss from '../shared/launch-brand.css?raw'
import { DEEPVIEWER_LAUNCH_LOCKUP_HTML } from '../shared/launch-brand.js'
import figtreeFontDataUri from '../renderer/assets/Figtree-VariableFont_wght.ttf?inline'

// Retain the private overlay id for lifecycle compatibility.
export const HARNESS_LOADING_OVERLAY_ID = 'deepviewer-harness-loading-overlay'

export const HARNESS_LOADING_BRAND_CSS = `
@font-face {
  font-family: "DeepViewer Figtree";
  src: url("${figtreeFontDataUri}") format("truetype");
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
}
${launchBrandCss}
#${HARNESS_LOADING_OVERLAY_ID} { position: fixed; inset: 0; z-index: 2147483646; overflow: auto; }
/* Continue the same lockup across the document handoff without a second entrance. */
#${HARNESS_LOADING_OVERLAY_ID} .deepviewer-launch__brand { animation: none; }
`

export const HARNESS_LOADING_BRAND_SCRIPT = `
(() => {
  const OVERLAY_ID = ${JSON.stringify(HARNESS_LOADING_OVERLAY_ID)};
  const APP_FRAME_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css"]';
  if (document.getElementById(OVERLAY_ID) !== null) return;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'deepviewer-launch';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', '正在准备工作区');
  const center = document.createElement('div');
  center.className = 'deepviewer-launch__center';
  center.innerHTML = ${JSON.stringify(DEEPVIEWER_LAUNCH_LOCKUP_HTML.replace('__DEEPVIEWER_ICON_LIGHT__', '/deepviewer-icon.png').replace('__DEEPVIEWER_ICON_DARK__', '/deepviewer-icon-dark.png'))};
  const status = document.createElement('p');
  status.className = 'deepviewer-launch__status';
  const dot = document.createElement('span');
  dot.className = 'deepviewer-launch__dot';
  dot.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('span');
  hint.textContent = '正在准备工作区';
  status.append(dot, hint);
  overlay.append(center, status);
  document.body.append(overlay);

  const normaliseText = (text) => text
    .replace(/\u2026/gu, '...')
    .trim()
    .toLocaleLowerCase('en-US');

  const hasLeafText = (expected) => Array.from(document.querySelectorAll('div, p, span'))
    .some((element) => element.children.length === 0
      && element.closest('#' + OVERLAY_ID) === null
      && normaliseText(element.textContent ?? '') === expected);

  const hasAppFrame = () => {
    const cssText = document.querySelector(APP_FRAME_STYLE)?.textContent ?? '';
    const frameClass = cssText.match(/\\.([\\w-]+_frame)(?=[\\s.{:#,])/u)?.[1];
    return frameClass !== undefined
      && document.querySelector('.' + CSS.escape(frameClass)) !== null;
  };

  let sawLoadingState = false;
  let removalQueued = false;
  let observer;
  let fallbackTimer;

  const removeOverlay = () => {
    observer?.disconnect();
    clearTimeout(fallbackTimer);
    overlay.remove();
  };

  const queueRemoval = () => {
    if (removalQueued) return;
    removalQueued = true;
    requestAnimationFrame(() => requestAnimationFrame(removeOverlay));
  };

  const sync = () => {
    const loading = hasLeafText('loading plugins...');
    if (loading) sawLoadingState = true;
    const failed = hasLeafText('failed to load plugins');
    if (failed || hasAppFrame() || (sawLoadingState && !loading)) queueRemoval();
  };

  observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  sync();
  fallbackTimer = setTimeout(removeOverlay, 15000);
})();
`
