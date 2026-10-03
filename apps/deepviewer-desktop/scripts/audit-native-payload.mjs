import { execFileSync } from 'node:child_process'
import { closeSync, existsSync, globSync, lstatSync, openSync, readSync, realpathSync, readFileSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
/** Vendored pnpm carries optional binaries for every platform; retain only manifest-declared compatible packages. */
export function pruneForeignRuntimePackages(root) {
  const removed = []
  const accepts = (values, value) => !values || (!values.includes(`!${value}`) && (!values.some(item => !item.startsWith('!')) || values.includes(value)))
  for (const file of globSync('**/package.json', { cwd: root, dot: true })) {
    const manifest = join(root, file); if (!existsSync(manifest)) continue
    const data = JSON.parse(readFileSync(manifest, 'utf8'))
    if (!accepts(data.os,'darwin') || !accepts(data.cpu,'arm64')) { removed.push({ name: data.name, path: dirname(file) }); rmSync(dirname(manifest), { recursive: true }) }
  }
  return removed
}
export function auditNativePayload(root) {
  const directory = realpathSync(root), binaries = []
  for (const path of globSync('**/*', { cwd: directory, dot: true })) {
    const absolute = join(directory, path), info = lstatSync(absolute)
    if (info.isSymbolicLink()) {
      const child = relative(directory, realpathSync(absolute)); if (child === '..' || child.startsWith('../') || isAbsolute(child)) throw new Error(`Escaping payload link: ${path}`)
      continue
    }
    if (!info.isFile() || info.size < 4) continue
    const bytes = Buffer.alloc(4), fd = openSync(absolute, 'r'); try { readSync(fd, bytes, 0, 4, 0) } finally { closeSync(fd) }
    if (!['feedface','cefaedfe','feedfacf','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca'].includes(bytes.toString('hex'))) continue
    const archs = execFileSync('/usr/bin/lipo', ['-archs', absolute], { encoding: 'utf8' }).trim().split(/\s+/)
    if (!archs.includes('arm64')) throw new Error(`Non-arm64 Mach-O: ${path} (${archs.join(',')})`)
    binaries.push({ path, archs })
  }
  if (!binaries.length) throw new Error('Payload has no verified Mach-O binaries')
  return { machOBinaries: binaries.length, binaries }
}
