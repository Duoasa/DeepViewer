import { describe, expect, it } from 'vitest'
import { DEEPVIEWER_APP_NAME } from '../src/main/app-identity.js'
import {
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
    expect(options.title).toBe(DEEPVIEWER_APP_NAME)
  })

  it('does not leak macOS window chrome settings to other platforms', () => {
    const options = createMainWindowOptions('/tmp/deepviewer-preload.cjs', 'win32')

    expect(options.titleBarStyle).toBeUndefined()
    expect(options.trafficLightPosition).toBeUndefined()
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

  it('installs a full-width draggable toolbar with an interactive sidebar control', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('inset: 0 0 auto')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('-webkit-app-region: drag')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('-webkit-app-region: no-drag')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('padding-top: 48px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-original-sidebar-toggle]')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewer-macos-sidebar-toggle')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerOriginalSidebarToggle')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('currentToggle.click()')
  })

  it('reserves the full toolbar row for native chrome in every app column', () => {
    expect(MACOS_TOP_SAFE_AREA_HEIGHT).toBe(48)
    expect(MACOS_WINDOW_CHROME_CSS).toContain('height: 48px')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-sidebar]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-main-column]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-deepviewer-macos-details-column]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-shell-overlay]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-side]')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerMacosMainColumn')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('deepviewerMacosDetailsColumn')
  })

  it('presents the Harness collapsed state as a fully hidden sidebar', () => {
    expect(MACOS_WINDOW_CHROME_CSS).toContain('[data-sidebar-collapsed]')
    expect(MACOS_WINDOW_CHROME_CSS).toContain('grid-template-columns: 0px')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('data-sidebar-collapsed')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('--deepviewer-details-column')
    expect(MACOS_WINDOW_CHROME_SCRIPT).toContain('MutationObserver')
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
