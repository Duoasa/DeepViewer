import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { App } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MODEL_CAPABILITIES_PLUGIN_NAME, resolveHarnessLaunch, resolveModelCapabilitiesPlugin } from '../src/main/resource-locator.js'

const legacyNames = ['@deepviewer/dsh-plugin-reasoning', '@deepviewer/unrelated-user-plugin'] as const
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!
const archDescriptor = Object.getOwnPropertyDescriptor(process, 'arch')!
let base: string, harness: string, home: string, plugin: string
const manifest = JSON.parse(readFileSync(new URL('../../dsh-plugin-model-capabilities/package.json', import.meta.url), 'utf8'))

beforeEach(() => {
  // Exercise the supported launch contract even on a Linux CI runner.
  Object.defineProperty(process, 'platform', { value: 'darwin' })
  Object.defineProperty(process, 'arch', { value: 'arm64' })
  base = mkdtempSync(join(tmpdir(), 'deepviewer-native-capabilities-'))
  harness = join(base, 'harness')
  home = join(base, 'user', 'harness-home')
  plugin = join(harness, 'node_modules', MODEL_CAPABILITIES_PLUGIN_NAME)
  mkdirSync(join(plugin, 'lib'), { recursive: true })
  writeFileSync(join(plugin, 'package.json'), JSON.stringify(manifest))
  for (const file of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'LICENSE']) writeFileSync(join(plugin, file), '')
  for (const name of ['DEEPVIEWER_DISABLE_MODEL_CAPABILITIES', 'DEEPVIEWER_DISABLE_REASONING']) vi.stubEnv(name, undefined)
})
afterEach(() => {
  Object.defineProperty(process, 'platform', platformDescriptor)
  Object.defineProperty(process, 'arch', archDescriptor)
  vi.unstubAllEnvs()
  rmSync(base, { recursive: true, force: true })
})

function profileLink(name: string, target: string) {
  const link = join(home, 'profiles', 'node_modules', name)
  mkdirSync(dirname(link), { recursive: true })
  symlinkSync(target, link)
  return link
}

describe('native model capabilities replacement (DV-0037)', () => {
  it.each([['linux', 'x64'], ['darwin', 'x64']])('rejects unsupported %s/%s before touching the profile', (platform, arch) => {
    Object.defineProperty(process, 'platform', { value: platform })
    Object.defineProperty(process, 'arch', { value: arch })
    expect(() => resolveHarnessLaunch({} as App)).toThrow('DeepViewer 仅支持 Apple Silicon')
    expect(existsSync(home)).toBe(false)
  })
  it('activates the new bundle and retires only the runtime-owned old links, preserving saved data', () => {
    const oldLinks = legacyNames.map(name => profileLink(name, join(harness, 'node_modules', name)))
    const scans = join(home, 'deepviewer-model-scans.json')
    const config = join(home, 'profiles', 'web', 'settings.yml')
    mkdirSync(dirname(config), { recursive: true })
    writeFileSync(scans, 'legacy scan fixture')
    writeFileSync(config, 'user configuration fixture')
    expect(resolveModelCapabilitiesPlugin(harness, home).enabled).toBe(true)
    expect(readlinkSync(join(home, 'profiles', 'node_modules', MODEL_CAPABILITIES_PLUGIN_NAME))).toBe(plugin)
    expect(() => lstatSync(oldLinks[0]!)).toThrow()
    expect(lstatSync(oldLinks[1]!).isSymbolicLink()).toBe(true)
    expect(readFileSync(scans, 'utf8')).toBe('legacy scan fixture')
    expect(readFileSync(config, 'utf8')).toBe('user configuration fixture')
  })

  it('preserves unrelated installations of the previous plugin', () => {
    const custom = profileLink(legacyNames[0], join(base, 'custom-plugin'))
    const directory = join(home, 'profiles', 'node_modules', legacyNames[1])
    mkdirSync(directory, { recursive: true })
    expect(resolveModelCapabilitiesPlugin(harness, home).enabled).toBe(true)
    expect(readlinkSync(custom)).toBe(join(base, 'custom-plugin'))
    expect(lstatSync(directory).isDirectory()).toBe(true)
  })

  it.each(['DEEPVIEWER_DISABLE_MODEL_CAPABILITIES', 'DEEPVIEWER_DISABLE_REASONING'])('honors %s without modifying the profile', key => {
    vi.stubEnv(key, '1')
    expect(resolveModelCapabilitiesPlugin(harness, home).diagnostic).toBe('MODEL_CAPABILITIES_DISABLED')
    expect(existsSync(home)).toBe(false)
  })

  it('leaves an occupied user package untouched and repairs a stale new-plugin link', () => {
    const link = join(home, 'profiles', 'node_modules', MODEL_CAPABILITIES_PLUGIN_NAME)
    mkdirSync(link, { recursive: true })
    expect(resolveModelCapabilitiesPlugin(harness, home).diagnostic).toContain('profile-link-occupied')
    expect(lstatSync(link).isDirectory()).toBe(true)
    rmSync(link, { recursive: true })
    profileLink(MODEL_CAPABILITIES_PLUGIN_NAME, join(base, 'missing-runtime'))
    expect(resolveModelCapabilitiesPlugin(harness, home).enabled).toBe(true)
    expect(readlinkSync(link)).toBe(plugin)
  })

  it('rejects incomplete or incompatible bundles without retiring the old link', () => {
    const old = profileLink(legacyNames[0], join(harness, 'node_modules', legacyNames[0]))
    rmSync(join(plugin, 'lib/client.js'))
    expect(resolveModelCapabilitiesPlugin(harness, home).enabled).toBe(false)
    expect(lstatSync(old).isSymbolicLink()).toBe(true)
    writeFileSync(join(plugin, 'lib/client.js'), '')
    writeFileSync(join(plugin, 'package.json'), JSON.stringify({ ...manifest, version: '0.1.0' }))
    expect(resolveModelCapabilitiesPlugin(harness, home).enabled).toBe(false)
    expect(lstatSync(old).isSymbolicLink()).toBe(true)
  })

  it('launches with the new patch once and retains a clean core fallback', () => {
    mkdirSync(join(harness, 'apps/cli/lib'), { recursive: true })
    writeFileSync(join(harness, 'apps/cli/lib/bin.js'), '')
    vi.stubEnv('DEEPVIEWER_HARNESS_ROOT', harness)
    vi.stubEnv('DEEPVIEWER_DISABLE_SUBSCRIPTIONS', '1')
    vi.stubEnv('DEEPVIEWER_DISABLE_BETTER_SIDEBAR', '1')
    const app = { isPackaged: false, getPath: () => join(base, 'user'), getAppPath: () => base } as unknown as App
    const launch = resolveHarnessLaunch(app)
    const patch = join(plugin, 'cordis.patch.yml')
    expect(launch.args.filter(arg => arg === patch)).toHaveLength(1)
    expect(launch.args.join(' ')).not.toContain('dsh-plugin-reasoning')
    expect(launch.startupDiagnostics).toContain('MODEL_CAPABILITIES_ENABLED version=1.0.2')
    expect(launch.fallback?.args).not.toContain(patch)
    expect(launch.fallback?.startupDiagnostics).toEqual(['INTEGRATIONS_FALLBACK core-only'])
  })
})
