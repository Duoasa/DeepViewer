import { mkdtemp, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PREVIEW_PLUGIN_NAME,
  PREVIEW_PLUGIN_VERSION,
  resolvePreviewPlugin,
} from '../src/main/resource-locator.js'
import {
  isBlockedPreviewPath,
  injectPreviewNavigationBridge,
  listPreviewDirectory,
  PREVIEW_NAVIGATION_BRIDGE,
  PreviewCapabilities,
  readPreviewFile,
  resolveCapabilityAsset,
  resolvePreviewPath,
} from '../dsh-plugins/preview/src/host-files.js'
import {
  previewParentDirectories,
  workspaceRelativePreviewPath,
} from '../dsh-plugins/preview/src/client/preview-open.js'
import {
  clampPreviewTreeHeight,
  defaultPreviewPanelWidth,
} from '../dsh-plugins/preview/src/client/preview-layout.js'
import {
  externalPreviewUrl,
  parsePreviewBrowserLocation,
  previewDisplayAddress,
  previewSiteRoot,
  resolvePreviewAddress,
  updatePreviewBrowserState,
} from '../dsh-plugins/preview/src/client/preview-browser.js'

const temporaryRoots: string[] = []

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'deepviewer-preview-'))
  temporaryRoots.push(root)
  return root
}

async function createPlugin(root: string, version = PREVIEW_PLUGIN_VERSION): Promise<string> {
  const pluginRoot = join(root, 'node_modules', ...PREVIEW_PLUGIN_NAME.split('/'))
  await mkdir(join(pluginRoot, 'lib'), { recursive: true })
  await writeFile(join(pluginRoot, 'lib', 'index.js'), 'export {}\n')
  await writeFile(join(pluginRoot, 'lib', 'client.js'), 'module.exports = {}\n')
  await writeFile(join(pluginRoot, 'cordis.patch.yml'), '- insert: []\n')
  await writeFile(join(pluginRoot, 'LICENSE'), 'MIT\n')
  await writeFile(join(pluginRoot, 'package.json'), JSON.stringify({
    name: PREVIEW_PLUGIN_NAME,
    version,
    license: 'MIT',
    main: 'lib/index.js',
    exports: { './client': { default: './lib/client.js' } },
    peerDependencies: {
      '@deepseek-ai/cordis': '4.0.1',
      '@deepseek-ai/dsh-client-connection': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-locale': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-runtime': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-ui-conversation': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-ui-deliverables': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-ui-layout': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-ui-primitives': '0.1.1-rc.2',
      '@deepseek-ai/dsh-client-ui-slots': '0.1.1-rc.2',
    },
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        platform: 'web',
        inject: [
          '@deepseek-ai/dsh-client-connection',
          '@deepseek-ai/dsh-client-locale',
          '@deepseek-ai/dsh-client-runtime',
          '@deepseek-ai/dsh-client-ui-conversation',
          '@deepseek-ai/dsh-client-ui-deliverables',
          '@deepseek-ai/dsh-client-ui-layout',
        ],
      },
    },
  }))
  return pluginRoot
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('DeepViewer preview plugin integration', () => {
  it('uses a tracked test tsconfig and deterministically rewrites the staged DSH config', async () => {
    const sourceConfig = JSON.parse(await readFile(
      join(process.cwd(), 'dsh-plugins', 'preview', 'tsconfig.json'),
      'utf8',
    )) as { extends?: string, references?: unknown[] }
    const buildConfig = JSON.parse(await readFile(
      join(process.cwd(), 'dsh-plugins', 'preview', 'tsconfig.dsh.json'),
      'utf8',
    )) as { extends?: string, references?: Array<{ path: string }> }
    const syncScript = await readFile(join(process.cwd(), 'scripts', 'sync-upstream-overrides.mjs'), 'utf8')

    expect(sourceConfig.extends).toBe('../../tsconfig.json')
    expect(sourceConfig.references).toBeUndefined()
    expect(buildConfig.extends).toBe('./tsconfig.json')
    expect(buildConfig.references).toHaveLength(9)
    expect(buildConfig.references?.every(reference => (
      reference.path.startsWith('../../../../upstream/deepseek-harness/')
    ))).toBe(true)
    expect(syncScript).toContain(
      `.replaceAll('"../../tsconfig.json"', '"../../../tsconfig.base.client.json"')`,
    )
    expect(syncScript).toContain(`['exec', 'tsc', '-b', 'tsconfig.dsh.json']`)
  })

  it('opens at one third of the current app viewport', () => {
    expect(defaultPreviewPanelWidth(1440)).toBe(480)
    expect(defaultPreviewPanelWidth(1920)).toBe(640)
    expect(defaultPreviewPanelWidth(Number.NaN)).toBe(0)
  })

  it('keeps both preview sections usable while the horizontal divider moves', () => {
    expect(clampPreviewTreeHeight(-20, 400)).toBe(144)
    expect(clampPreviewTreeHeight(180, 400)).toBe(180)
    expect(clampPreviewTreeHeight(390, 400)).toBe(256)
    expect(clampPreviewTreeHeight(100, 120)).toBe(60)
  })

  it('maps a native menu target into the current workspace preview tree', () => {
    expect(workspaceRelativePreviewPath('/workspace', '/workspace/site/pages/index.html'))
      .toBe('site/pages/index.html')
    expect(previewParentDirectories('site/pages/index.html')).toEqual(['', 'site', 'site/pages'])
    expect(workspaceRelativePreviewPath('/workspace', '/workspace-other/index.html')).toBeUndefined()
    expect(workspaceRelativePreviewPath('/workspace', '/workspace/../outside.html')).toBeUndefined()
  })

  it('keeps browser addresses inside the current capability root', () => {
    const documentUrl = 'http://127.0.0.1:3000/chat'
    const entry = '/deepviewer-preview-static/token/index.html?refresh=1'
    const root = previewSiteRoot(entry, documentUrl)

    expect(root).toBe('http://127.0.0.1:3000/deepviewer-preview-static/token/')
    expect(previewDisplayAddress(`${root}docs/hello%20world.html?q=1#top`))
      .toBe('docs/hello world.html?q=1#top')
    expect(resolvePreviewAddress(root ?? '', 'docs/page.html', documentUrl))
      .toBe('http://127.0.0.1:3000/deepviewer-preview-static/token/docs/page.html')
    expect(resolvePreviewAddress(root ?? '', '../private.html', documentUrl)).toBeUndefined()
    expect(resolvePreviewAddress(root ?? '', 'https://example.com', documentUrl)).toBeUndefined()
    expect(resolvePreviewAddress(root ?? '', '/outside.html', documentUrl)).toBeUndefined()
    expect(externalPreviewUrl(entry, documentUrl))
      .toContain('deepviewerExternalPreview=1')
  })

  it('tracks sandbox navigation messages without trusting unrelated payloads', () => {
    const first = { href: 'http://preview.test/a.html', title: 'A' }
    const second = { href: 'http://preview.test/b.html', title: 'B' }
    const state = updatePreviewBrowserState({ entries: [], index: -1 }, first, null)
    const advanced = updatePreviewBrowserState(state, second, null)
    const returned = updatePreviewBrowserState(advanced, first, 0)

    expect(advanced).toEqual({ entries: [first, second], index: 1 })
    expect(returned).toEqual({ entries: [first, second], index: 0 })
    expect(parsePreviewBrowserLocation({
      source: 'deepviewer-preview-browser', type: 'location', ...second,
    })).toEqual(second)
    expect(parsePreviewBrowserLocation({ source: 'other', type: 'location', ...second })).toBeUndefined()
  })

  it('injects only the minimal opaque-origin navigation bridge into HTML bytes', () => {
    const source = Buffer.from('<title>Preview</title>')
    const result = injectPreviewNavigationBridge(source).toString('utf8')

    expect(result.startsWith('<title>Preview</title>')).toBe(true)
    expect(result).toContain(PREVIEW_NAVIGATION_BRIDGE)
    expect(result).toContain("event.source!==parent")
    expect(result).toContain("case'back':history.back()")
    expect(result).not.toContain('allow-same-origin')
  })

  it('validates the pinned package and prepares its scoped profile link', async () => {
    const root = await temporaryRoot()
    const home = join(root, 'home')
    const pluginRoot = await createPlugin(root)

    expect(resolvePreviewPlugin(root, home, false)).toEqual({
      enabled: true,
      patchPath: join(pluginRoot, 'cordis.patch.yml'),
      diagnostic: 'PREVIEW_ENABLED version=0.1.0',
    })
    expect(await realpath(join(home, 'profiles', 'node_modules', ...PREVIEW_PLUGIN_NAME.split('/'))))
      .toBe(await realpath(pluginRoot))
  })

  it('fails closed when disabled, missing, or version-incompatible', async () => {
    const root = await temporaryRoot()
    const home = join(root, 'home')
    expect(resolvePreviewPlugin(root, home, true)).toEqual({ enabled: false, diagnostic: 'PREVIEW_DISABLED' })
    expect(resolvePreviewPlugin(root, home, false)).toEqual({
      enabled: false,
      diagnostic: 'PREVIEW_UNAVAILABLE reason=package-missing',
    })
    await createPlugin(root, '0.2.0')
    expect(resolvePreviewPlugin(root, home, false)).toEqual({
      enabled: false,
      diagnostic: 'PREVIEW_UNAVAILABLE reason=manifest-invalid',
    })

    const staleRoot = await temporaryRoot()
    const stalePlugin = await createPlugin(staleRoot)
    const staleManifestPath = join(stalePlugin, 'package.json')
    const staleManifest = JSON.parse(await readFile(staleManifestPath, 'utf8'))
    staleManifest.peerDependencies['@deepseek-ai/dsh-client-runtime'] = '0.1.0-rc.8'
    await writeFile(staleManifestPath, JSON.stringify(staleManifest))
    expect(resolvePreviewPlugin(staleRoot, home, false)).toEqual({
      enabled: false,
      diagnostic: 'PREVIEW_UNAVAILABLE reason=manifest-invalid',
    })
  })

  it('keeps file reads inside the workspace and hides sensitive paths', async () => {
    const root = await temporaryRoot()
    const workspace = join(root, 'workspace')
    const outside = join(root, 'outside.txt')
    await mkdir(join(workspace, 'src'), { recursive: true })
    await mkdir(join(workspace, 'node_modules'), { recursive: true })
    await writeFile(join(workspace, 'src', 'index.ts'), 'export const answer = 42\n')
    await writeFile(join(workspace, '.env'), 'TOKEN=secret\n')
    await writeFile(outside, 'outside\n')
    await symlink(outside, join(workspace, 'escape.txt'))

    expect(isBlockedPreviewPath('.env.local')).toBe(true)
    expect(isBlockedPreviewPath('node_modules/pkg/index.js')).toBe(true)
    expect((await listPreviewDirectory(workspace, '')).map(entry => entry.name)).toEqual(['src'])
    await expect(resolvePreviewPath(workspace, '../outside.txt')).rejects.toThrow(/invalid segment/u)
    await expect(resolvePreviewPath(workspace, 'escape.txt')).rejects.toThrow(/escapes/u)
    await expect(readPreviewFile(workspace, '.env')).rejects.toThrow(/blocked/u)
    await expect(readPreviewFile(workspace, 'src/index.ts')).resolves.toMatchObject({
      language: 'typescript',
      content: 'export const answer = 42\n',
    })
  })

  it('serves only token-bound static assets and expires capabilities', async () => {
    const root = await temporaryRoot()
    await writeFile(join(root, 'index.html'), '<h1>Preview</h1>')
    await writeFile(join(root, 'app.js'), 'document.body.dataset.ready = "1"')
    const capabilities = new PreviewCapabilities()
    const capability = await capabilities.create(root, 'index.html', 100)

    await expect(resolveCapabilityAsset(capability, 'app.js')).resolves.toMatchObject({
      contentType: 'text/javascript; charset=utf-8',
    })
    await expect(resolveCapabilityAsset(capability, 'client/route')).resolves.toMatchObject({
      contentType: 'text/html; charset=utf-8',
    })
    expect(capabilities.get(capability.token, 101)).toBe(capability)
    expect(capabilities.get(capability.token, capability.expiresAt)).toBeUndefined()
  })
})
