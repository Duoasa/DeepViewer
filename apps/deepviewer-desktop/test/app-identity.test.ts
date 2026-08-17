import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  DEEPVIEWER_APP_ICON_PNG,
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
      .toBe('/Applications/DeepViewer.app/Contents/Resources/app.asar/assets/deepviewer-icon-macos26-1024.png')
    expect(DEEPVIEWER_APP_ICON_PNG).toBe('deepviewer-icon-macos26-1024.png')
  })

  it('configures Electron Packager with the generated macOS icon', () => {
    const packageScript = readFileSync(new URL('../scripts/package.mjs', import.meta.url), 'utf8')

    expect(packageScript).toContain("resolve(appRoot, 'assets', 'DeepViewer.icns')")
    expect(packageScript).toContain('icon: appIcon')
  })

  it('preserves the established full-size Dock and bundle icon assets', () => {
    const png = readFileSync(new URL('../assets/deepviewer-icon-macos26-1024.png', import.meta.url))
    const icns = readFileSync(new URL('../assets/DeepViewer.icns', import.meta.url))

    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('2fed65407833ae1ff677783c3885838a3db9116192ec440ccc8025fecb48323d')
    expect(createHash('sha256').update(icns).digest('hex'))
      .toBe('e70e7aae72a23e71621d8c31bea14db18a21408ae1b811ebdd803e01a6fc8f5b')
  })

  it('lets packaged macOS apps use the native bundle icon', () => {
    expect(shouldSetDevelopmentDockIcon('darwin', false)).toBe(true)
    expect(shouldSetDevelopmentDockIcon('darwin', true)).toBe(false)
    expect(shouldSetDevelopmentDockIcon('win32', false)).toBe(false)
  })
})
