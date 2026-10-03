import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error The packaging helper is deliberately plain Node ESM.
import { normalizeNativePackageMetadata } from '../scripts/native-package-metadata.mjs'

const builderRequire = createRequire(new URL('../../../upstream/deepseek-harness/apps/desktop/package.json', import.meta.url))
const { createTransformer } = builderRequire('app-builder-lib/out/fileTransformer.js')
const { transformFiles } = builderRequire('app-builder-lib/out/util/appFileCopier.js')
const { AsarPackager } = builderRequire('app-builder-lib/out/asar/asarUtil.js')
const { writeDesktopRuntime } = await import(new URL('../../../upstream/deepseek-harness/apps/desktop/src/runtime-tree.ts', import.meta.url).href)
const { verifyRuntimeArchive } = await import(new URL('../../../upstream/deepseek-harness/apps/desktop/scripts/verify-runtime-archive.ts', import.meta.url).href)
const fixtures: string[] = []
afterEach(async () => {
  for (const path of fixtures.splice(0)) await rm(path, { recursive: true, force: true })
})

async function put(root: string, path: string, content: string) {
  const file = join(root, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'deepviewer-package-metadata-'))
  fixtures.push(root)
  const app = join(root, 'app'), runtime = join(app, 'dsh'), resources = join(root, 'resources')
  const manifest = {
    name: 'metadata-fixture', version: '1.0.0', license: 'MIT', author: 'Public Authors',
    main: './index.js', exports: { '.': './index.js', './feature': './feature.js' },
    imports: { '#feature': './feature.js' }, bin: { fixture: './index.js' },
    dependencies: { 'nested-dependency': '2.0.0' }, optionalDependencies: { 'optional-fixture': '3.0.0' },
    peerDependencies: { 'peer-fixture': '^4' }, type: 'module', engines: { node: '>=22' },
    scripts: { test: 'example-test' }, keywords: ['example'], build: { example: true },
    gitHead: 'public-source-commit', bugs: 'https://example.invalid/bugs', _where: 'published metadata',
  }
  await put(app, 'package.json', JSON.stringify({ name: 'staged-app', build: { preserve: true } }) + '\n')
  await put(app, 'dsh/package.json', JSON.stringify({ name: 'staged-runtime', scripts: { preserve: 'true' } }) + '\n')
  await put(runtime, 'node_modules/metadata-fixture/package.json', JSON.stringify(manifest, null, 2) + '\n')
  await put(runtime, 'node_modules/metadata-fixture/LICENSE', 'MIT License\nCopyright Public Authors\n')
  await put(runtime, 'node_modules/metadata-fixture/index.js', 'export default 1;\n')
  await put(runtime, 'node_modules/metadata-fixture/feature.js', 'export const feature = true;\n')
  await put(runtime, 'node_modules/metadata-fixture/node_modules/nested-dependency/package.json', JSON.stringify({ name: 'nested-dependency', version: '2.0.0', license: 'Apache-2.0', scripts: { build: 'example' } }))
  await mkdir(resources)
  return { root, app, runtime, resources, manifest }
}

async function archiveWithBuilder(f: Awaited<ReturnType<typeof fixture>>) {
  const files: string[] = []
  const visit = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else files.push(path)
    }
  }
  await visit(f.app)
  const destination = join(f.resources, 'app')
  const metadata = new Map(await Promise.all(files.map(async file => [file, await lstat(file)] as const)))
  const fileSet = { src: f.app, destination, files, metadata }
  await transformFiles(createTransformer(f.app, {}, undefined, null), fileSet)
  await new AsarPackager({ info: { getWorkspaceRoot: async () => f.root } }, {
    defaultDestination: destination, resourcePath: f.resources, options: { smartUnpack: false },
  }).pack([fileSet])
  return join(f.resources, 'app.asar')
}

describe('native sealed package metadata', () => {
  it('uses the real transformer, preserves licenses and runtime references, and is idempotent', async () => {
    const f = await fixture()
    const originalApp = await readFile(join(f.app, 'package.json'))
    const originalRuntime = await readFile(join(f.runtime, 'package.json'))
    expect(await normalizeNativePackageMetadata(f.app)).toEqual({ packageManifests: 2, normalizedManifests: 2 })
    const path = join(f.runtime, 'node_modules/metadata-fixture/package.json')
    const actual = JSON.parse(await readFile(path, 'utf8'))
    for (const field of ['license', 'author', 'main', 'exports', 'imports', 'bin', 'dependencies', 'optionalDependencies', 'peerDependencies', 'type', 'engines']) {
      expect(actual[field]).toEqual(f.manifest[field as keyof typeof f.manifest])
    }
    for (const field of ['scripts', 'keywords', 'build', 'gitHead', 'bugs', '_where']) expect(actual).not.toHaveProperty(field)
    expect(await readFile(join(f.runtime, 'node_modules/metadata-fixture/LICENSE'), 'utf8')).toBe('MIT License\nCopyright Public Authors\n')
    expect(await readFile(join(f.runtime, 'node_modules/metadata-fixture/index.js'), 'utf8')).toBe('export default 1;\n')
    expect(await readFile(join(f.app, 'package.json'))).toEqual(originalApp)
    expect(await readFile(join(f.runtime, 'package.json'))).toEqual(originalRuntime)
    expect(await createTransformer(f.app, {}, undefined, null)(path)).toBeNull()
    expect(await normalizeNativePackageMetadata(f.app)).toEqual({ packageManifests: 2, normalizedManifests: 0 })
  })

  it('supports the same builder configuration while retaining mandatory cleanup', async () => {
    const f = await fixture()
    const configuration = { removePackageScripts: false, removePackageKeywords: false }
    await normalizeNativePackageMetadata(f.app, { createTransformer, configuration })
    const actual = JSON.parse(await readFile(join(f.runtime, 'node_modules/metadata-fixture/package.json'), 'utf8'))
    expect(actual.scripts).toEqual(f.manifest.scripts)
    expect(actual.keywords).toEqual(f.manifest.keywords)
    expect(actual).not.toHaveProperty('build')
  })

  it('fails closed on malformed manifests, swallowed transformer failures and repeated changes', async () => {
    const f = await fixture()
    const path = join(f.runtime, 'node_modules/metadata-fixture/package.json')
    await writeFile(path, '{broken')
    await expect(normalizeNativePackageMetadata(f.app)).rejects.toThrow('invalid dependency manifest')
    await writeFile(path, JSON.stringify(f.manifest))
    await expect(normalizeNativePackageMetadata(f.app, { createTransformer: () => () => undefined })).rejects.toThrow('transformer failed')
    await expect(normalizeNativePackageMetadata(f.app, { createTransformer: () => () => '{}' })).rejects.toThrow('not idempotent')
  })

  it('rejects runtime links and roots outside the app', async () => {
    const f = await fixture()
    await symlink('../metadata-fixture/package.json', join(f.runtime, 'node_modules/package-link'))
    await expect(normalizeNativePackageMetadata(f.app)).rejects.toThrow('unsupported filesystem entry')
    await expect(normalizeNativePackageMetadata(f.app, { runtimeRoot: f.root })).rejects.toThrow('contained in the staged app')
  })

  it('matches a sealed runtime through the real builder ASAR transformation and detects later tampering', async () => {
    const f = await fixture()
    await normalizeNativePackageMetadata(f.app)
    const descriptor = writeDesktopRuntime(f.runtime, {
      schemaVersion: 1, version: '0.2.0-rc.2', hostProtocolVersion: 4, nodeVersion: '22.20.0', pnpmVersion: '11.7.0',
    }, [], { platform: 'darwin', arch: 'arm64' })
    await expect(verifyRuntimeArchive(await archiveWithBuilder(f), descriptor)).resolves.toBeUndefined()
    await put(f.runtime, 'node_modules/metadata-fixture/index.js', 'export default 2;\n')
    await expect(verifyRuntimeArchive(await archiveWithBuilder(f), descriptor)).rejects.toThrow('ASAR integrity verification failed')
  })
})
