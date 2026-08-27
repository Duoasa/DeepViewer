import { describe, expect, it } from 'vitest'
import { DEEPVIEWER_APP_NAME } from '../src/main/app-identity.js'
import {
  createMacosFocusStateScript,
  createMacosFullscreenStateScript,
  MACOS_FULLSCREEN_EVENT_STATE,
  MACOS_TOP_SAFE_AREA_HEIGHT,
  MACOS_WINDOW_CHROME_CSS,
  MACOS_WINDOW_CHROME_SCRIPT,
} from '../src/main/macos-window-chrome.js'
import {
  createMainWindowOptions,
  MACOS_TRAFFIC_LIGHT_POSITION,
} from '../src/main/window-options.js'

describe('main window options', () => {
  it('integrates the native traffic lights into the macOS content area', () => {
    const options = createMainWindowOptions('/tmp/deepviewer-preload.cjs', 'darwin')

    expect(options.titleBarStyle).toBe('hiddenInset')
    expect(options.trafficLightPosition).toEqual(MACOS_TRAFFIC_LIGHT_POSITION)
    expect(options.transparent).toBe(true)
    expect(options.vibrancy).toBe('sidebar')
    expect(options.visualEffectState).toBe('followWindow')
    expect(options.backgroundColor).toBe('#00000000')
    expect(options.title).toBe(DEEPVIEWER_APP_NAME)
  })

  it('does not leak macOS window chrome settings to other platforms', () => {
    const options = createMainWindowOptions('/tmp/deepviewer-preload.cjs', 'win32')

    expect(options.titleBarStyle).toBeUndefined()
    expect(options.trafficLightPosition).toBeUndefined()
    expect(options.transparent).toBeUndefined()
    expect(options.vibrancy).toBeUndefined()
    expect(options.visualEffectState).toBeUndefined()
    expect(options.backgroundColor).toBe('#0b0d12')
  })

  it('preserves the restricted renderer configuration', () => {
    const options = createMainWindowOptions('/tmp/deepviewer-preload.cjs', 'darwin')

    expect(options.webPreferences).toMatchObject({
      preload: '/tmp/deepviewer-preload.cjs',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    })
  })

  it('installs structural draggable safe areas with an interactive sidebar control', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-sidebar-safe-area]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-main-safe-area]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('-webkit-app-region: drag')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('-webkit-app-region: no-drag')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-original-sidebar-toggle]')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewer-macos-sidebar-toggle')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewer-macos-sidebar-toggle-host')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerOriginalSidebarToggle')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('currentToggle.click()')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('collapsed ? mainSafeArea : toggleHost')
    expect(MACOS_WINDOW_CHROME_SCRIPT).not.toContain('deepviewer-macos-window-toolbar')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('#deepviewer-macos-sidebar-toggle {\n  position: fixed')
    expect(MACOS_WINDOW_CHROME_CSS).not.toContain('transition: left')
  })

  it('reserves one native chrome row inside every app column', () => {
    expect(MACOS_TOP_SAFE_AREA_HEIGHT).toBe(48)
    expect(MACOS_WINDOW_CHROME_CSS).toContain('height: 48px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-sidebar-safe-area]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-main-safe-area]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-details-safe-area]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-details-safe-area] {\n  height: 0')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-details-header]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('padding: 7px 48px 0 12px !important')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-details-header] button')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-shell-overlay]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-side]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('--deepviewer-window-control-top: 13px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain(
      '--deepviewer-window-control-right: max(16px, env(safe-area-inset-right))',
    )
  })

  it('publishes the titlebar anchor and fixes session stats at its lower reference position', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-main-safe-area]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('#deepviewer-macos-session-stats')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-session-stats-source]')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('new ResizeObserver(syncActivityIslandAnchor)')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('publishActivityIslandAnchor?.(anchor)')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('StatsLine.module.css')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerMacosSessionStatsSource')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('top: 96px')
    expect(MACOS_WINDOW_CHROME_CSS).not.toContain(
      '[data-deepviewer-macos-main-safe-area] {\n  height: 160px',
    )
    expect(MACOS_WINDOW_CHROME_SCRIPT).not.toContain('getActivityIslandLayout')
    expect(MACOS_WINDOW_CHROME_SCRIPT).not.toContain('onActivityIslandLayout')
    expect(MACOS_WINDOW_CHROME_SCRIPT).not.toContain('--deepviewer-sidebar-safe-width')
    expect(MACOS_WINDOW_CHROME_SCRIPT).not.toContain('columnObserver')
    expect(MACOS_WINDOW_CHROME_SCRIPT).not.toContain('ensureToolbar')
  })

  it('presents the Harness collapsed state as a fully hidden sidebar', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-sidebar-collapsed]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('grid-template-columns: 0px')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('data-sidebar-collapsed')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('--deepviewer-details-column')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('MutationObserver')
  })

  it('uses native sidebar material only while the macOS window is focused', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-window-focused]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('color-mix(in srgb, var(--dsw-alias-bg-base) 58%, transparent)')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('background: var(--dsw-specific-sidebar-fill) !important')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-sidebar] {\n  background: transparent !important')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-main-column]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('background: var(--dsw-alias-bg-base)')
    expect(createMacosFocusStateScript(true)).toContain(
      "toggleAttribute('data-deepviewer-macos-window-focused', true)",
    )
    expect(createMacosFocusStateScript(false)).toContain(
      "toggleAttribute('data-deepviewer-macos-window-focused', false)",
    )
  })

  it('keeps native macOS controls aligned with the active light or dark theme', () => {
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain("hasAttribute('data-ds-dark-theme')")
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain("? 'dark' : 'light'")
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('setNativeThemeSource?.(source)')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain("attributeFilter: ['data-ds-dark-theme']")
  })

  it('fades the workspace list without painting another themed color layer', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-workspace-fade]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('display: none !important')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-workspace-list]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('-webkit-mask-image: linear-gradient')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('#000 calc(100% - 24px)')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('WorkspaceBrowser.module.css')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerMacosWorkspaceFade')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerMacosWorkspaceList')
  })

  it('presents the Harness wordmark as static brand artwork', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-static-brand]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('pointer-events: none')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerStaticBrand')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('currentWordmark.disabled = true')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain("currentWordmark.setAttribute('aria-hidden', 'true')")
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain("currentWordmark.removeAttribute('aria-label')")
  })

  it('moves the sidebar control left when native macOS fullscreen hides the traffic lights', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain(':root[data-deepviewer-macos-fullscreen]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('left: 16px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('top: 13px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('width: 24px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('width: 16px')
    expect(createMacosFullscreenStateScript(true)).toContain(
      "toggleAttribute('data-deepviewer-macos-fullscreen', true)",
    )
    expect(createMacosFullscreenStateScript(false)).toContain(
      "toggleAttribute('data-deepviewer-macos-fullscreen', false)",
    )
    expect(MACOS_FULLSCREEN_EVENT_STATE).toEqual({
      'enter-full-screen': true,
      'leave-full-screen': false,
    })
  })
})
