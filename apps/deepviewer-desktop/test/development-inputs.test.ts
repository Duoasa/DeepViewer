import { afterEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error The development helper is a JavaScript entrypoint.
import { createDevelopmentChangeDetector, shouldRestartForDevelopmentPath } from '../scripts/development-inputs.mjs'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'deepviewer-watch-'))
  roots.push(root)
  for (const path of ['src/main', 'assets', 'upstream-overrides', 'scripts', '.desktop/build']) {
    mkdirSync(join(root, path), { recursive: true })
  }
  writeFileSync(join(root, 'src/main/main.ts'), 'original source')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'DeepViewer', buildNumber: 1 }))
  return { root, changed: createDevelopmentChangeDetector(root) as () => string[] }
}

describe('development input changes', () => {
  it('ignores metadata changes and identical writes even when a directory event is received', () => {
    const { root, changed } = fixture()
    const file = join(root, 'src/main/main.ts')
    chmodSync(file, 0o600)
    utimesSync(file, new Date(), new Date())
    utimesSync(join(root, 'src/main'), new Date(), new Date())
    writeFileSync(file, readFileSync(file))
    expect(shouldRestartForDevelopmentPath('src/main')).toBe(true)
    expect(changed()).toEqual([])
  })

  it('reports a real source edit once despite repeated file and directory notifications', () => {
    const { root, changed } = fixture()
    writeFileSync(join(root, 'src/main/main.ts'), 'edited source')
    expect(changed()).toEqual(['src/main/main.ts'])
    expect(changed()).toEqual([])
    expect(changed()).toEqual([])
  })

  it('detects atomic replacements without relying on mtime or file size', () => {
    const { root, changed } = fixture()
    const target = join(root, 'src/main/main.ts')
    const replacement = join(root, 'src/main/.replacement')
    writeFileSync(replacement, 'modified source')
    renameSync(replacement, target)
    expect(changed()).toEqual(['src/main/main.ts'])
  })

  it('detects creation, deletion, icons, configuration and branding edits', () => {
    const { root, changed } = fixture()
    for (const path of ['src/main/extra.ts', 'assets/icon.png', 'vite.main.config.ts', 'scripts/sync-deepviewer-branding.mjs', 'scripts/build-native-desktop.mjs']) {
      writeFileSync(join(root, path), 'new input')
      expect(changed()).toEqual([path])
    }
    writeFileSync(join(root, 'upstream-overrides/about.tsx'), 'retired overlay')
    expect(changed()).toEqual([])
    rmSync(join(root, 'src/main'), { recursive: true })
    expect(changed()).toEqual(['src/main/extra.ts', 'src/main/main.ts'])
  })

  it('ignores editor files and generated build outputs', () => {
    const { root, changed } = fixture()
    for (const path of ['src/main/.DS_Store', 'src/main/file.ts~', 'src/main/file.swp', 'src/main/file.tmp', '.desktop/build/main.js']) {
      writeFileSync(join(root, path), 'temporary')
      expect(shouldRestartForDevelopmentPath(path)).toBe(false)
    }
    expect(changed()).toEqual([])
  })

  it('ignores build-number-only and formatting changes, but detects manifest settings', () => {
    const { root, changed } = fixture()
    const manifest = join(root, 'package.json')
    writeFileSync(manifest, JSON.stringify({ name: 'DeepViewer', buildNumber: 2 }, null, 2))
    expect(changed()).toEqual([])
    writeFileSync(manifest, JSON.stringify({ name: 'DeepViewer', buildNumber: 2, version: '0.5.2' }))
    expect(changed()).toEqual(['package.json'])
  })

  it('retains the last complete snapshot across partial saves', () => {
    const { root, changed } = fixture()
    writeFileSync(join(root, 'src/main/main.ts'), 'saved source')
    writeFileSync(join(root, 'package.json'), '{')
    expect(changed).toThrow()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'DeepViewer', buildNumber: 1 }))
    expect(changed()).toEqual(['src/main/main.ts'])
    expect(changed()).toEqual([])
  })

  it('tracks native composition inputs without watching generated outputs', () => {
    const { root } = fixture()
    const changed = createDevelopmentChangeDetector(root, { directories: [], files: ['native-modules.patch.yml'] })
    writeFileSync(join(root, 'native-modules.patch.yml'), 'reviewed source')
    expect(changed()).toEqual(['native-modules.patch.yml'])
    writeFileSync(join(root, 'native-modules.patch.yml'), 'reviewed source')
    writeFileSync(join(root, '.desktop/build/main.js'), 'generated')
    expect(changed()).toEqual([])
    expect(shouldRestartForDevelopmentPath('scripts/subscriptions-v4-messages.mjs')).toBe(true)
  })
})
