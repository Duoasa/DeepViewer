import { EventEmitter } from 'node:events'
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { followDockTheme } from '../src/main/dock-theme.js'

// @ts-expect-error The native icon preparation helper is JavaScript.
const { compileNativeAppIcon } = await import('../scripts/native-app-icon.mjs')
const fixtures: string[] = []
afterEach(async () => {
  for (const path of fixtures.splice(0)) await rm(path, { recursive: true, force: true })
})

describe('original DeepViewer icon staging', () => {
  it('preserves the original ICNS and PNG for both Dock themes and replaces stale layered assets', async () => {
    const appRoot = await mkdtemp(join(tmpdir(), 'deepviewer-icons-'))
    fixtures.push(appRoot)
    const assets = join(appRoot, 'assets')
    await mkdir(assets)
    const source = resolve(import.meta.dirname, '../assets')
    await copyFile(join(source, 'DeepViewer.icns'), join(assets, 'DeepViewer.icns'))
    await copyFile(join(source, 'deepviewer-icon-macos26-1024.png'), join(assets, 'deepviewer-icon-macos26-1024.png'))
    const output = join(appRoot, '.desktop', 'native-icon')
    await mkdir(join(output, 'DeepViewer.icon'), { recursive: true })
    await writeFile(join(output, 'Assets.car'), 'stale Scoder icon')

    const icon = await compileNativeAppIcon(appRoot)
    expect(await readFile(icon.icns)).toEqual(await readFile(join(assets, 'DeepViewer.icns')))
    for (const appearance of ['light', 'dark']) {
      expect(await readFile(join(icon.dockThemes, `${appearance}.png`)))
        .toEqual(await readFile(join(assets, 'deepviewer-icon-macos26-1024.png')))
    }
    await expect(access(join(output, 'Assets.car'))).rejects.toThrow()
    await expect(access(join(output, 'DeepViewer.icon'))).rejects.toThrow()
    expect(await compileNativeAppIcon(appRoot)).toEqual(icon)
    await rm(join(icon.dockThemes, 'dark.png'))
    await compileNativeAppIcon(appRoot)
    expect(await readFile(join(icon.dockThemes, 'dark.png')))
      .toEqual(await readFile(join(assets, 'deepviewer-icon-macos26-1024.png')))
  })
})

class Theme extends EventEmitter {
  shouldUseDarkColors = false
  resolve(dark: boolean) {
    this.shouldUseDarkColors = dark
    this.emit('updated')
  }
}

function setup() {
  const theme = new Theme()
  const options = {
    theme,
    resourcesPath: '/App/Contents/Resources',
    loadImage: vi.fn((path: string) => ({ path, isEmpty: (): boolean => false })),
    setIcon: vi.fn(), log: vi.fn(), onError: vi.fn(),
  }
  return { options, theme }
}

describe('Dock theme synchronization', () => {
  it('applies the resolved app theme and follows later light/dark/system changes', () => {
    const { options, theme } = setup()
    const stop = followDockTheme(options)
    expect(options.setIcon.mock.lastCall?.[0].path).toBe('/App/Contents/Resources/DeepViewerDockThemes/light.png')
    theme.resolve(true)
    expect(options.setIcon.mock.lastCall?.[0].path).toContain('/dark.png')
    theme.resolve(true) // Changing source without changing resolved appearance.
    expect(options.setIcon).toHaveBeenCalledTimes(2)
    theme.resolve(false) // System resolves to light.
    expect(options.setIcon.mock.lastCall?.[0].path).toContain('/light.png')
    expect(options.loadImage).toHaveBeenCalledTimes(2)
    stop()
    theme.resolve(true)
    expect(options.setIcon).toHaveBeenCalledTimes(3)
  })

  it('starts with the current dark appearance', () => {
    const { options, theme } = setup()
    theme.shouldUseDarkColors = true
    followDockTheme(options)
    expect(options.setIcon.mock.lastCall?.[0].path).toContain('/dark.png')
  })

  it('leaves the bundle icon intact when a rendition is unavailable, and can retry', () => {
    const { options, theme } = setup()
    options.loadImage.mockReturnValueOnce({ path: '', isEmpty: () => true })
    followDockTheme(options)
    expect(options.setIcon).not.toHaveBeenCalled()
    expect(options.onError).toHaveBeenCalledOnce()
    theme.resolve(false)
    expect(options.setIcon).toHaveBeenCalledOnce()
  })
})
