import deepViewerLoadingLogo from '../renderer/assets/deepviewer-loading-logo.svg?raw'
import figtreeFontDataUri from '../renderer/assets/Figtree-VariableFont_wght.ttf?inline'

export const HARNESS_LOADING_OVERLAY_ID = 'deepviewer-harness-loading-overlay'
const LOADING_LOCKUP_CLASS = 'deepviewer-harness-loading-lockup'
const LOADING_LOGO_CLASS = 'deepviewer-harness-loading-logo'
const LOADING_HINT_CLASS = 'deepviewer-harness-loading-hint'

export const HARNESS_LOADING_BRAND_CSS = `
@font-face {
  font-family: "DeepViewer Figtree";
  src: url("${figtreeFontDataUri}") format("truetype");
  font-style: normal;
  font-weight: 300 900;
  font-display: block;
}

#${HARNESS_LOADING_OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: grid;
  min-width: 100vw;
  min-height: 100vh;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  background: #151517;
}

#${HARNESS_LOADING_OVERLAY_ID} .${LOADING_LOCKUP_CLASS} {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 80px;
}

#${HARNESS_LOADING_OVERLAY_ID} .${LOADING_LOGO_CLASS} {
  display: block;
  width: 112.7805px;
  height: 120px;
  flex: 0 0 auto;
  overflow: visible;
}

#${HARNESS_LOADING_OVERLAY_ID} .${LOADING_LOGO_CLASS} #Vector_2 {
  opacity: 1;
  animation: none;
}

#${HARNESS_LOADING_OVERLAY_ID} .${LOADING_HINT_CLASS} {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  background-image: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0.38) 0%,
    rgba(255, 255, 255, 0.62) 38%,
    rgba(255, 255, 255, 1) 50%,
    rgba(255, 255, 255, 0.62) 62%,
    rgba(255, 255, 255, 0.38) 100%
  );
  background-position: 120% 0;
  background-size: 220% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: "DeepViewer Figtree", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 24px;
  font-weight: 500;
  line-height: 40px;
  letter-spacing: 0;
  will-change: background-position;
  animation: deepviewer-loading-shimmer 1.8s linear infinite;
}

@keyframes deepviewer-loading-shimmer {
  from {
    background-position: 120% 0;
  }

  to {
    background-position: -120% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  #${HARNESS_LOADING_OVERLAY_ID} .${LOADING_HINT_CLASS} {
    color: rgba(255, 255, 255, 0.6);
    background-image: none;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.6);
    will-change: auto;
    animation: none;
  }
}
`

export const HARNESS_LOADING_BRAND_SCRIPT = `
(() => {
  const OVERLAY_ID = ${JSON.stringify(HARNESS_LOADING_OVERLAY_ID)};
  const LOCKUP_CLASS = ${JSON.stringify(LOADING_LOCKUP_CLASS)};
  const LOGO_CLASS = ${JSON.stringify(LOADING_LOGO_CLASS)};
  const HINT_CLASS = ${JSON.stringify(LOADING_HINT_CLASS)};
  const APP_FRAME_STYLE =
    'style[data-plugin-css="@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css"]';
  const logoSource = ${JSON.stringify(deepViewerLoadingLogo)};

  if (document.getElementById(OVERLAY_ID) !== null) return;

  const parsed = new DOMParser().parseFromString(logoSource, 'image/svg+xml');
  if (parsed.querySelector('parsererror') !== null || parsed.documentElement.localName !== 'svg') return;
  const logo = document.importNode(parsed.documentElement, true);
  logo.removeAttribute('style');
  logo.classList.add(LOGO_CLASS);
  logo.setAttribute('aria-hidden', 'true');
  logo.setAttribute('focusable', 'false');

  const hint = document.createElement('p');
  hint.className = HINT_CLASS;
  hint.textContent = 'Loading Plugins...';

  const lockup = document.createElement('div');
  lockup.className = LOCKUP_CLASS;
  lockup.append(logo, hint);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'Loading Plugins');
  overlay.append(lockup);
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
