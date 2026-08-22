import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveSubscriptionsPlugin,
  SUBSCRIPTIONS_PLUGIN_NAME,
  SUBSCRIPTIONS_PLUGIN_VERSION,
} from '../src/main/resource-locator.js'

async function createPlugin(root: string, version = SUBSCRIPTIONS_PLUGIN_VERSION): Promise<string> {
  const pluginRoot = join(root, 'node_modules', SUBSCRIPTIONS_PLUGIN_NAME)
  await mkdir(join(pluginRoot, 'lib'), { recursive: true })
  await writeFile(join(pluginRoot, 'lib', 'index.js'), 'export function apply() {}\n')
  await writeFile(join(pluginRoot, 'lib', 'client.js'), 'window.__subscriptions = true\n')
  await writeFile(join(pluginRoot, 'cordis.patch.yml'), '- insert:\n    - id: subscriptions\n      name: dsh-plugin-subscriptions\n')
  await writeFile(join(pluginRoot, 'LICENSE'), 'MIT\n')
  await writeFile(join(pluginRoot, 'package.json'), `${JSON.stringify({
    name: SUBSCRIPTIONS_PLUGIN_NAME,
    version,
    license: 'MIT',
    main: 'lib/index.js',
    exports: {
      './client': { default: './lib/client.js' },
    },
    peerDependencies: {
      '@deepseek-ai/dsh-attachment': '0.1.1-rc.2',
      '@deepseek-ai/dsh-home-paths': '0.1.1-rc.2',
      '@deepseek-ai/dsh-llm': '0.1.1-rc.2',
      '@deepseek-ai/dsh-tools': '0.1.1-rc.2',
    },
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        platform: 'web',
        inject: [
          '@deepseek-ai/dsh-client-runtime',
          '@deepseek-ai/dsh-client-ui-settings',
          '@deepseek-ai/dsh-client-locale',
        ],
      },
    },
  }, null, 2)}\n`)
  return pluginRoot
}

describe('subscriptions plugin integration (DV-0011)', () => {
  it('accepts the pinned DSH bundle/client contract and links it into the isolated profile fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-harness-'))
    const home = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-home-'))
    const pluginRoot = await createPlugin(root)

    const result = resolveSubscriptionsPlugin(root, home, false)

    expect(result).toEqual({
      enabled: true,
      diagnostic: 'SUBSCRIPTIONS_ENABLED version=0.3.1',
      patchPath: join(pluginRoot, 'cordis.patch.yml'),
    })
    expect(await realpath(join(home, 'profiles', 'node_modules', SUBSCRIPTIONS_PLUGIN_NAME)))
      .toBe(await realpath(pluginRoot))
  })

  it('degrades without touching the profile when disabled, missing, or incompatible', async () => {
    const root = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-harness-'))
    const home = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-home-'))

    expect(resolveSubscriptionsPlugin(root, home, true)).toEqual({
      enabled: false,
      diagnostic: 'SUBSCRIPTIONS_DISABLED',
    })
    expect(resolveSubscriptionsPlugin(root, home, false)).toEqual({
      enabled: false,
      diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=package-missing',
    })

    await createPlugin(root, '0.3.0')
    expect(resolveSubscriptionsPlugin(root, home, false)).toEqual({
      enabled: false,
      diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=manifest-invalid',
    })

    const staleRoot = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-stale-harness-'))
    const stalePlugin = await createPlugin(staleRoot)
    const staleManifestPath = join(stalePlugin, 'package.json')
    const staleManifest = JSON.parse(await readFile(staleManifestPath, 'utf8'))
    staleManifest.peerDependencies['@deepseek-ai/dsh-llm'] = '^0.1.0-rc.5'
    await writeFile(staleManifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`)
    expect(resolveSubscriptionsPlugin(staleRoot, home, false)).toEqual({
      enabled: false,
      diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=manifest-invalid',
    })
  })

  it('does not overwrite a profile-local directory owned outside the adapter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-harness-'))
    const home = await mkdtemp(join(tmpdir(), 'deepviewer-subscriptions-home-'))
    await createPlugin(root)
    await mkdir(join(home, 'profiles', 'node_modules', SUBSCRIPTIONS_PLUGIN_NAME), { recursive: true })

    expect(resolveSubscriptionsPlugin(root, home, false)).toEqual({
      enabled: false,
      diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=profile-link-occupied',
    })
  })
})
