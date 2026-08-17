import { execFileSync, spawn } from 'node:child_process'
import { chmodSync, existsSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdir, readdir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { downloadArtifact } from '@electron/get'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const upstreamRoot = resolve(projectRoot, 'upstream', 'deepseek-harness')
const packRoots = [
  resolve(upstreamRoot, 'dist', 'deepviewer', 'vendor'),
  resolve(upstreamRoot, 'dist', 'deepviewer', 'dsh'),
]
const electronVersion = '43.4.0'
const expectedHarnessCommit = '47f943859bef60e4160492346772ded9b24f765a'
const expectedHarnessVersion = '0.1.0-rc.5'
const deepviewerVersion = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')).version
if (typeof deepviewerVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(deepviewerVersion)) {
  throw new Error(`invalid DeepViewer package version: ${String(deepviewerVersion)}`)
}
const architectureOption = process.argv.find(argument => argument.startsWith('--arch='))?.slice('--arch='.length)
if (architectureOption !== undefined && architectureOption !== 'arm64' && architectureOption !== 'x64') {
  throw new Error(`unsupported macOS architecture: ${architectureOption}`)
}
const architectures = architectureOption === undefined ? ['arm64', 'x64'] : [architectureOption]
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
  return { name: manifest.name, version: manifest.version }
}

function packedDependencies() {
  const dependencies = new Map()
  for (const packRoot of packRoots) {
    if (!existsSync(packRoot)) {
      throw new Error(`Harness tarballs are missing at ${packRoot}; build and release-pack the pinned upstream checkout first`)
    }
    const tarballs = readdirSync(packRoot)
      .filter(name => name.endsWith('.tgz'))
      .sort()
    if (tarballs.length === 0) throw new Error(`no Harness tarballs found at ${packRoot}`)
    for (const filename of tarballs) {
      const tarball = join(packRoot, filename)
      const identity = packedIdentity(tarball)
      dependencies.set(identity.name, tarball)
    }
  }
  if (!dependencies.has('@deepseek-ai/dsh')) throw new Error('packed Harness CLI is missing')
  return dependencies
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

function cachedElectronArchive(arch) {
  const filename = `electron-v${electronVersion}-darwin-${arch}.zip`
  const cacheRoot = join(homedir(), 'Library', 'Caches', 'electron')
  if (!existsSync(cacheRoot)) return undefined
  for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = join(cacheRoot, entry.name, filename)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

async function installRuntimeDependencies(runtimeRoot, arch, args, baseEnvironment) {
  if (arch === process.arch) {
    await run('pnpm', args, { cwd: runtimeRoot, env: baseEnvironment })
    return
  }
  if (process.platform !== 'darwin' || process.arch !== 'arm64' || arch !== 'x64') {
    throw new Error(`cannot build darwin-${arch} dependencies from ${process.platform}-${process.arch}`)
  }

  const toolchainRoot = resolve(projectRoot, '.runtime', 'toolchains', `electron-v${electronVersion}-darwin-x64`)
  const unpackedElectronExecutable = join(toolchainRoot, 'Electron.app', 'Contents', 'MacOS', 'Electron')
  const packagedElectronExecutable = resolve(projectRoot, 'out', 'DeepViewer-darwin-x64', 'DeepViewer.app', 'Contents', 'MacOS', 'DeepViewer')
  let electronExecutable = existsSync(packagedElectronExecutable) ? packagedElectronExecutable : unpackedElectronExecutable
  const nodeExecutable = join(toolchainRoot, 'bin', 'node')
  if (!existsSync(electronExecutable)) {
    const archive = cachedElectronArchive('x64') ?? await downloadArtifact({
        version: electronVersion,
        artifactName: 'electron',
        platform: 'darwin',
        arch: 'x64',
      })
    rmSync(toolchainRoot, { recursive: true, force: true })
    await mkdir(toolchainRoot, { recursive: true })
    await run('ditto', ['-x', '-k', archive, toolchainRoot])
    electronExecutable = unpackedElectronExecutable
  }
  await mkdir(dirname(nodeExecutable), { recursive: true })
  rmSync(nodeExecutable, { force: true })
  symlinkSync(electronExecutable, nodeExecutable)

  const pnpmEntry = resolve(projectRoot, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
  if (!existsSync(pnpmEntry)) throw new Error(`pnpm runtime entry is missing at ${pnpmEntry}`)
  await run(nodeExecutable, [pnpmEntry, ...args], {
    cwd: runtimeRoot,
    env: {
      ...baseEnvironment,
      ELECTRON_RUN_AS_NODE: '1',
      PATH: `${dirname(nodeExecutable)}:${baseEnvironment.PATH ?? ''}`,
    },
  })
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
  const expected = arch === 'arm64' ? 'arm64' : 'x86_64'
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

const dependencies = packedDependencies()
const upstreamCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstreamRoot, encoding: 'utf8' }).trim()
if (upstreamCommit !== expectedHarnessCommit) {
  throw new Error(`Harness checkout is ${upstreamCommit}; expected pinned commit ${expectedHarnessCommit}`)
}

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
    harnessVersion: expectedHarnessVersion,
    deepviewerVersion,
    packageCount: dependencies.size,
    verifiedNativeModules,
  }, null, 2)}\n`)
  sanitizeReleaseBuildPaths(runtimeRoot)
  process.stdout.write(`DeepViewer Harness runtime ready: ${runtimeRoot}\n`)
}
