import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync, closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, readdirSync, readlinkSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { hostname } from 'node:os'
import { execFileSync } from 'node:child_process'

// This version describes the desktop directory layout, NOT the app or DSH version.
export const DATA_LAYOUT_VERSION = 1
export const DATA_LAYOUT_FILE = '.deepviewer-layout.json'

export interface MigrationOptions {
  userData: string
  appData: string
  development: boolean
  explicitDirectory?: boolean
  /** Test seam for crash/race injection; production never supplies it. */
  checkpoint?: (phase: 'snapshotted' | 'prepared' | 'backed-up' | 'published') => void
}
interface Entry { hash: string; size: number; mtime: number }
type Inventory = Record<string, Entry>
interface Snapshot { root: string; files: Inventory; index: number }
interface Conflict { path: string; keptSource: number; otherSource: number }
interface Ledger {
  schemaVersion: number
  transaction: string
  completedAt: string
  sources: string[]
  conflicts: Conflict[]
}
export interface MigrationResult {
  migrated: boolean
  sourceCount: number
  conflictCount: number
  backupDirectory?: string
}

function fail(message: string): never {
  throw new Error(`用户数据准备失败 / User data preparation failed: ${message}`)
}
function isMissing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === 'ENOENT' }
function isDirectory(path: string): boolean {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) fail('数据目录不能是符号链接 / Linked data directory is not supported')
    return stat.isDirectory()
  } catch (error) { if (isMissing(error)) return false; throw error }
}
function privateDirectory(path: string): void { mkdirSync(path, { recursive: true, mode: 0o700 }) }
function syncDirectory(path: string): void {
  const fd = openSync(path, 'r')
  try { fsyncSync(fd) } finally { closeSync(fd) }
}
function syncTree(path: string): void {
  for (const name of readdirSync(path)) {
    const child = join(path, name)
    if (lstatSync(child).isDirectory()) syncTree(child)
  }
  syncDirectory(path)
}
function writeJson(path: string, data: unknown): void {
  const temp = `${path}.${randomUUID()}.tmp`
  const fd = openSync(temp, 'wx', 0o600)
  try { writeFileSync(fd, `${JSON.stringify(data, null, 2)}\n`); fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temp, path)
  syncDirectory(dirname(path))
}
function readLedger(home: string): Ledger | undefined {
  const path = join(home, DATA_LAYOUT_FILE)
  if (!existsSync(path)) return undefined
  if (!lstatSync(path).isFile()) fail('无效的数据版本记录 / Invalid data version record')
  const ledger = JSON.parse(readFileSync(path, 'utf8')) as Ledger
  if (ledger.schemaVersion !== DATA_LAYOUT_VERSION || typeof ledger.transaction !== 'string'
    || !Array.isArray(ledger.sources) || !Array.isArray(ledger.conflicts)) {
    fail('数据版本不受支持，请使用兼容版本 / Unsupported data layout; use a compatible app version')
  }
  return ledger
}
function skipped(path: string): boolean {
  const parts = path.split('/')
  return parts.includes('node_modules') || parts.includes('.dsh-module-fallback')
    || path === 'storages/session_projcache' || path.startsWith('storages/session_projcache/')
    || path === DATA_LAYOUT_FILE || (path.startsWith('sessions/') && parts.at(-1) === 'session.lock')
}
function inventory(root: string): Inventory {
  const result: Inventory = Object.create(null) as Inventory
  const walk = (dir: string, prefix: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name
      if (skipped(relative)) continue
      const path = join(dir, name)
      const stat = lstatSync(path)
      if (stat.isDirectory()) walk(path, relative)
      else if (stat.isFile()) result[relative] = {
        hash: createHash('sha256').update(readFileSync(path)).digest('hex'), size: stat.size, mtime: stat.mtimeMs,
      }
      else fail('数据内含不支持的链接或特殊文件，未切换目录 / Unsupported link or special file; data was not switched')
    }
  }
  walk(root, '')
  return result
}
function equalFiles(a: Inventory, b: Inventory): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(k => a[k]!.hash === b[k]?.hash && a[k]!.size === b[k]?.size)
}
function copyPrivate(source: string, dest: string): void {
  privateDirectory(dirname(dest))
  copyFileSync(source, dest)
  chmodSync(dest, 0o600)
  const fd = openSync(dest, 'r')
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

/** Called before snapshots AND immediately before the directory switch. */
export function assertProfileIdle(profile: string): void {
  try {
    const lock = readlinkSync(join(profile, 'SingletonLock'))
    const match = /^(.*)-(\d+)$/u.exec(lock)
    if (!match || match[1] !== hostname()) fail('请先退出旧版应用 / Quit the older app before importing its data')
    const pid = Number(match[2])
    if (pid !== process.pid) {
      try { process.kill(pid, 0); fail('请先退出旧版应用 / Quit the older app before importing its data') }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
    }
  } catch (error) { if (!isMissing(error)) throw error }
  // Old orphaned DSH processes can outlive Electron. Never copy live session writers.
  const sessions = join(profile, 'harness-home', 'sessions')
  if (process.platform === 'darwin' && isDirectory(sessions)) {
    try {
      const pids = execFileSync('/usr/sbin/lsof', ['-t', '+D', sessions], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] })
      if (pids.trim()) fail('旧会话仍被进程使用，请先退出 / Old sessions are still open; quit the older runtime')
    } catch (error) {
      if ((error as { status?: number }).status !== 1) throw error
    }
  }
}
function discover(options: MigrationOptions): string[] {
  if (options.explicitDirectory) return []
  const parent = options.development ? options.userData : join(options.appData, 'DeepViewer Preview')
  if (!isDirectory(parent)) return []
  const pattern = options.development ? /^dsh-\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/u : /^\d+\.\d+\.\d+-preview\.\d+$/u
  return readdirSync(parent).filter(name => pattern.test(name))
    .map(name => join(parent, name)).filter(path => isDirectory(path) && isDirectory(join(path, 'harness-home')))
}
function recency(files: Inventory): number {
  // Runtime caches/locks and directory mtimes are not evidence of actual use.
  return Math.max(0, ...Object.entries(files)
    .filter(([path]) => path.startsWith('sessions/') || path === 'settings.yaml' || path === 'storages/workspace.json')
    .map(([, entry]) => entry.mtime))
}

interface WorkspaceRow { path: string; title: string; sessionIds: string[]; createdAt: string; updatedAt: string }
interface WorkspaceDocument {
  unit: { name: string; version: number }
  global: { initialized: boolean; workspaceIds: string[]; archivedSessionIds?: string[]; pendingMutation?: unknown }
  tables: { workspaces: Record<string, WorkspaceRow> }
}
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(x => typeof x === 'string') }
function readWorkspace(path: string): WorkspaceDocument {
  const doc = JSON.parse(readFileSync(path, 'utf8')) as WorkspaceDocument
  if (doc?.unit?.name !== 'workspace' || doc.unit.version !== 2 || typeof doc.global?.initialized !== 'boolean'
    || !stringArray(doc.global.workspaceIds) || (doc.global.archivedSessionIds !== undefined && !stringArray(doc.global.archivedSessionIds))
    || doc.global.pendingMutation !== undefined || !doc.tables?.workspaces || typeof doc.tables.workspaces !== 'object'
    || Object.keys(doc.tables).some(key => key !== 'workspaces')) {
    fail('不支持的工作区登记格式，原数据已保留 / Unsupported workspace registry; original data preserved')
  }
  const ids = Object.keys(doc.tables.workspaces)
  if (new Set(doc.global.workspaceIds).size !== ids.length || doc.global.workspaceIds.some(id => !Object.hasOwn(doc.tables.workspaces, id))) {
    fail('工作区登记不完整，原数据已保留 / Inconsistent workspace registry; original data preserved')
  }
  const owned = new Set<string>()
  for (const row of Object.values(doc.tables.workspaces)) {
    if (!row || typeof row.path !== 'string' || typeof row.title !== 'string' || typeof row.createdAt !== 'string'
      || typeof row.updatedAt !== 'string' || !stringArray(row.sessionIds)) fail('无效工作区记录 / Invalid workspace record')
    for (const id of row.sessionIds) {
      if (owned.has(id)) fail('会话归属冲突 / Conflicting session ownership')
      owned.add(id)
    }
  }
  return doc
}
function mergeWorkspaces(snapshots: Snapshot[], stage: string): void {
  const docs = snapshots.filter(s => s.files['storages/workspace.json'])
    .map(s => readWorkspace(join(s.root, 'storages/workspace.json')))
  if (!docs.length) return
  const merged: WorkspaceDocument = { unit: { name: 'workspace', version: 2 }, global: { initialized: true, workspaceIds: [], archivedSessionIds: [] }, tables: { workspaces: Object.create(null) as Record<string, WorkspaceRow> } }
  const byPath = new Map<string, string>()
  const owned = new Set<string>()
  const archiveDecided = new Set<string>()
  for (const doc of docs) {
    const archive = new Set(doc.global.archivedSessionIds ?? [])
    for (const id of doc.global.workspaceIds) {
      const row = doc.tables.workspaces[id]!
      let destId = byPath.get(row.path)
      if (destId === undefined) {
        destId = Object.hasOwn(merged.tables.workspaces, id) ? randomUUID() : id
        byPath.set(row.path, destId)
        merged.global.workspaceIds.push(destId)
        merged.tables.workspaces[destId] = { ...row, sessionIds: [] }
      }
      for (const sessionId of row.sessionIds) {
        if (!owned.has(sessionId)) { merged.tables.workspaces[destId]!.sessionIds.push(sessionId); owned.add(sessionId) }
        if (!archiveDecided.has(sessionId)) {
          archiveDecided.add(sessionId)
          if (archive.has(sessionId)) merged.global.archivedSessionIds!.push(sessionId)
        }
      }
    }
    // Archived Chat sessions may have no workspace owner.
    for (const id of archive) if (!archiveDecided.has(id)) { merged.global.archivedSessionIds!.push(id); archiveDecided.add(id) }
  }
  privateDirectory(join(stage, 'storages'))
  writeJson(join(stage, 'storages/workspace.json'), merged)
}

function recover(userData: string): void {
  const parent = join(userData, 'data-migrations')
  const pending = join(parent, 'pending.json')
  if (!existsSync(pending)) return
  if (!lstatSync(pending).isFile()) fail('无效迁移记录 / Invalid migration journal')
  const journal = JSON.parse(readFileSync(pending, 'utf8')) as { transaction: string }
  if (!/^1-[a-f\d-]{36}$/u.test(journal.transaction)) fail('无效迁移记录 / Invalid migration journal')
  const transaction = join(parent, journal.transaction)
  const home = join(userData, 'harness-home')
  const previous = join(transaction, 'previous-home')
  const stage = join(transaction, 'stage')
  isDirectory(transaction)
  if (isDirectory(home) && readLedger(home)?.transaction === journal.transaction) {
    // Publication committed, only journal cleanup was interrupted.
  } else if (!isDirectory(home) && isDirectory(previous)) {
    renameSync(previous, home) // Restore before retrying, never open an empty profile.
  } else if (!isDirectory(home) && isDirectory(stage) && readLedger(stage)?.transaction === journal.transaction) {
    renameSync(stage, home) // Fresh profile had no previous-home to restore.
  } else if (!isDirectory(home) || isDirectory(previous)) {
    fail('迁移恢复状态不明确，备份已保留 / Ambiguous recovery state; backups preserved')
  }
  syncDirectory(userData)
  unlinkSync(pending)
  syncDirectory(parent)
}

/** Must run under Electron's stable-profile single-instance lock, before DSH starts. */
export function prepareUserData(options: MigrationOptions): MigrationResult {
  isDirectory(options.userData) // Reject a linked root before creating any children.
  privateDirectory(options.userData)
  isDirectory(join(options.userData, 'data-migrations'))
  recover(options.userData)
  const home = join(options.userData, 'harness-home')
  if (isDirectory(home)) {
    const ledger = readLedger(home)
    if (ledger) return { migrated: false, sourceCount: ledger.sources.length, conflictCount: ledger.conflicts.length }
  }
  const profiles = [...(isDirectory(home) ? [options.userData] : []), ...discover(options)]
  for (const profile of profiles) assertProfileIdle(profile)
  const sources = profiles.map(profile => ({ profile, files: inventory(join(profile, 'harness-home')) }))
    .sort((a, b) => recency(b.files) - recency(a.files) || Number(b.profile === options.userData) - Number(a.profile === options.userData) || a.profile.localeCompare(b.profile))
  const id = `1-${randomUUID()}`
  const parent = join(options.userData, 'data-migrations')
  if (existsSync(parent) && !isDirectory(parent)) fail('无效迁移目录 / Invalid migration directory')
  const transaction = join(parent, id)
  const stage = join(transaction, 'stage')
  privateDirectory(stage)
  const snapshots: Snapshot[] = sources.map((source, index) => {
    const root = join(transaction, 'sources', String(index))
    privateDirectory(root)
    for (const file of Object.keys(source.files)) copyPrivate(join(source.profile, 'harness-home', file), join(root, file))
    if (!equalFiles(source.files, inventory(root))) fail('备份校验失败，未切换目录 / Backup verification failed; data was not switched')
    return { root, files: source.files, index }
  })
  options.checkpoint?.('snapshotted')
  const chosen = new Map<string, { source: Snapshot; hash: string }>()
  const sessionOwners = new Map<string, number>()
  const conflicts: Conflict[] = []
  for (const source of snapshots) {
    for (const [file, entry] of Object.entries(source.files)) {
      const parts = file.split('/')
      if (parts[0] === 'sessions' && parts.length >= 4) {
        const unit = parts.slice(0, 3).join('/')
        const owner = sessionOwners.get(unit)
        if (owner !== undefined && owner !== source.index) {
          if (chosen.get(file)?.hash !== entry.hash) conflicts.push({ path: unit, keptSource: owner, otherSource: source.index })
          continue // Never mix generations from separate histories of the same session.
        }
        sessionOwners.set(unit, source.index)
      }
      const existing = chosen.get(file)
      if (existing) {
        if (existing.hash !== entry.hash) conflicts.push({ path: file, keptSource: existing.source.index, otherSource: source.index })
        continue
      }
      chosen.set(file, { source, hash: entry.hash })
      copyPrivate(join(source.root, file), join(stage, file))
    }
  }
  mergeWorkspaces(snapshots, stage)
  const staged = inventory(stage)
  for (const [file, expected] of chosen) {
    if (file !== 'storages/workspace.json' && staged[file]?.hash !== expected.hash) fail('数据校验失败 / Data verification failed')
  }
  const ledger: Ledger = { schemaVersion: DATA_LAYOUT_VERSION, transaction: id, completedAt: new Date().toISOString(), sources: sources.map(s => s.profile), conflicts }
  writeJson(join(stage, DATA_LAYOUT_FILE), ledger)
  writeJson(join(transaction, 'report.json'), ledger)
  syncTree(transaction)
  for (const source of sources) {
    assertProfileIdle(source.profile)
    if (!equalFiles(source.files, inventory(join(source.profile, 'harness-home')))) fail('旧数据发生变化，请退出旧版后重试 / Source data changed; quit the older app and retry')
  }
  writeJson(join(parent, 'pending.json'), { transaction: id })
  options.checkpoint?.('prepared')
  if (isDirectory(home)) renameSync(home, join(transaction, 'previous-home'))
  syncDirectory(options.userData)
  options.checkpoint?.('backed-up')
  renameSync(stage, home)
  syncDirectory(options.userData)
  options.checkpoint?.('published')
  unlinkSync(join(parent, 'pending.json'))
  syncDirectory(parent)
  return { migrated: true, sourceCount: sources.length, conflictCount: conflicts.length, backupDirectory: transaction }
}
