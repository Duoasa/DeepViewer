import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  chmodSync, closeSync, copyFileSync, existsSync, fsyncSync, lstatSync,
  mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, renameSync,
  symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { assertProfileIdle } from './user-data-migration.js'

const receiptName = '.deepviewer-profile.json'
const omittedRoots = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache',
  'DawnWebGPUCache', 'Crashpad', 'data-migrations', 'SingletonLock', 'SingletonSocket', 'SingletonCookie'])
interface Entry { kind: 'file' | 'link' | 'directory'; value: string; mode: number }
type Inventory = Record<string, Entry>
export interface ProfileMigrationOptions {
  appData: string
  development: boolean
  explicitDirectory?: boolean
  checkpoint?: (phase: 'copied' | 'verified' | 'published') => void
}

function directory(path: string): boolean {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('DeepViewer 数据目录必须是普通文件夹')
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
function privateDirectory(path: string): void {
  if (!directory(path)) mkdirSync(path, { recursive: true, mode: 0o700 })
}
function sync(path: string): void {
  const fd = openSync(path, 'r')
  try { fsyncSync(fd) } finally { closeSync(fd) }
}
function syncDirectories(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) syncDirectories(join(path, entry.name))
  }
  sync(path)
}
function omitted(relative: string): boolean {
  const parts = relative.split('/')
  return omittedRoots.has(parts[0]!) || /^dsh-\d/u.test(parts[0]!)
    || relative === receiptName || parts.at(-1) === '.DS_Store'
    || (relative.startsWith('harness-home/sessions/') && parts.at(-1) === 'session.lock')
    || relative === 'harness-home/cache' || relative === 'harness-home/storages/session_projcache'
}
function inventory(root: string): Inventory {
  const result: Inventory = Object.create(null) as Inventory
  const walk = (relative: string) => {
    for (const name of readdirSync(join(root, relative)).sort()) {
      const file = relative ? `${relative}/${name}` : name
      if (omitted(file)) continue
      const path = join(root, file), stat = lstatSync(path)
      if (stat.isDirectory()) { result[file] = { kind: 'directory', value: '', mode: stat.mode & 0o777 }; walk(file) }
      else if (stat.isSymbolicLink()) result[file] = { kind: 'link', value: readlinkSync(path), mode: stat.mode & 0o777 }
      else if (stat.isFile()) result[file] = { kind: 'file', value: createHash('sha256').update(readFileSync(path)).digest('hex'), mode: stat.mode & 0o777 }
      else throw new Error('DeepViewer 数据内有不支持的特殊文件；源目录已保留')
    }
  }
  walk('')
  return result
}
function same(a: Inventory, b: Inventory): boolean {
  return Object.keys(a).length === Object.keys(b).length
    && Object.entries(a).every(([key, value]) => value.kind === b[key]?.kind && value.value === b[key]?.value)
}
function recency(profile: string): number {
  let latest = 0
  const walk = (path: string): void => {
    const stat = lstatSync(path)
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) if (!['node_modules', 'cache', 'logs', 'session_projcache'].includes(name)) walk(join(path, name))
    } else if (stat.isFile()) latest = Math.max(latest, stat.mtimeMs)
  }
  walk(join(profile, 'harness-home'))
  return latest
}

/** Copies one same-channel profile before Electron opens storage. Source files are never removed. */
export function migrateDeepViewerProfile(options: ProfileMigrationOptions): { migrated: boolean; source?: string; files?: number; report?: string } {
  if (options.explicitDirectory) return { migrated: false }
  const target = join(options.appData, options.development ? 'DeepViewer Dev' : 'DeepViewer')
  if (directory(target) && (existsSync(join(target, receiptName)) || directory(join(target, 'harness-home')))) return { migrated: false }
  privateDirectory(options.appData)
  const pattern = options.development ? /^DeepViewer Dev \d+\.\d+\.\d+(?:[-.][\w.-]+)?$/u : /^DeepViewer \d+\.\d+\.\d+(?:[-.][\w.-]+)?$/u
  const candidates = readdirSync(options.appData).filter(name => pattern.test(name))
    .map(name => join(options.appData, name)).filter(path => directory(path) && directory(join(path, 'harness-home')))
    .sort((a, b) => recency(b) - recency(a) || a.localeCompare(b))
  const source = candidates[0]
  if (!source) return { migrated: false }
  const migrations = join(options.appData, 'DeepViewer Migrations')
  privateDirectory(migrations)
  const lock = join(migrations, options.development ? 'development.lock' : 'installed.lock')
  // macOS shlock atomically owns the PID lock and recovers locks of dead processes.
  try { execFileSync('/usr/bin/shlock', ['-p', String(process.pid), '-f', lock], { stdio: 'pipe' }) }
  catch { throw new Error('DeepViewer 数据迁移正在进行，请稍后重试') }
  try {
    if (directory(target) && (existsSync(join(target, receiptName)) || directory(join(target, 'harness-home')))) return { migrated: false }
    assertProfileIdle(source)
    if (directory(target)) {
      assertProfileIdle(target)
      if (readdirSync(target).length) throw new Error('DeepViewer 目标目录已有文件，未覆盖；源目录已保留')
    }
    const before = inventory(source)
    const transaction = join(migrations, randomUUID()), stage = join(transaction, 'profile')
    privateDirectory(stage)
    for (const [relative, entry] of Object.entries(before)) {
      const destination = join(stage, relative)
      privateDirectory(dirname(destination))
      if (entry.kind === 'directory') privateDirectory(destination)
      else if (entry.kind === 'link') symlinkSync(entry.value, destination)
      else {
        copyFileSync(join(source, relative), destination)
        chmodSync(destination, 0o600 | (entry.mode & 0o100))
        sync(destination)
      }
    }
    options.checkpoint?.('copied')
    if (!same(before, inventory(stage))) throw new Error('DeepViewer 迁移副本校验失败；源目录已保留')
    options.checkpoint?.('verified')
    assertProfileIdle(source)
    if (!same(before, inventory(source))) throw new Error('DeepViewer 源数据在迁移时发生变化；未切换目录')
    // Internal absolute links follow the new profile; external project links stay unchanged.
    for (const [relative, entry] of Object.entries(before)) {
      if (entry.kind !== 'link' || !(entry.value === source || entry.value.startsWith(`${source}${sep}`))) continue
      const link = join(stage, relative)
      unlinkSync(link); symlinkSync(resolve(target, '.' + entry.value.slice(source.length)), link)
    }
    const receipt = { schemaVersion: 1, source, target, completedAt: new Date().toISOString(), files: Object.values(before).filter(entry => entry.kind !== 'directory').length }
    const report = join(transaction, 'report.json')
    writeFileSync(report, JSON.stringify({ ...receipt, inventory: before }, null, 2) + '\n', { mode: 0o600 })
    writeFileSync(join(stage, receiptName), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 })
    sync(report); sync(join(stage, receiptName)); syncDirectories(stage); sync(transaction)
    renameSync(stage, target)
    sync(options.appData)
    options.checkpoint?.('published')
    return { migrated: true, source, files: receipt.files, report }
  } finally {
    if (readFileSync(lock, 'utf8').trim() === String(process.pid)) unlinkSync(lock)
  }
}

/** Established DeepViewer filenames stay in place; the scanner imports old report metadata itself. */
export function migrateDeepViewerFileNames(_userData: string): void {}
