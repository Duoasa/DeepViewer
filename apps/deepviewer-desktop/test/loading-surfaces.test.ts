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
const rendererCss = readFileSync(resolve(rendererRoot, '../shared/launch-brand.css'), 'utf8')
const brandMarkup = readFileSync(resolve(rendererRoot, '../shared/launch-brand.ts'), 'utf8')
const windowController = readFileSync(
  resolve(import.meta.dirname, '../src/main/window-controller.ts'),
  'utf8',
)
const rendererViteConfig = readFileSync(
  resolve(import.meta.dirname, '../vite.renderer.config.ts'),
  'utf8',
)

describe('DeepViewer branded loading surfaces (DV-0035)', () => {
  it('uses the supplied light and dark DeepViewer assets across both loading stages', () => {
    expect(rendererScript).toContain('assets/deepviewer-icon-macos26-1024.png')
    expect(rendererScript).toContain('assets/deepviewer-icon-dark-1024.png')
    expect(rendererScript).toContain('DEEPVIEWER_LAUNCH_LOCKUP_HTML')
    expect(brandMarkup).toContain('prefers-color-scheme: dark')
    expect(brandMarkup).toContain('DeepViewer</h1>')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('/deepviewer-icon.png')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('/deepviewer-icon-dark.png')
    expect(rendererScript + HARNESS_LOADING_BRAND_SCRIPT).not.toContain('Vector_2')
  })

  it('keeps recovery within the flow so it remains reachable in short windows', () => {
    expect(rendererHtml).toContain('deepviewer-launch__center')
    expect(rendererHtml).toContain('role="status"')
    expect(rendererCss).toContain('min-height: 100vh')
    expect(rendererCss).toContain('grid-template-rows: 1fr auto')
    expect(rendererCss).toContain('overflow-wrap: anywhere')
    expect(rendererCss).not.toContain('position: fixed')
  })

  it('builds file-protocol-compatible relative renderer asset URLs', () => {
    expect(rendererViteConfig).toContain("base: './'")
  })

  it('supports theme changes and a stationary reduced-motion state', () => {
    expect(rendererCss).toContain('@media (prefers-color-scheme: dark)')
    expect(rendererCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(rendererCss).toContain('.deepviewer-launch[data-phase="failed"]')
    expect(rendererCss).toContain('.deepviewer-launch[data-phase="ready"]')
    expect(rendererCss).toContain('animation: none')
    expect(rendererCss).not.toContain('deepviewer-cursor-blink')
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
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain("hint.textContent = '正在准备工作区'")
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('document.body.append(overlay)')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('new MutationObserver')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain("hasLeafText('failed to load plugins')")
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('hasAppFrame()')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain('setTimeout(removeOverlay, 15000)')
    expect(HARNESS_LOADING_BRAND_SCRIPT).not.toContain("textContent?.trim() === 'HARNESS'")
    expect(HARNESS_LOADING_BRAND_CSS).toContain('z-index: 2147483646')
    expect(HARNESS_LOADING_BRAND_CSS).toContain('animation: none')
    expect(HARNESS_LOADING_BRAND_CSS).not.toContain('deepviewer-cursor-blink')
  })

  it('shares layout and theme styles across the runtime handoff', () => {
    expect(HARNESS_LOADING_BRAND_CSS).toContain(rendererCss.trim())
    expect(HARNESS_LOADING_BRAND_CSS).toContain('.deepviewer-launch__brand { animation: none; }')
    expect(HARNESS_LOADING_BRAND_SCRIPT).toContain("overlay.className = 'deepviewer-launch'")
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
