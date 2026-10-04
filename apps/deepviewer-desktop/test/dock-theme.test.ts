import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'

// @ts-expect-error The native icon preparation helper is JavaScript.
const { compileNativeAppIcon } = await import('../scripts/native-app-icon.mjs')
const fixtures: string[] = []
const source = resolve(import.meta.dirname, '../assets/DeepViewer.icon')
afterEach(async () => {
  for (const path of fixtures.splice(0)) await rm(path, { recursive: true, force: true })
})

// Decode the actual compiler-provided PNG alpha; no rendering or image edits.
function opaqueBounds(png: Buffer): [number, number, number, number] {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  expect([png[24], png[25], png[28]]).toEqual([8, 6, 0]) // RGBA8, noninterlaced.
  const chunks: Buffer[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const data = inflateSync(Buffer.concat(chunks)), stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c)
    return da <= db && da <= dc ? a : db <= dc ? b : c
  }
  const bounds: [number, number, number, number] = [width, height, -1, -1]
  for (let y = 0; y < height; y++) {
    const filter = data.readUInt8(y * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x, left = x >= 4 ? pixels.readUInt8(offset - 4) : 0
      const up = y ? pixels.readUInt8(offset - stride) : 0, upperLeft = y && x >= 4 ? pixels.readUInt8(offset - stride - 4) : 0
      const correction = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter]
      if (correction === undefined) throw new Error('Unsupported PNG row filter')
      pixels[offset] = (data.readUInt8(y * (stride + 1) + x + 1) + correction) & 255
      if (x % 4 === 3 && pixels.readUInt8(offset) > 127) {
        const pixelX = Math.floor(x / 4)
        bounds[0] = Math.min(bounds[0], pixelX); bounds[1] = Math.min(bounds[1], y)
        bounds[2] = Math.max(bounds[2], pixelX); bounds[3] = Math.max(bounds[3], y)
      }
    }
  }
  return bounds
}

function icnsEntries(buffer: Buffer): Map<string, Buffer> {
  expect(buffer.subarray(0, 4).toString()).toBe('icns')
  const entries = new Map<string, Buffer>()
  for (let offset = 8; offset < buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4), length = buffer.readUInt32BE(offset + 4)
    if (length < 8 || offset + length > buffer.length) throw new Error('Malformed ICNS entry')
    entries.set(type, buffer.subarray(offset + 8, offset + length)); offset += length
  }
  return entries
}

let compilerAvailable = false
if (process.platform === 'darwin') {
  try {
    compilerAvailable = Number(execFileSync('/usr/bin/xcodebuild', ['-version'], { encoding: 'utf8' }).match(/Xcode (\d+)/u)?.[1]) >= 26
  } catch { /* Core-only CI may run without the native icon toolchain. */ }
}

describe('native DeepViewer app icon', () => {
  it('preserves the released whale vector byte-for-byte as an unmasked foreground', async () => {
    const whale = await readFile(join(source, 'Assets/Whale.svg'))
    expect(whale).toEqual(await readFile(new URL('../../deepviewer-adapter/assets/deepviewer-loading-logo.svg', import.meta.url)))
    expect(createHash('sha256').update(whale).digest('hex'))
      .toBe('16896da065025e41040115cc8f16f0268a94200bd5ea3c939e27e3078dff1816')
    const document = JSON.parse(await readFile(join(source, 'icon.json'), 'utf8'))
    expect(document.groups.flatMap((group: { layers: Array<{ 'image-name': string }> }) => group.layers.map(layer => layer['image-name'])))
      .toEqual(['Whale.svg'])
  })

  it('leaves the native bundle icon authoritative through appearance changes', async () => {
    const bootstrap = await readFile(new URL('../../deepviewer-adapter/desktop/bootstrap.ts', import.meta.url), 'utf8')
    expect(bootstrap).not.toMatch(/\.setIcon\s*\(/u)
    expect(bootstrap).not.toContain('followDockTheme')
  })

  it.skipIf(!compilerAvailable)('compiles native appearances and a correctly padded, complete legacy ICNS, repairing partial output', async () => {
    const appRoot = await mkdtemp(join(tmpdir(), 'deepviewer-native-icon-'))
    fixtures.push(appRoot)
    await mkdir(join(appRoot, 'assets'))
    await cp(source, join(appRoot, 'assets/DeepViewer.icon'), { recursive: true })
    const output = join(appRoot, '.desktop/native-icon')
    await mkdir(join(output, 'DeepViewerDockThemes'), { recursive: true })
    await writeFile(join(output, 'DeepViewerDockThemes/light.png'), 'obsolete full-bleed override')
    const result = await compileNativeAppIcon(appRoot)
    await expect(access(join(output, 'DeepViewerDockThemes'))).rejects.toThrow()
    const entries = icnsEntries(await readFile(result.icns))
    for (const size of ['ic04', 'ic05', 'ic07', 'ic08', 'ic09', 'ic10', 'ic11', 'ic12', 'ic13', 'ic14']) {
      expect(entries.has(size), `missing complete native legacy rendition ${size}`).toBe(true)
    }
    const png = entries.get('ic10')!
    expect(await readFile(result.about)).toEqual(png)
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 1024])
    const [left, top, right, bottom] = opaqueBounds(png)
    // The regression filled every edge. Apple's legacy mask owns these margins.
    expect(left).toBeGreaterThanOrEqual(80); expect(top).toBeGreaterThanOrEqual(80)
    expect(right).toBeLessThan(944); expect(bottom).toBeLessThan(944)
    expect(right - left).toBeGreaterThan(780); expect(bottom - top).toBeGreaterThan(780)
    const info = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', result.info], { encoding: 'utf8' }))
    expect(info).toEqual({ CFBundleIconFile: 'DeepViewer', CFBundleIconName: 'DeepViewer' })
    const catalog = JSON.parse(execFileSync('/usr/bin/assetutil', ['--info', result.catalog], { encoding: 'utf8' }))
    const appearances = catalog.filter((item: { AssetType: string; Name: string }) => item.AssetType === 'IconImageStack' && item.Name === 'DeepViewer')
      .map((item: { Appearance: string }) => item.Appearance)
    expect(appearances).toEqual(expect.arrayContaining(['NSAppearanceNameAqua', 'NSAppearanceNameDarkAqua', 'ISAppearanceTintable']))
    expect(await compileNativeAppIcon(appRoot)).toEqual(result)
    await rm(result.catalog)
    expect(await compileNativeAppIcon(appRoot)).toEqual(result)
    expect((await readFile(result.catalog)).length).toBeGreaterThan(0)
  }, 30_000)
})
