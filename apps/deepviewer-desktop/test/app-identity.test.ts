import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  DEEPVIEWER_APP_ICON_ICNS,
  DEEPVIEWER_APP_NAME,
  preserveDeepViewerWindowTitle,
  resolveDeepViewerIconPath,
  shouldSetDevelopmentDockIcon,
} from '../src/main/app-identity.js'

describe('DeepViewer app identity', () => {
  it('keeps the product name authoritative when a page updates its title', () => {
    const preventDefault = vi.fn()
    const setTitle = vi.fn()

    preserveDeepViewerWindowTitle({ preventDefault }, setTitle)

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(setTitle).toHaveBeenCalledWith(DEEPVIEWER_APP_NAME)
  })

  it('resolves the repository and packaged app icon consistently', () => {
    expect(resolveDeepViewerIconPath('/Applications/DeepViewer.app/Contents/Resources/app.asar'))
      .toBe('/Applications/DeepViewer.app/Contents/Resources/app.asar/assets/DeepViewer.icns')
    expect(DEEPVIEWER_APP_ICON_ICNS).toBe('DeepViewer.icns')
  })

  it('configures Electron Packager with the generated macOS icon', () => {
    const packageScript = readFileSync(new URL('../scripts/package.mjs', import.meta.url), 'utf8')

    expect(packageScript).toContain("resolve(appRoot, 'assets', 'DeepViewer.icns')")
    expect(packageScript).toContain('icon: appIcon')
  })

  it('lets packaged macOS apps use the native bundle icon', () => {
    expect(shouldSetDevelopmentDockIcon('darwin', false)).toBe(true)
    expect(shouldSetDevelopmentDockIcon('darwin', true)).toBe(false)
    expect(shouldSetDevelopmentDockIcon('win32', false)).toBe(false)
  })
})
