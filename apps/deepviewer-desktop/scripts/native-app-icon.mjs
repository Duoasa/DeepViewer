import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

// The foreground is DeepViewer's original vector artwork. Apple owns the
// background mask, system appearances and legacy transparent margins; never
// resize the old full-bleed PNG to approximate native macOS icon geometry.
export async function compileNativeAppIcon(appRoot) {
  const source = join(appRoot, 'assets', 'DeepViewer.icon')
  const document = JSON.parse(await readFile(join(source, 'icon.json'), 'utf8'))
  const images = [...new Set(document.groups.flatMap(group => group.layers.map(layer => layer['image-name'])))].sort()
  if (images.some(name => typeof name !== 'string' || basename(name) !== name || name === '..')) {
    throw new Error('Native icon layers must be files within DeepViewer.icon/Assets')
  }
  const compiler = (await execute('/usr/bin/xcodebuild', ['-version'])).stdout
  const major = Number(compiler.match(/Xcode (\d+)/u)?.[1])
  if (!Number.isFinite(major) || major < 26) throw new Error('DeepViewer native icons require Xcode 26 or newer')
  const hash = createHash('sha256').update(compiler).update(await readFile(new URL(import.meta.url)))
  const paths = ['icon.json', ...images.map(name => `Assets/${name}`)]
  for (const path of paths) hash.update(path).update(await readFile(join(source, path)))
  const fingerprint = hash.digest('hex')
  const output = join(appRoot, '.desktop', 'native-icon')
  const stamp = join(output, 'source.sha256')
  const result = {
    catalog: join(output, 'Assets.car'),
    icns: join(output, 'DeepViewer.icns'),
    info: join(output, 'icon-info.plist'),
    about: join(output, 'icon.png'),
    name: 'DeepViewer',
    fingerprint,
  }
  const complete = await Promise.all([result.catalog, result.icns, result.info, result.about].map(path => access(path)))
    .then(() => true, () => false)
  if (complete && await readFile(stamp, 'utf8').catch(() => '') === fingerprint) return result
  // Clear all obsolete PNG Dock overrides and previous product catalogs.
  await rm(output, { recursive: true, force: true })
  const buildDocument = join(output, 'DeepViewer.icon')
  await mkdir(join(buildDocument, 'Assets'), { recursive: true })
  for (const path of paths) await copyFile(join(source, path), join(buildDocument, path))
  await execute('/usr/bin/xcrun', [
    'actool', buildDocument, '--compile', output,
    '--output-format', 'human-readable-text', '--notices', '--warnings',
    '--output-partial-info-plist', result.info,
    '--app-icon', result.name, '--include-all-app-icons',
    '--standalone-icon-behavior', 'all', '--enable-on-demand-resources', 'NO',
    '--development-region', 'en', '--target-device', 'mac',
    '--minimum-deployment-target', '13.0', '--platform', 'macosx',
  ])
  const info = JSON.parse((await execute('/usr/bin/plutil', ['-convert', 'json', '-o', '-', result.info])).stdout)
  if (info.CFBundleIconName !== result.name || info.CFBundleIconFile !== result.name) {
    throw new Error('Apple icon compilation produced inconsistent native and legacy names')
  }
  const icns = await readFile(result.icns)
  if (icns.subarray(0, 4).toString() !== 'icns' || (await readFile(result.catalog)).length === 0) {
    throw new Error('Apple icon compilation did not produce the native catalog and legacy ICNS')
  }
  // About panels take a raster path. Extract Apple's largest legacy rendition;
  // do not resize, mask or recolor an image, and never use it as a Dock override.
  let largest
  for (let offset = 8; offset < icns.length;) {
    const length = icns.readUInt32BE(offset + 4)
    if (length < 8 || offset + length > icns.length) throw new Error('Malformed compiled ICNS entry')
    if (icns.toString('ascii', offset, offset + 4) === 'ic10') largest = icns.subarray(offset + 8, offset + length)
    offset += length
  }
  if (!largest || !largest.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || largest.readUInt32BE(16) !== 1024 || largest.readUInt32BE(20) !== 1024) {
    throw new Error('Apple ICNS is missing its largest 1024px PNG rendition')
  }
  await writeFile(result.about, largest)
  await writeFile(stamp, fingerprint)
  return result
}
