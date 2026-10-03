/** Version-bound backup taken before the new kernel opens any durable stores. */
import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
interface Snapshot { schemaVersion: number; kernel: string; files: { path: string; sha256: string }[] }
const DIRECTORY = 'kernel-v020', SCHEMA = 1
const SOURCE_KERNEL = '0.1.5-rc.2'
function hash(path: string): string { return createHash('sha256').update(readFileSync(path)).digest('hex') }
function safePath(root: string, path: string): string {
  const target = resolve(root, path), child = relative(resolve(root), target)
  if (!child || child === '..' || child.startsWith('../') || child.startsWith('/')) throw new Error('Invalid snapshot path')
  return target
}
export function prepareKernelSnapshot(home: string): void {
  const backup = join(home, 'migration-backups', DIRECTORY), index = join(backup, 'index.json')
  if (existsSync(index)) { verifyKernelSnapshot(home); return }
  mkdirSync(home, { recursive: true, mode: 0o700 })
  const parent = join(home, 'migration-backups'); mkdirSync(parent, { recursive: true, mode: 0o700 })
  const stage = join(parent, `.kernel-${randomUUID()}`); mkdirSync(join(stage, 'data'), { recursive: true, mode: 0o700 })
  const snapshot: Snapshot = { schemaVersion: SCHEMA, kernel: SOURCE_KERNEL, files: [] }
  function walk(path = ''): void {
    for (const entry of readdirSync(join(home, path), { withFileTypes: true })) {
      const child = path ? `${path}/${entry.name}` : entry.name
      if (entry.name === 'node_modules' || entry.name.endsWith('.lock') || (path === '' && ['migration-backups', 'cache', 'logs'].includes(entry.name)) || child === 'profiles/desktop/lock' || child === 'profiles/web/lock') continue
      if (entry.isSymbolicLink()) throw new Error(`Cannot back up redirected data: ${child}`)
      if (entry.isDirectory()) { walk(child); continue }
      if (!entry.isFile()) throw new Error(`Unsupported data entry: ${child}`)
      const from = join(home, child), to = join(stage, 'data', child)
      mkdirSync(dirname(to), { recursive: true, mode: 0o700 }); copyFileSync(from, to); chmodSync(to, 0o600)
      const sha256 = hash(from); if (hash(to) !== sha256) throw new Error('Data changed during kernel backup')
      snapshot.files.push({ path: child, sha256 })
    }
  }
  walk()
  writeFileSync(join(stage, 'index.json'), JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600 })
  // The journal appears only after every copied file has been verified. Incomplete stages remain private.
  renameSync(stage, backup)
}
export function verifyKernelSnapshot(home: string): Snapshot {
  const backup = join(home, 'migration-backups', DIRECTORY), snapshot = JSON.parse(readFileSync(join(backup, 'index.json'), 'utf8')) as Snapshot
  if (snapshot.schemaVersion !== SCHEMA || snapshot.kernel !== SOURCE_KERNEL || !Array.isArray(snapshot.files)) throw new Error('Unsupported kernel backup')
  for (const file of snapshot.files) {
    const path = safePath(join(backup, 'data'), file.path)
    if (!lstatSync(path).isFile() || hash(path) !== file.sha256) throw new Error('Kernel backup integrity mismatch')
  }
  return snapshot
}
/** Explicit rollback into a fresh home. Current/new Sessions are retained; never open them in the old kernel. */
export function restoreKernelSnapshot(home: string, destination: string): void {
  const snapshot = verifyKernelSnapshot(home)
  if (existsSync(destination)) throw new Error('Rollback requires a new, empty destination')
  mkdirSync(destination, { recursive: true, mode: 0o700 })
  for (const file of snapshot.files) { const to = safePath(destination, file.path); mkdirSync(dirname(to), { recursive: true, mode: 0o700 }); copyFileSync(join(home, 'migration-backups', DIRECTORY, 'data', file.path), to); chmodSync(to, 0o600) }
}
