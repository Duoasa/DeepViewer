import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Preserve DeepViewer's original artwork byte-for-byte. Native packaging and
// development use the shipped ICNS, without requiring Icon Composer or Xcode.
export async function compileNativeAppIcon(appRoot) {
  const sourceIcns = await readFile(join(appRoot, 'assets', 'DeepViewer.icns'))
  const sourcePng = await readFile(join(appRoot, 'assets', 'deepviewer-icon-macos26-1024.png'))
  const fingerprint = createHash('sha256')
    .update(sourceIcns).update(sourcePng).update(await readFile(new URL(import.meta.url)))
    .digest('hex')
  const output = join(appRoot, '.desktop', 'native-icon')
  const stamp = join(output, 'source.sha256')
  const result = {
    icns: join(output, 'DeepViewer.icns'),
    dockThemes: join(output, 'DeepViewerDockThemes'),
    name: 'DeepViewer',
    fingerprint,
  }
  const light = join(result.dockThemes, 'light.png')
  const dark = join(result.dockThemes, 'dark.png')
  const complete = await Promise.all([result.icns, light, dark].map(path => access(path)))
    .then(() => true, () => false)
  if (complete && await readFile(stamp, 'utf8').catch(() => '') === fingerprint) return result
  // Clear stale layered catalogs so a previous Scoder build cannot leak into
  // the restored DeepViewer bundle.
  await rm(output, { recursive: true, force: true })
  await mkdir(result.dockThemes, { recursive: true })
  await writeFile(result.icns, sourceIcns)
  // DeepViewer's original Dock icon is the same in both app appearances.
  await writeFile(light, sourcePng)
  await writeFile(dark, sourcePng)
  await writeFile(stamp, fingerprint)
  return result
}
