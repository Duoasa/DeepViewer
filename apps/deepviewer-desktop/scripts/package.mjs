import { existsSync, readdirSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'
import { verifyRuntimeVersion, readRuntimeManifest } from './release-version.mjs'
import { auditPackagedApp, normalizeCopiedRuntimeSymlinks } from './release-audit.mjs'
import { compileNativeAppIcon } from './native-app-icon.mjs'
import {
  createOsxSignOptions,
  resolveDeveloperIdApplication,
  signDiskImage,
  verifySignedApp,
  verifySignedDiskImage,
} from './macos-signing.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const appManifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8'))
const electronVersion = appManifest.devDependencies.electron
const outputOption = process.argv.find(argument => argument.startsWith('--out='))?.slice('--out='.length)
const outputRoot = outputOption ? resolve(outputOption) : process.argv.includes('--freeze') ? resolve(projectRoot, 'out', appManifest.version) : resolve(projectRoot, 'out')
const releaseStagingRoot = resolve(outputRoot, '.release-staging')
const previewStagingRoot = resolve(outputRoot, '.preview-staging')
const nativeIcon = await compileNativeAppIcon(appRoot)
const appIcon = nativeIcon.icns
const rendererAssetPattern = /^[A-Za-z0-9._-]+\.(?:css|js|ttf|png)$/u
const fixedApplicationFiles = [
  '.desktop/build/main.js',
  '.desktop/build/preload.cjs',
  '.desktop/renderer/index.html',
  'assets/deepviewer-icon-macos26-1024.png',
  'assets/deepviewer-icon-dark-1024.png',
  'assets/licenses/Figtree-OFL.txt',
  'assets/licenses/ip-address-LICENSE.txt',
  'assets/licenses/ipaddr.js-LICENSE.txt',
  'assets/licenses/smart-buffer-LICENSE.txt',
  'assets/licenses/socks-LICENSE.txt',
]
const appVersion = appManifest.version
if (typeof appVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(appVersion)) {
  throw new Error(`invalid DeepViewer package version: ${String(appVersion)}`)
}
const appBuildNumber = appManifest.buildNumber
if (!Number.isSafeInteger(appBuildNumber) || appBuildNumber < 1) {
  throw new Error(`invalid DeepViewer build number: ${String(appBuildNumber)}`)
}
const appBuildVersion = String(appBuildNumber)
const expectedHarnessCommit = '477b4f420553e8a52c2fbccc464d7561b239c443'
const expectedHarnessVersion = '0.1.7-rc.2'
const expectedRuntimePlugins = [
  {
    name: 'dsh-plugin-subscriptions',
    version: '0.3.1',
    license: 'MIT',
    adapter: 'deepviewer-remaining-usage-dsh017-v1',
    dshPeerVersion: '0.1.7-rc.2',
  },
  { name: 'dsh-better-sidebar', version: '0.19.1', license: 'MIT' },
  { name: '@deepviewer/dsh-plugin-model-capabilities', version: '1.0.1', license: 'MIT' },
]
const shouldSign = process.argv.includes('--sign')
const isPreview = process.argv.includes('--preview')
const localSnapshot = process.argv.includes('--local-snapshot')
if (shouldSign && isPreview) throw new Error('--preview cannot be combined with --sign')
const architectureOption = process.argv.find(argument => argument.startsWith('--arch='))?.slice('--arch='.length)
if (architectureOption !== undefined && architectureOption !== 'arm64') {
  throw new Error(`unsupported macOS architecture: ${architectureOption}`)
}
if (isPreview && architectureOption !== undefined && architectureOption !== 'arm64') {
  throw new Error('DeepViewer Dev preview supports only arm64')
}
const architectures = isPreview
  ? ['arm64']
  : architectureOption === undefined ? ['arm64'] : [architectureOption]
const signingKeychain = process.env.DEEPVIEWER_CODESIGN_KEYCHAIN ?? process.env.DEEPVIEWER_CODESIGN_KEYCHAIN
const signingIdentity = shouldSign
  ? await resolveDeveloperIdApplication({
      requestedIdentity: process.env.DEEPVIEWER_CODESIGN_IDENTITY ?? process.env.DEEPVIEWER_CODESIGN_IDENTITY,
      keychain: signingKeychain,
    })
  : undefined
await mkdir(outputRoot, { recursive: true })

function cachedElectronZipDirectory(arch) {
  const filename = `electron-v${electronVersion}-darwin-${arch}.zip`
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

async function copyAllowlistedApplicationFiles(stagingAppRoot) {
  for (const relativePath of fixedApplicationFiles) {
    const destination = resolve(stagingAppRoot, relativePath)
    await mkdir(dirname(destination), { recursive: true })
    await cp(resolve(appRoot, relativePath), destination)
  }
  const rendererAssetsRoot = resolve(appRoot, '.desktop', 'renderer', 'assets')
  const rendererAssets = readdirSync(rendererAssetsRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && rendererAssetPattern.test(entry.name))
    .map(entry => entry.name)
    .sort()
  if (!rendererAssets.some(name => name.endsWith('.js'))
    || !rendererAssets.some(name => name.endsWith('.css'))
    || !rendererAssets.some(name => name.endsWith('.ttf'))) {
    throw new Error('allowlisted Renderer build is incomplete')
  }
  const destinationRoot = resolve(stagingAppRoot, '.desktop', 'renderer', 'assets')
  await mkdir(destinationRoot, { recursive: true })
  for (const name of rendererAssets) {
    await cp(resolve(rendererAssetsRoot, name), resolve(destinationRoot, name))
  }
}

for (const arch of architectures) {
  const packagedName = isPreview ? 'DeepViewer Dev' : 'DeepViewer'
  const outputName = packagedName.replaceAll(' ', '-')
  const runtimeRoot = resolve(appRoot, '..', '..', '.runtime', arch, 'harness')
  const appOutputRoot = resolve(outputRoot, `${outputName}-darwin-${arch}`)
  const dmgPath = resolve(outputRoot, `DeepViewer-${appVersion}-macos-${arch}.dmg`)
  const stagingAppRoot = resolve(isPreview ? previewStagingRoot : releaseStagingRoot, arch, 'app')
  await rm(stagingAppRoot, { recursive: true, force: true })
  await rm(appOutputRoot, { recursive: true, force: true })
  if (!isPreview) await rm(dmgPath, { force: true })
  await mkdir(stagingAppRoot, { recursive: true })
  await copyAllowlistedApplicationFiles(stagingAppRoot)
  await writeFile(
    resolve(stagingAppRoot, 'package.json'),
    `${JSON.stringify(isPreview ? { ...appManifest, productName: packagedName } : appManifest, null, 2)}\n`,
  )
  await verifyRuntimeVersion(runtimeRoot, appManifest)
  const runtimeManifest = await readRuntimeManifest(runtimeRoot)
  if (
    runtimeManifest.platform !== 'darwin'
    || runtimeManifest.arch !== arch
    || (localSnapshot
      ? runtimeManifest.sourceSnapshot?.kind !== 'local-development'
        || runtimeManifest.sourceSnapshot?.baseCommit !== expectedHarnessCommit
        || runtimeManifest.sourceSnapshot?.headCommit !== runtimeManifest.upstreamCommit
        || !/^[a-f0-9]{40}$/u.test(runtimeManifest.upstreamCommit)
        || !runtimeManifest.sourceSnapshot?.packages
      : runtimeManifest.upstreamCommit !== expectedHarnessCommit || runtimeManifest.sourceSnapshot !== undefined)
    || runtimeManifest.harnessVersion !== expectedHarnessVersion
    || runtimeManifest.deepviewerVersion !== appVersion
    || JSON.stringify(runtimeManifest.plugins) !== JSON.stringify(expectedRuntimePlugins)
  ) {
    throw new Error(`runtime manifest mismatch for ${arch}: ${JSON.stringify(runtimeManifest)}`)
  }

  const electronZipDir = cachedElectronZipDirectory(arch)
  const paths = await packager({
    dir: stagingAppRoot,
    tmpdir: resolve(outputRoot, '.packager', `${outputName}-${arch}`),
    out: outputRoot,
    overwrite: true,
    platform: 'darwin',
    arch,
    electronVersion,
    ...(electronZipDir === undefined ? {} : { electronZipDir }),
    name: packagedName,
    executableName: packagedName,
    icon: appIcon,
    appBundleId: isPreview ? 'com.deepviewer.desktop.dev' : 'com.deepviewer.desktop',
    appVersion,
    buildVersion: appBuildVersion,
    asar: true,
    extraResource: [runtimeRoot, nativeIcon.catalog],
    extendInfo: { CFBundleIconName: nativeIcon.name },
    afterCopyExtraResources: [async ({ buildPath }) => {
      const temporaryAppPath = resolve(buildPath, `${packagedName}.app`)
      const copiedRuntimeRoot = resolve(temporaryAppPath, 'Contents', 'Resources', 'harness')
      const normalizedCount = await normalizeCopiedRuntimeSymlinks({
        sourceRoot: runtimeRoot,
        copiedRoot: copiedRuntimeRoot,
      })
      await run('xattr', ['-cr', temporaryAppPath])
      process.stdout.write(`Normalized ${normalizedCount} copied Runtime symbolic links for ${arch}\n`)
    }],
    prune: false,
    ...(signingIdentity === undefined ? {} : {
      osxSign: createOsxSignOptions({ identity: signingIdentity, keychain: signingKeychain }),
    }),
  })
  const packagedOutputRoot = paths[0]
  if (packagedOutputRoot === undefined) throw new Error(`Electron Packager returned no ${arch} output path`)
  const appPath = resolve(packagedOutputRoot, `${packagedName}.app`)
  await verifyRuntimeVersion(resolve(appPath, 'Contents', 'Resources', 'harness'), appManifest)
  await auditPackagedApp({
    appPath,
    projectRoot,
    expectedAppName: `${packagedName}.app`,
  })
  if (isPreview) {
    process.stdout.write(`${appPath}\nDeepViewer Dev preview created without DMG, signing, notarization, or upload.\n`)
    continue
  }
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
  await run('hdiutil', ['verify', dmgPath])
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
