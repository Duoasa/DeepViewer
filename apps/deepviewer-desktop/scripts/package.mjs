import { existsSync, readdirSync } from 'node:fs'
import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'
import { auditPackagedApp } from './release-audit.mjs'
import {
  createOsxSignOptions,
  resolveDeveloperIdApplication,
  signDiskImage,
  verifySignedApp,
  verifySignedDiskImage,
} from './macos-signing.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const outputRoot = resolve(projectRoot, 'out')
const releaseStagingRoot = resolve(outputRoot, '.release-staging')
const appIcon = resolve(appRoot, 'assets', 'DeepViewer.icns')
const appManifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8'))
const appVersion = appManifest.version
if (typeof appVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(appVersion)) {
  throw new Error(`invalid DeepViewer package version: ${String(appVersion)}`)
}
const expectedHarnessCommit = '47f943859bef60e4160492346772ded9b24f765a'
const expectedHarnessVersion = '0.1.0-rc.5'
const shouldSign = process.argv.includes('--sign')
const architectureOption = process.argv.find(argument => argument.startsWith('--arch='))?.slice('--arch='.length)
if (architectureOption !== undefined && architectureOption !== 'arm64' && architectureOption !== 'x64') {
  throw new Error(`unsupported macOS architecture: ${architectureOption}`)
}
const architectures = architectureOption === undefined ? ['arm64', 'x64'] : [architectureOption]
const signingKeychain = process.env.DEEPVIEWER_CODESIGN_KEYCHAIN
const signingIdentity = shouldSign
  ? await resolveDeveloperIdApplication({
      requestedIdentity: process.env.DEEPVIEWER_CODESIGN_IDENTITY,
      keychain: signingKeychain,
    })
  : undefined
await mkdir(outputRoot, { recursive: true })
if (!existsSync(appIcon)) throw new Error(`missing macOS app icon: ${appIcon}`)

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
  const appOutputRoot = resolve(outputRoot, `DeepViewer-darwin-${arch}`)
  const dmgPath = resolve(outputRoot, `DeepViewer-${appVersion}-macos-${arch}.dmg`)
  const stagingAppRoot = resolve(releaseStagingRoot, arch, 'app')
  await rm(stagingAppRoot, { recursive: true, force: true })
  await rm(appOutputRoot, { recursive: true, force: true })
  await rm(dmgPath, { force: true })
  await mkdir(stagingAppRoot, { recursive: true })
  await cp(resolve(appRoot, '.desktop'), resolve(stagingAppRoot, '.desktop'), { recursive: true })
  await cp(resolve(appRoot, 'assets'), resolve(stagingAppRoot, 'assets'), { recursive: true })
  await cp(resolve(appRoot, 'package.json'), resolve(stagingAppRoot, 'package.json'))
  const runtimeManifest = JSON.parse(await readFile(join(runtimeRoot, 'deepviewer-runtime.json'), 'utf8'))
  if (
    runtimeManifest.platform !== 'darwin'
    || runtimeManifest.arch !== arch
    || runtimeManifest.upstreamCommit !== expectedHarnessCommit
    || runtimeManifest.harnessVersion !== expectedHarnessVersion
    || runtimeManifest.deepviewerVersion !== appVersion
  ) {
    throw new Error(`runtime manifest mismatch for ${arch}: ${JSON.stringify(runtimeManifest)}`)
  }

  const electronZipDir = cachedElectronZipDirectory(arch)
  const paths = await packager({
    dir: stagingAppRoot,
    out: outputRoot,
    overwrite: true,
    platform: 'darwin',
    arch,
    electronVersion: '43.4.0',
    ...(electronZipDir === undefined ? {} : { electronZipDir }),
    name: 'DeepViewer',
    executableName: 'DeepViewer',
    icon: appIcon,
    appBundleId: 'com.deepviewer.desktop',
    appVersion,
    asar: true,
    extraResource: [runtimeRoot],
    prune: false,
    ...(signingIdentity === undefined ? {} : {
      osxSign: createOsxSignOptions({ identity: signingIdentity, keychain: signingKeychain }),
    }),
  })
  const packagedOutputRoot = paths[0]
  if (packagedOutputRoot === undefined) throw new Error(`Electron Packager returned no ${arch} output path`)
  const appPath = resolve(packagedOutputRoot, 'DeepViewer.app')
  await auditPackagedApp({ appPath, projectRoot })
  if (signingIdentity !== undefined) {
    const verified = await verifySignedApp(appPath)
    process.stdout.write(`Developer ID application signature verified for ${arch}: ${verified.machoCount} Mach-O files\n`)
  }
  await run('hdiutil', [
    'create',
    '-volname', 'DeepViewer',
    '-srcfolder', packagedOutputRoot,
    '-ov',
    '-format', 'UDZO',
    dmgPath,
  ])
  if (signingIdentity !== undefined) {
    await signDiskImage({
      dmgPath,
      identity: signingIdentity,
      arch,
      keychain: signingKeychain,
    })
    await verifySignedDiskImage(dmgPath)
    process.stdout.write(`Developer ID disk image signature verified for ${arch}\n`)
  }
  process.stdout.write(`${appPath}\n${dmgPath}\n`)
}
