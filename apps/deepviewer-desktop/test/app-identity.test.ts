import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  DEEPVIEWER_APP_NAME,
  preserveDeepViewerWindowTitle,
} from '../src/main/app-identity.js'

describe('DeepViewer app identity', () => {
  it('keeps the product name authoritative when a page updates its title', () => {
    const preventDefault = vi.fn()
    const setTitle = vi.fn()

    preserveDeepViewerWindowTitle({ preventDefault }, setTitle)

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(setTitle).toHaveBeenCalledWith(DEEPVIEWER_APP_NAME)
  })

  it('ships the original ICNS and stages product Dock resources for the native shell', () => {
    const packageScript = readFileSync(new URL('../scripts/package-native.mjs', import.meta.url), 'utf8')
    const staging = readFileSync(new URL('../scripts/prepare-native-runtime.mjs', import.meta.url), 'utf8')
    const bootstrap = readFileSync(new URL('../../deepviewer-adapter/desktop/bootstrap.ts', import.meta.url), 'utf8')

    expect(packageScript).toContain("icon:join(appRoot,'.desktop/native-icon/DeepViewer.icns')")
    expect(packageScript).not.toContain('Assets.car')
    expect(packageScript).not.toContain('CFBundleIconName')
    expect(staging).toContain("join(stage,'resources/DeepViewerDockThemes')")
    expect(bootstrap).toContain('followDockTheme({')
    expect(bootstrap).toContain("join(appRoot, '.desktop', 'native-icon')")
    const icns = readFileSync(new URL('../assets/DeepViewer.icns', import.meta.url))
    expect(icns.subarray(0, 4).toString()).toBe('icns')
    expect(createHash('sha256').update(icns).digest('hex'))
      .toBe('e70e7aae72a23e71621d8c31bea14db18a21408ae1b811ebdd803e01a6fc8f5b')
  })

  it('preserves the original PNG artwork for in-app surfaces', () => {
    const png = readFileSync(new URL('../assets/deepviewer-icon-macos26-1024.png', import.meta.url))
    const dark = readFileSync(new URL('../assets/deepviewer-icon-dark-1024.png', import.meta.url))

    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('2fed65407833ae1ff677783c3885838a3db9116192ec440ccc8025fecb48323d')
    expect(dark.readUInt32BE(16)).toBe(1024)
    expect(dark.readUInt32BE(20)).toBe(1024)
    expect(dark).toEqual(png)
  })
})
