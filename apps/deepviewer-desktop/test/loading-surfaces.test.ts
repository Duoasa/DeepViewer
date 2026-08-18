import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HARNESS_LOADING_BRAND_CSS,
  HARNESS_LOADING_BRAND_SCRIPT,
  HARNESS_LOADING_OVERLAY_ID,
} from '../src/main/harness-loading-brand.js'
import {
  MINIMUM_LAUNCH_SURFACE_VISIBLE_MS,
  remainingLaunchSurfaceVisibilityMs,
  WAIT_FOR_LAUNCH_SURFACE_PAINT_SCRIPT,
} from '../src/main/launch-surface-timing.js'

const rendererRoot = resolve(import.meta.dirname, '../src/renderer')
const rendererHtml = readFileSync(resolve(rendererRoot, 'index.html'), 'utf8')
const rendererScript = readFileSync(resolve(rendererRoot, 'main.ts'), 'utf8')
const rendererCss = readFileSync(resolve(rendererRoot, 'styles.css'), 'utf8')
const loadingLogo = readFileSync(resolve(rendererRoot, 'assets/deepviewer-loading-logo.svg'), 'utf8')
const windowController = readFileSync(
  resolve(import.meta.dirname, '../src/main/window-controller.ts'),
  'utf8',
)
const rendererViteConfig = readFileSync(
  resolve(import.meta.dirname, '../vite.renderer.config.ts'),
  'utf8',
)

describe('DeepViewer branded loading surfaces (DV-0006)', () => {
  it('uses the exact local Figma logo and isolates its cursor line', () => {
    expect(loadingLogo).toContain('width="150.374"')
    expect(loadingLogo).toContain('height="160"')
    expect(loadingLogo).toContain('id="Vector"')
    expect(loadingLogo).toContain('id="Vector_2"')
    expect(rendererScript).toContain("querySelector('#Vector_2')")
    expect(rendererScript).toContain("setAttribute('data-deepviewer-cursor-line', '')")
  })

  it('centers the runtime lockup in the viewport instead of the Figma canvas', () => {
    expect(rendererHtml).toContain('class="loading-lockup"')
    expect(rendererHtml).toContain('<h1>DeepViewer</h1>')
    expect(rendererCss).toContain('min-height: 100vh')
    expect(rendererCss).toContain('place-items: center')
    expect(rendererCss).toContain('gap: 80px')
    expect(rendererCss).toContain('width: 112.7805px')
    expect(rendererCss).toContain('height: 120px')
    expect(rendererCss).toContain('font-size: 48px')
    expect(rendererCss).toContain('line-height: 40px')
    expect(rendererCss).not.toContain('1600px')
    expect(rendererCss).not.toContain('900px')
  })

  it('builds file-protocol-compatible relative renderer asset URLs', () => {
    expect(rendererViteConfig).toContain("base: './'")
  })

  it('only blinks the runtime cursor line and respects reduced motion', () => {
    expect(rendererCss).toContain(
      '.brand-logo [data-deepviewer-cursor-line] {\n  animation: deepviewer-cursor-blink 1s steps(1, jump-end) infinite;',
    )
    expect(rendererCss).toContain('@keyframes deepviewer-cursor-blink')
    expect(rendererCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(rendererCss).toContain('.launch[data-phase="failed"]')
  })

  it('preserves launch failure recovery without adding a new bridge API', () => {
    expect(rendererHtml).toContain('id="failure-panel"')
    expect(rendererHtml).toContain('id="retry"')
    expect(rendererHtml).toContain('id="logs"')
    expect(rendererScript).toContain('retryRuntime()')
    expect(rendererScript).toContain('openLogDirectory()')
  })

  it('keeps the startup surface visible for a minimum time after the window is shown', () => {
    expect(MINIMUM_LAUNCH_SURFACE_VISIBLE_MS).toBe(2_000)
    expect(remainingLaunchSurfaceVisibilityMs(1_000, 1_000)).toBe(2_000)
    expect(remainingLaunchSurfaceVisibilityMs(1_000, 1_500)).toBe(1_500)
    expect(remainingLaunchSurfaceVisibilityMs(1_000, 3_500)).toBe(0)
    expect(WAIT_FOR_LAUNCH_SURFACE_PAINT_SCRIPT).toContain(
      'requestAnimationFrame(() => requestAnimationFrame(resolve))',
    )
    expect(windowController).toContain("window.once('show'")
    expect(windowController).toContain('WAIT_FOR_LAUNCH_SURFACE_PAINT_SCRIPT')
    expect(windowController).toContain('this.markLaunchSurfaceVisible()')
    expect(windowController).toContain('await this.initialLaunchSurfaceVisible')
    expect(windowController).toContain('remainingLaunchSurfaceVisibilityMs')
  })

  it('installs an independent Harness loading overlay with a stable logo', () => {
    expect(HARNESS_LOADING_OVERLAY_ID).toBe('deepviewer-harness-loading-overlay')
    expect(() => new Function(HARNESS_LOADING_BRAND_SCRIPT)).not.toThrow()
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain("hint.textContent = 'Loading Plugins...'")
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('document.body.append(overlay)')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('new MutationObserver')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain("hasLeafText('failed to load plugins')")
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('hasAppFrame()')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('setTimeout(removeOverlay, 15000)')
    expect(HARNESS_LOADING_BRAND_SCRIPT).not.toContain("textContent?.trim() === 'HARNESS'")
    expect(HARNESS_LOADING_BRAND_CSS).toContain('z-index: 2147483646')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('width: 112.7805px')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('height: 120px')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('#Vector_2')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('animation: none')
    expect(HARNESS_LOADING_BRAND_CSS).not.toContain('deepviewer-cursor-blink')
  })

  it('centers the plugin lockup and applies shimmer only to its text', () => {
    expect(HARNESS_LOADING_BRAND_CSS).toContain('min-height: 100vh')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('place-items: center')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('gap: 80px')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('font-size: 24px')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('line-height: 40px')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('@keyframes deepviewer-loading-shimmer')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('will-change: background-position')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('@media (prefers-reduced-motion: reduce)')
    expect(HARNESS_LOADING_BRAND_CSS).not.toContain('1600px')
    expect(HARNESS_LOADING_BRAND_CSS).not.toContain('900px')
  })

  it('injects the plugin brand only outside the trusted local launch surface', () => {
    expect(windowController).toContain(
      'if (window.isDestroyed() || !this.isRuntimeSurface(window.webContents.getURL())) return',
    )
    expect(windowController).toContain('return new URL(url).origin === this.runtimeOrigin')
    expect(windowController).toContain('insertCSS(HARNESS_LOADING_BRAND_CSS)')
    expect(windowController).toContain('executeJavaScript(HARNESS_LOADING_BRAND_SCRIPT)')
    expect(windowController).toContain('await this.window.loadURL(origin)')
    expect(windowController).toContain('await this.installHarnessLoadingBrand(this.window)')
  })
})
