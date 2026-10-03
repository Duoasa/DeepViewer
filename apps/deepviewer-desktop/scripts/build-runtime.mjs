import { stageBetterSidebar, validateBetterSidebar, betterSidebarName, betterSidebarVersion } from './stage-better-sidebar.mjs'
import { buildModelCapabilitiesPlugin, modelCapabilitiesPluginName, modelCapabilitiesPluginVersion } from './build-model-capabilities-plugin.mjs'
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { mkdir, readdir, realpath } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import {
  adaptSubscriptionsPlugin,
  SUBSCRIPTIONS_DSH_PEER_VERSION,
  SUBSCRIPTIONS_UI_ADAPTER_ID,
} from './adapt-subscriptions-plugin.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const upstreamRoot = resolve(projectRoot, 'upstream', 'deepseek-harness')
const packRoots = [
  resolve(upstreamRoot, 'dist', 'deepviewer', 'vendor'),
  resolve(upstreamRoot, 'dist', 'deepviewer', 'dsh'),
]
const expectedHarnessCommit = '477b4f420553e8a52c2fbccc464d7561b239c443'
const expectedHarnessVersion = '0.1.7-rc.2'
const subscriptionsPluginName = 'dsh-plugin-subscriptions'
const subscriptionsPluginVersion = '0.3.1'
const appManifest = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
const deepviewerVersion = appManifest.version
if (typeof deepviewerVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(deepviewerVersion)) {
  throw new Error(`invalid DeepViewer package version: ${String(deepviewerVersion)}`)
}
if (appManifest.dependencies?.[subscriptionsPluginName] !== subscriptionsPluginVersion) {
  throw new Error(`${subscriptionsPluginName} must be pinned to ${subscriptionsPluginVersion}`)
}
const architectureOption = process.argv.find(argument => argument.startsWith('--arch='))?.slice('--arch='.length)
if (architectureOption !== undefined && architectureOption !== 'arm64') {
  throw new Error(`unsupported macOS architecture: ${architectureOption}`)
}
const architectures = architectureOption === undefined ? ['arm64'] : [architectureOption]
const allowedBuildPackages = [
  '@google/genai',
  'esbuild',
  'koffi',
  'node-pty',
  'protobufjs',
]

function tarEntry(buffer, wantedPath) {
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/u, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/u, '')
    const path = prefix === '' ? name : `${prefix}/${name}`
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/u, '').trim()
    const size = Number.parseInt(sizeText || '0', 8)
    const contentOffset = offset + 512
    if (path === wantedPath) return buffer.subarray(contentOffset, contentOffset + size)
    offset = contentOffset + Math.ceil(size / 512) * 512
  }
  throw new Error(`${wantedPath} is missing from npm tarball`)
}

function packedIdentity(tarball) {
  const archive = gunzipSync(readFileSync(tarball))
  const manifest = JSON.parse(tarEntry(archive, 'package/package.json').toString('utf8'))
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
    throw new Error(`invalid npm package identity in ${tarball}`)
  }
  // A source-tree boot cannot detect a YAML overlay omitted from npm's files list.
  const declaredPatches = manifest.dsh?.bundle?.patch
  for (const patch of typeof declaredPatches === 'string' ? [declaredPatches] : Array.isArray(declaredPatches) ? declaredPatches : []) {
    if (typeof patch !== 'string' || patch.startsWith('/') || patch.split('/').includes('..')) throw new Error(`Invalid bundle patch in ${manifest.name}`)
    tarEntry(archive, `package/${patch.replace(/^\.\//u, '')}`)
  }
  return { name: manifest.name, version: manifest.version }
}

function packedDependencies() {
  const dependencies = new Map()
  for (const packRoot of packRoots) {
    if (!existsSync(packRoot)) {
      throw new Error(`Harness tarballs are missing at ${packRoot}; build and release-pack the pinned upstream checkout first`)
    }
    // Consume only the current release-pack manifest, never stale/cloud-conflict
    // copies that may coexist in the output directory.
    const tarballs = readFileSync(join(packRoot, 'publish-order.txt'), 'utf8')
      .split('\n').map(name => name.trim()).filter(Boolean)
    if (new Set(tarballs).size !== tarballs.length
      || tarballs.some(name => !/^[A-Za-z0-9._-]+\.tgz$/u.test(name))) {
      throw new Error(`invalid release-pack manifest at ${packRoot}`)
    }
    if (tarballs.length === 0) throw new Error(`no Harness tarballs found at ${packRoot}`)
    for (const filename of tarballs) {
      const tarball = join(packRoot, filename)
      const identity = packedIdentity(tarball)
      if (dependencies.has(identity.name)) throw new Error(`duplicate packed dependency: ${identity.name}`)
      dependencies.set(identity.name, tarball)
    }
  }
  if (!dependencies.has('@deepseek-ai/dsh')) throw new Error('packed Harness CLI is missing')
  return dependencies
}

function packSubscriptionsPlugin() {
  const sourceRoot = resolve(upstreamRoot, 'node_modules', subscriptionsPluginName)
  const manifestPath = join(sourceRoot, 'package.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`${subscriptionsPluginName} is missing; run pnpm install first`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    manifest.name !== subscriptionsPluginName
    || manifest.version !== subscriptionsPluginVersion
    || manifest.license !== 'MIT'
    || manifest.dsh?.bundle?.patch !== './cordis.patch.yml'
    || manifest.dsh?.client?.platform !== 'web'
  ) {
    throw new Error(`invalid ${subscriptionsPluginName}@${subscriptionsPluginVersion} package`)
  }

  const destination = resolve(projectRoot, '.runtime', 'inputs', `${subscriptionsPluginName}-${subscriptionsPluginVersion}`)
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  execFileSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: sourceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const tarballs = readdirSync(destination)
    .filter(name => name.endsWith('.tgz'))
    .map(name => join(destination, name))
  if (tarballs.length !== 1) {
    throw new Error(`expected one packed ${subscriptionsPluginName} tarball, found ${String(tarballs.length)}`)
  }
  const identity = packedIdentity(tarballs[0])
  if (identity.name !== subscriptionsPluginName || identity.version !== subscriptionsPluginVersion) {
    throw new Error(`packed subscriptions plugin identity mismatch: ${identity.name}@${identity.version}`)
  }
  return tarballs[0]
}

function sanitizeSubscriptionsPlugin(runtimeRoot) {
  const pluginRoot = join(runtimeRoot, 'node_modules', subscriptionsPluginName)
  const manifestPath = join(pluginRoot, 'package.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`installed ${subscriptionsPluginName} is missing from the Runtime`)
  }
  adaptSubscriptionsPlugin(pluginRoot)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    manifest.name !== subscriptionsPluginName
    || manifest.version !== subscriptionsPluginVersion
    || manifest.license !== 'MIT'
    || !existsSync(join(pluginRoot, 'LICENSE'))
  ) {
    throw new Error(`installed ${subscriptionsPluginName} metadata is invalid`)
  }
  delete manifest.devDependencies
  delete manifest.scripts
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return {
    name: subscriptionsPluginName,
    version: subscriptionsPluginVersion,
    license: 'MIT',
    adapter: SUBSCRIPTIONS_UI_ADAPTER_ID,
    dshPeerVersion: SUBSCRIPTIONS_DSH_PEER_VERSION,
  }
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} failed with code=${String(code)} signal=${String(signal)}`))
    })
  })
}

async function installRuntimeDependencies(runtimeRoot, arch, args, baseEnvironment) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64' || arch !== 'arm64') {
    throw new Error('DeepViewer Runtime requires a native macOS arm64 build host')
  }
  await run('pnpm', args, { cwd: runtimeRoot, env: baseEnvironment })
}

async function verifyContainedLinks(root) {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        const target = await realpath(path)
        if (target !== root && !target.startsWith(`${root}${sep}`)) {
          throw new Error(`runtime symlink escapes its package boundary: ${path} -> ${target}`)
        }
      } else if (entry.isDirectory()) {
        await visit(path)
      }
    }
  }
  await visit(root)
}

function verifySelectedNativeBinary(path, arch) {
  const description = execFileSync('file', ['-b', path], { encoding: 'utf8' }).trim()
  const expected = 'arm64'
  if (!description.includes(expected)) {
    throw new Error(`native module does not include ${expected}: ${path} (${description})`)
  }
  return description
}

const releaseTextExtensions = new Set([
  '', '.cjs', '.css', '.html', '.js', '.json', '.map', '.md', '.mjs',
  '.sh', '.toml', '.ts', '.txt', '.xml', '.yaml', '.yml',
])

function sanitizeReleaseBuildPaths(runtimeRoot) {
  const metadataRoot = join(runtimeRoot, 'node_modules')
  for (const name of ['.modules.yaml', '.package-map.json', '.pnpm-workspace-state-v1.json', '.pnpm']) {
    rmSync(join(metadataRoot, name), { recursive: true, force: true })
  }

  const replacements = [
    [projectRoot, '/__DEEPVIEWER_SOURCE__'],
    [homedir(), '/__DEEPVIEWER_HOME__'],
  ].sort(([left], [right]) => right.length - left.length)

  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        visit(path)
        continue
      }
      if (!entry.isFile() || !releaseTextExtensions.has(extname(entry.name).toLowerCase())) continue
      const buffer = readFileSync(path)
      if (buffer.length > 8 * 1024 * 1024 || buffer.subarray(0, 8192).includes(0)) continue
      const original = buffer.toString('utf8')
      const sanitized = replacements.reduce(
        (value, [needle, replacement]) => value.replaceAll(needle, replacement),
        original,
      )
      if (sanitized !== original) writeFileSync(path, sanitized)
    }
  }

  visit(runtimeRoot)
}

function packModelCapabilitiesPlugin() {
  const source = buildModelCapabilitiesPlugin(upstreamRoot)
  const destination = resolve(projectRoot, `.runtime/inputs/deepviewer-model-capabilities-${modelCapabilitiesPluginVersion}`)
  rmSync(destination, { recursive: true, force: true }); mkdirSync(destination, { recursive: true })
  // Only package canonical build outputs; cloud-conflict copies in lib/ are not release inputs.
  const packageSource = join(destination, 'package-source')
  mkdirSync(join(packageSource, 'lib'), { recursive: true })
  for (const file of ['package.json', 'LICENSE', 'UPSTREAM.md', 'cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/client.js.map']) {
    cpSync(join(source, file), join(packageSource, file))
  }
  execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', destination], { cwd: packageSource, stdio: ['ignore', 'pipe', 'pipe'] })
  const files = readdirSync(destination).filter(name => name.endsWith('.tgz'))
  if (files.length !== 1) throw new Error('Expected one model capabilities plugin tarball')
  const tarball = join(destination, files[0])
  if (packedIdentity(tarball).name !== modelCapabilitiesPluginName) throw new Error('Model capabilities plugin identity mismatch')
  return tarball
}

function packBetterSidebar() {
  const source = stageBetterSidebar(upstreamRoot)
  const destination = resolve(projectRoot, '.runtime/inputs', `${betterSidebarName}-${betterSidebarVersion}`)
  mkdirSync(destination, { recursive: true })
  const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: source, encoding: 'utf8' }))
  const tarball = join(destination, result[0].filename)
  const identity = packedIdentity(tarball)
  if (identity.name !== betterSidebarName || identity.version !== betterSidebarVersion) throw new Error('Better Sidebar tarball mismatch')
  return tarball
}

const localSnapshot = process.argv.includes('--local-snapshot')
const upstreamCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstreamRoot, encoding: 'utf8' }).trim()
const sourceVersion = JSON.parse(readFileSync(join(upstreamRoot, 'package.json'), 'utf8')).version
if (sourceVersion !== expectedHarnessVersion) throw new Error('Harness source version mismatch')
if (upstreamCommit !== expectedHarnessCommit) {
  if (!localSnapshot) throw new Error(`Harness checkout is ${upstreamCommit}; expected pinned commit ${expectedHarnessCommit}`)
  execFileSync('git', ['merge-base', '--is-ancestor', expectedHarnessCommit, upstreamCommit], { cwd: upstreamRoot })
}
const dependencies = packedDependencies()
dependencies.set(subscriptionsPluginName, packSubscriptionsPlugin())
dependencies.set(modelCapabilitiesPluginName, packModelCapabilitiesPlugin())
dependencies.set(betterSidebarName, packBetterSidebar())
const sourceSnapshot = localSnapshot ? {
  kind: 'local-development', baseCommit: expectedHarnessCommit, headCommit: upstreamCommit,
  packages: Object.fromEntries([...dependencies].sort(([a], [b]) => a.localeCompare(b)).map(([name, path]) => [name, createHash('sha256').update(readFileSync(path)).digest('hex')])),
} : undefined

for (const arch of architectures) {
  const runtimeRoot = resolve(projectRoot, '.runtime', arch, 'harness')
  rmSync(runtimeRoot, { recursive: true, force: true })
  await mkdir(runtimeRoot, { recursive: true })
  const packedSpecs = Object.fromEntries([...dependencies]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, tarball]) => [name, `file:${relative(runtimeRoot, tarball).replaceAll('\\', '/')}`]))
  writeFileSync(join(runtimeRoot, 'package.json'), `${JSON.stringify({
    name: `deepviewer-harness-runtime-${arch}`,
    version: deepviewerVersion,
    private: true,
    packageManager: 'pnpm@11.19.0',
    dependencies: packedSpecs,
  }, null, 2)}\n`)
  const skipKoffiInstall = arch !== process.arch
  writeFileSync(join(runtimeRoot, '.pnpmfile.cjs'), `'use strict'\nconst packedSpecs = ${JSON.stringify(packedSpecs, null, 2)}\nmodule.exports = {\n  hooks: {\n    readPackage(manifest) {\n      for (const field of ['dependencies', 'optionalDependencies']) {\n        const values = manifest[field]\n        if (values === undefined) continue\n        for (const name of Object.keys(values)) {\n          if (packedSpecs[name] !== undefined) values[name] = packedSpecs[name]\n        }\n      }\n      return manifest\n    },\n  },\n}\n`)

  const manuallyHandledBuild = `@deepseek-ai/dsh-subprocess-local@${packedSpecs['@deepseek-ai/dsh-subprocess-local']}`
  writeFileSync(join(runtimeRoot, 'pnpm-workspace.yaml'), `packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\nsupportedArchitectures:\n  os:\n    - darwin\n  cpu:\n    - ${arch}\nallowBuilds:\n${allowedBuildPackages.map(name => `  ${JSON.stringify(name)}: ${name === 'koffi' && skipKoffiInstall ? 'false' : 'true'}`).join('\n')}\n  ${JSON.stringify(manuallyHandledBuild)}: true\n`)

  await installRuntimeDependencies(runtimeRoot, arch, [
    'install',
    '--prod',
    '--no-frozen-lockfile',
  ], {
    ...process.env,
    npm_config_arch: arch,
    npm_config_platform: 'darwin',
    DSH_TELEMETRY_DISABLED: '1',
  })

  const packagedPlugins = [sanitizeSubscriptionsPlugin(runtimeRoot)]
  const sidebarManifest = validateBetterSidebar(join(runtimeRoot, "node_modules", betterSidebarName))
  if (sidebarManifest.deepviewerAdapter !== "deepviewer-dsh017-sidebar-management-v1") throw new Error("Better Sidebar runtime auth adapter missing")
  packagedPlugins.push({ name: betterSidebarName, version: betterSidebarVersion, license: "MIT" })
  for (const file of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'LICENSE']) {
    if (!existsSync(join(runtimeRoot, 'node_modules', modelCapabilitiesPluginName, file))) throw new Error('Model capabilities plugin runtime file missing: ' + file)
  }
  packagedPlugins.push({ name: modelCapabilitiesPluginName, version: modelCapabilitiesPluginVersion, license: 'MIT' })
  const entry = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!existsSync(entry)) throw new Error(`installed Harness entry is missing at ${entry}`)
  const spawnHelper = join(runtimeRoot, 'node_modules', 'node-pty', 'prebuilds', `darwin-${arch}`, 'spawn-helper')
  if (!existsSync(spawnHelper)) throw new Error(`node-pty spawn helper is missing at ${spawnHelper}`)
  chmodSync(spawnHelper, 0o755)
  if ((statSync(spawnHelper).mode & 0o111) === 0) throw new Error(`node-pty spawn helper is not executable: ${spawnHelper}`)
  await verifyContainedLinks(runtimeRoot)

  const requiredNativeFiles = [
    join(runtimeRoot, 'node_modules', 'node-pty', 'prebuilds', `darwin-${arch}`, 'pty.node'),
    join(runtimeRoot, 'node_modules', '@koromix', `koffi-darwin-${arch}`, `darwin_${arch}`, 'koffi.node'),
    // RC2 persistence now depends on the published POSIX flock binding.
    join(runtimeRoot, 'node_modules', '@deepseek-ai', `node-addon-system-darwin-${arch}`, 'bin', 'system.node'),
  ]
  for (const path of requiredNativeFiles) {
    if (!existsSync(path)) throw new Error(`required darwin-${arch} native module is missing: ${path}`)
  }
  const verifiedNativeModules = requiredNativeFiles.map(path => ({
    path: path.slice(runtimeRoot.length + 1),
    file: verifySelectedNativeBinary(path, arch),
  }))

  rmSync(join(runtimeRoot, '.pnpmfile.cjs'), { force: true })
  rmSync(join(runtimeRoot, 'pnpm-lock.yaml'), { force: true })
  rmSync(join(runtimeRoot, 'pnpm-workspace.yaml'), { force: true })
  writeFileSync(join(runtimeRoot, 'package.json'), `${JSON.stringify({
    name: `deepviewer-harness-runtime-${arch}`,
    version: deepviewerVersion,
    private: true,
  }, null, 2)}\n`)
  writeFileSync(join(runtimeRoot, 'deepviewer-runtime.json'), `${JSON.stringify({
    platform: 'darwin',
    arch,
    upstream: 'deepseek-ai/deepseek-harness',
    upstreamCommit,
    ...(sourceSnapshot ? { sourceSnapshot } : {}),
    harnessVersion: expectedHarnessVersion,
    deepviewerVersion,
    deepviewerBuildNumber: appManifest.buildNumber,
    packageCount: dependencies.size,
    plugins: packagedPlugins,
    verifiedNativeModules,
  }, null, 2)}\n`)
  sanitizeReleaseBuildPaths(runtimeRoot)
  process.stdout.write(`DeepViewer Harness runtime ready: ${runtimeRoot}\n`)
}
