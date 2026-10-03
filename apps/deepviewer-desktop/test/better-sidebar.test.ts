import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBetterSidebarPlugin, resolveHarnessLaunch } from '../src/main/resource-locator.js'
import type { App } from 'electron'

const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'deepviewer-sidebar-test-'))
  roots.push(root)
  const plugin = join(root, 'node_modules/dsh-better-sidebar')
  mkdirSync(join(plugin, 'lib'), { recursive: true })
  writeFileSync(join(plugin, 'package.json'), JSON.stringify({
    name: 'dsh-better-sidebar', version: '0.19.1', license: 'MIT', deepviewerAdapter: 'deepviewer-dsh017-sidebar-management-v1',
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: ['@deepseek-ai/dsh-client-ui-sidebar-right'] } },
  }))
  for (const file of ['lib/index.js', 'lib/client.js', 'lib/client-terminal.js', 'lib/client-editor.js', 'lib/client-mermaid.js', 'LICENSE', 'cordis.patch.yml']) writeFileSync(join(plugin, file), '')
  return { root, plugin, home: join(root, 'home') }
}
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('Better Sidebar integration', () => {
  it('loads the pinned native sidebar and can be disabled without changing user data', () => {
    const { root, home } = fixture()
    expect(resolveBetterSidebarPlugin(root, home, false).enabled).toBe(true)
    expect(resolveBetterSidebarPlugin(root, home, true).diagnostic).toBe('BETTER_SIDEBAR_DISABLED')
  })
  it('fails closed on a missing lazy editor chunk', () => {
    const { root, plugin, home } = fixture()
    rmSync(join(plugin, 'lib/client-editor.js'))
    expect(resolveBetterSidebarPlugin(root, home, false).enabled).toBe(false)
  })
  it('does not replace a user-owned profile package', () => {
    const { root, home } = fixture()
    mkdirSync(join(home, 'profiles/node_modules/dsh-better-sidebar'), { recursive: true })
    expect(resolveBetterSidebarPlugin(root, home, false).diagnostic).toContain('profile-link-occupied')
  })
  it('places the plugin on its own fallback step while preserving official permissions', () => {
    const { root } = fixture()
    mkdirSync(join(root, 'apps/cli/lib'), { recursive: true })
    writeFileSync(join(root, 'apps/cli/lib/bin.js'), '')
    vi.stubEnv('DEEPVIEWER_HARNESS_ROOT', root)
    vi.stubEnv('DSH_PERMISSION_MODE', 'workspace-write')
    vi.stubEnv('DEEPVIEWER_DISABLE_BETTER_SIDEBAR', '0')
    const app = { isPackaged: false, getPath: () => join(root, 'userdata'), getAppPath: () => root } as unknown as App
    const launch = resolveHarnessLaunch(app)
    expect(launch.integrationName).toBe('BETTER_SIDEBAR')
    const home = launch.env.DSH_HOME!
    const enablePatch = join(home, 'deepviewer-sidebar-enable.patch.yml')
    expect(launch.args).toContain(enablePatch)
    expect(launch.fallback?.args).not.toContain(enablePatch)
    expect(launch.fallback?.args).toContain(join(home, 'deepviewer-desktop.patch.yml'))
    expect(readFileSync(join(home, 'deepviewer-desktop.patch.yml'), 'utf8')).toContain('id: better-sidebar\n  disabled: true')
    expect(readFileSync(enablePatch, 'utf8')).toContain('id: better-sidebar\n  disabled: false')
    const profile = JSON.parse(readFileSync(join(home, 'profiles/web/package.json'), 'utf8'))
    expect(profile.dsh.profile.bundles).toContain('dsh-better-sidebar')
    expect(launch.fallback?.env).toBe(launch.env)
    expect(launch.env.DSH_PERMISSION_MODE).toBe('workspace-write')
  })

})


describe('development manifest changes', () => {
  it('restarts once for each dependency edit and ignores build-only writes or partial JSON', async () => {
    // @ts-expect-error JavaScript development helper has no declaration file.
    const { createManifestChangeDetector } = await import('../scripts/dev.mjs')
    let fingerprint: string | undefined = 'before-dependency'
    const changed = createManifestChangeDetector(() => fingerprint)
    expect(changed()).toBe(false)
    fingerprint = 'with-sidebar'
    expect(changed()).toBe(true)
    expect(changed()).toBe(false)
    fingerprint = undefined
    expect(changed()).toBe(false)
    fingerprint = 'with-sidebar'
    expect(changed()).toBe(false)
    fingerprint = 'another-edit'
    expect(changed()).toBe(true)
  })
})
