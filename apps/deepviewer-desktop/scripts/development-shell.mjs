import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { compileNativeAppIcon } from './native-app-icon.mjs'

const execute = promisify(execFile)

export function developmentShellDirectory(appRoot) {
  const project = createHash('sha256').update(resolve(appRoot)).digest('hex').slice(0, 16)
  return join(tmpdir(), 'deepviewer-development-shell', project)
}

// Give the development process its own native app bundle, without modifying
// the shared Electron installation.
export async function prepareDevelopmentShell(electronExecutable, appRoot) {
  const icon = await compileNativeAppIcon(appRoot)
  const sourceBundle = dirname(dirname(dirname(electronExecutable)))
  // Keep generated signed bundles outside cloud-synchronized source folders:
  // file providers can add Finder metadata after xattr cleanup and break signing.
  const output = developmentShellDirectory(appRoot)
  const bundle = join(output, 'DeepViewer Dev.app')
  const executable = join(bundle, 'Contents', 'MacOS', 'Electron')
  const manifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8'))
  const fingerprint = [sourceBundle, manifest.devDependencies.electron, manifest.version,
    manifest.buildNumber, icon.fingerprint, await readFile(new URL(import.meta.url), 'utf8')].join('\n')
  const stamp = join(output, 'source.stamp')
  if (await readFile(stamp, 'utf8').catch(() => '') === fingerprint) {
    try {
      await execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
      return executable
    } catch {
      // Recreate a modified carrier instead of launching an invalid cached app.
    }
  }
  await mkdir(output, { recursive: true, mode: 0o700 })
  await rm(bundle, { recursive: true, force: true })
  await cp(sourceBundle, bundle, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE })
  const resources = join(bundle, 'Contents', 'Resources')
  await copyFile(icon.icns, join(resources, 'DeepViewer.icns'))
  await cp(icon.dockThemes, join(resources, 'DeepViewerDockThemes'), { recursive: true })
  const plist = join(bundle, 'Contents', 'Info.plist')
  for (const [key, value] of Object.entries({
    CFBundleName: 'DeepViewer Dev', CFBundleDisplayName: 'DeepViewer Dev',
    CFBundleIdentifier: 'com.deepviewer.desktop.dev',
    CFBundleIconFile: 'DeepViewer.icns', CFBundleShortVersionString: manifest.version,
    CFBundleVersion: String(manifest.buildNumber),
  })) {
    await execute('/usr/bin/plutil', ['-replace', key, '-string', value, plist])
  }
  // The inherited Electron bundle may declare a layered icon; use our ICNS.
  await execute('/usr/bin/plutil', ['-remove', 'CFBundleIconName', plist]).catch(() => {})
  // Copied artwork and the Electron carrier can retain Finder/resource-fork
  // metadata. Remove it only from this generated bundle before ad-hoc signing.
  await execute('/usr/bin/xattr', ['-cr', bundle])
  await execute('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', bundle])
  await execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
  await writeFile(stamp, fingerprint)
  return executable
}
