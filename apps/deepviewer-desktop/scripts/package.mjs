import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = resolve(appRoot, '..', '..', 'out')
const expectedHarnessCommit = '47f943859bef60e4160492346772ded9b24f765a'
const expectedHarnessVersion = '0.1.0-rc.5'
const architectureOption = process.argv.find(argument => argument.startsWith('--arch='))?.slice('--arch='.length)
if (architectureOption !== undefined && architectureOption !== 'arm64' && architectureOption !== 'x64') {
  throw new Error(`unsupported macOS architecture: ${architectureOption}`)
}
const architectures = architectureOption === undefined ? ['arm64', 'x64'] : [architectureOption]
await mkdir(outputRoot, { recursive: true })

function cachedElectronZipDirectory(arch) {
  const filename = `electron-v43.4.0-darwin-${arch}.zip`
  const cacheRoot = join(homedir(), 'Library', 'Caches', 'electron')
  if (!existsSync(cacheRoot)) return undefined
  for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = join(cacheRoot, entry.name, filename)
    if (existsSync(candidate)) return dirname(candidate)
  }
  return undefined
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} failed with code=${String(code)} signal=${String(signal)}`))
    })
  })
}

for (const arch of architectures) {
  const runtimeRoot = resolve(appRoot, '..', '..', '.runtime', arch, 'harness')
  const runtimeManifest = JSON.parse(await readFile(join(runtimeRoot, 'deepviewer-runtime.json'), 'utf8'))
  if (
    runtimeManifest.platform !== 'darwin'
    || runtimeManifest.arch !== arch
    || runtimeManifest.upstreamCommit !== expectedHarnessCommit
    || runtimeManifest.harnessVersion !== expectedHarnessVersion
  ) {
    throw new Error(`runtime manifest mismatch for ${arch}: ${JSON.stringify(runtimeManifest)}`)
  }

  const electronZipDir = cachedElectronZipDirectory(arch)
  const paths = await packager({
    dir: appRoot,
    out: outputRoot,
    overwrite: true,
    platform: 'darwin',
    arch,
    electronVersion: '43.4.0',
    ...(electronZipDir === undefined ? {} : { electronZipDir }),
    name: 'DeepViewer',
    executableName: 'DeepViewer',
    appBundleId: 'com.deepviewer.desktop',
    appVersion: '0.0.1',
    asar: true,
    extraResource: [runtimeRoot],
    prune: false,
    ignore: [
      /^\/node_modules(?:\/|$)/u,
      /^\/src(?:\/|$)/u,
      /^\/test(?:\/|$)/u,
      /^\/scripts(?:\/|$)/u,
      /^\/vite\..*\.config\.ts$/u,
      /^\/vitest\.config\.ts$/u,
      /^\/tsconfig\.json$/u,
    ],
  })
  const appPath = paths[0]
  if (appPath === undefined) throw new Error(`Electron Packager returned no ${arch} application path`)
  const dmgPath = resolve(outputRoot, `DeepViewer-0.0.1-macos-${arch}.dmg`)
  await run('hdiutil', [
    'create',
    '-volname', 'DeepViewer',
    '-srcfolder', appPath,
    '-ov',
    '-format', 'UDZO',
    dmgPath,
  ])
  process.stdout.write(`${appPath}\n${dmgPath}\n`)
}
