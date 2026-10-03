import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { load, dump } from 'js-yaml'

const SCHEMA = 1
const retired = new Set(['dsh-better-sidebar', 'dsh-plugin-reasoning', '@deepviewer/dsh-plugin-reasoning', '@deepseek-ai/dsh-plugin-reasoning', 'dsh-plugin-preview', '@deepviewer/dsh-plugin-preview', 'deepviewer-taskboard', 'dsh-codex-taskboard', 'better-sidebar', 'ui-better-sidebar'])
const nativeRows: Record<string, string> = { '@deepviewer/adapter': 'deepviewer-adapter', 'dsh-plugin-subscriptions': 'llm-subscriptions', '@deepviewer/dsh-plugin-model-capabilities': 'model-capabilities' }
const legacyReasoning = new Set(['dsh-plugin-reasoning', '@deepviewer/dsh-plugin-reasoning', '@deepseek-ai/dsh-plugin-reasoning', 'deepviewer-model-reasoning'])
interface Manifest { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; dsh?: { profile?: { bundles?: string[] } } }
export interface Integration { name: string; version: string; directory: string }
function json(path: string): Manifest { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {} }
function atomic(path: string, data: string): void {
  if (existsSync(path) && readFileSync(path, 'utf8') === data) return
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, data, { mode: 0o600 }); renameSync(temporary, path)
}
function backupFile(from: string, to: string): void { copyFileSync(from, to); chmodSync(to, 0o600) }
const obsoleteDependency = (name: string): boolean => retired.has(name) || Object.hasOwn(nativeRows, name)
function pruneDependencies(value: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => !obsoleteDependency(name)))
}
/** Keep provider/user settings; replace old activations with native row overrides. */
export function migratePatch(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter(row => !(row && typeof row === 'object' && (retired.has(String(row.name)) || retired.has(String(row.id))) && !(legacyReasoning.has(String(row.name)) || legacyReasoning.has(String(row.id))))).map(migratePatch).filter(row => row !== undefined).flatMap(row => {
    // Moving an inserted activation to a built-in row requires an override, not a second insert.
    if (!row || typeof row !== 'object' || !Array.isArray((row as Record<string, unknown>).insert)) return [row]
    const record = row as Record<string, unknown>, inserted = record.insert as Record<string, unknown>[]
    const overrides = inserted.filter(child => child && !child.name && Object.values(nativeRows).includes(String(child.id)))
    if (!overrides.length) return [row]
    const remaining = inserted.filter(child => !overrides.includes(child))
    const container = { ...record, insert: remaining }
    return [...(remaining.length ? [container] : []), ...overrides]
  })
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    const replacesReasoning = legacyReasoning.has(String(row.name)) || legacyReasoning.has(String(row.id))
    const id = replacesReasoning ? 'model-capabilities' : nativeRows[String(row.name)]
    if (id) {
      // A formerly installed activation is now an override of the application-owned row.
      // The old plugin had no Config schema. Carry only options understood by its replacement;
      // provider/model settings remain in llm-pi-ai and old metadata remains in the backup.
      const config = replacesReasoning && row.config && typeof row.config === 'object' && !Array.isArray(row.config)
        ? Object.fromEntries(Object.entries(row.config).filter(([key]) => ['settingsNamespace', 'storeFile', 'limits'].includes(key)))
        : row.config
      if (config === undefined && row.disabled === undefined) return undefined
      return { id, ...(config === undefined ? {} : { config }), ...(row.disabled === undefined ? {} : { disabled: row.disabled }) }
    }
    return Object.fromEntries(Object.entries(row).map(([key, child]) => [key, migratePatch(child)]))
  }
  return value
}
/** Reconcile backed-up metadata before Host boot; completion follows successful writes. No session stores are copied. */
export function prepareDesktopProfile(home: string, runtime: string, integrations: Integration[], disabledNames: string[] = []): void {
  const target = join(home, 'profiles', 'desktop'), source = join(home, 'profiles', 'web')
  const marker = join(home, '.deepviewer-desktop-migration.json')
  const journal = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')) : {}
  if (journal.schemaVersion !== undefined && journal.schemaVersion !== SCHEMA) throw new Error('Unsupported DeepViewer profile migration schema')
  const completed = journal.schemaVersion === SCHEMA && journal.completedAt !== undefined
  const ownedLinks: Record<string, string> = journal.ownedLinks ?? {}
  mkdirSync(target, { recursive: true, mode: 0o700 })
  const disabled = new Set(disabledNames)
  if (journal.nativeModulesVersion !== undefined && journal.nativeModulesVersion !== 1) throw new Error('Unsupported DeepViewer native module migration schema')
  // Validate the signed installation before changing profile declarations. No user package is replaced.
  for (const plugin of integrations) {
    if (!existsSync(join(plugin.directory, 'package.json'))) throw new Error(`Missing integration: ${plugin.name}`)
  }
  const files = ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml']
  const nativeBackup = join(home, 'migration-backups', 'builtins-v1')
  if (journal.nativeModulesVersion !== 1 && !existsSync(join(nativeBackup, 'index.json'))) {
    mkdirSync(join(nativeBackup, 'desktop'), { recursive: true, mode: 0o700 })
    for (const file of files) if (existsSync(join(target, file))) backupFile(join(target, file), join(nativeBackup, 'desktop', file))
    atomic(join(nativeBackup, 'previous-migration.json'), JSON.stringify(existsSync(marker) ? journal : null))
    atomic(join(nativeBackup, 'index.json'), JSON.stringify({ schemaVersion: SCHEMA, desktopFiles: files.filter(file => existsSync(join(target, file))) }))
  }
  if (!completed) {
    const backup = join(home, 'migration-backups', 'desktop-v1')
    const backupIndex = join(backup, 'index.json')
    if (!existsSync(backupIndex)) {
      for (const [label, directory] of [['web', source], ['desktop', target]] as const) {
        mkdirSync(join(backup, label), { recursive: true, mode: 0o700 })
        for (const file of ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml']) {
          const from = join(directory, file), to = join(backup, label, file)
          if (existsSync(from) && !existsSync(to)) backupFile(from, to)
        }
      }
      atomic(backupIndex, JSON.stringify({ schemaVersion: SCHEMA, desktopFiles: ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'].filter(file => existsSync(join(backup, 'desktop', file))) }))
    }
  }
  const current = existsSync(join(target, 'package.json')) ? json(join(target, 'package.json')) : json(join(source, 'package.json'))
  if (completed && journal.nativeModulesVersion !== 1) {
    // Retry reads the original selection, not partially converted metadata.
    const previous = json(join(nativeBackup, 'desktop', 'package.json'))
    for (const plugin of integrations) {
      const selected = previous.dsh?.profile?.bundles ?? []
      const replacesReasoning = plugin.name === '@deepviewer/dsh-plugin-model-capabilities' && selected.some(name => legacyReasoning.has(name))
      if (!selected.includes(plugin.name) && !replacesReasoning) disabled.add(plugin.name)
    }
  }
  const template = json(join(runtime, 'package.json'))
  const bundles = [...new Set([...(completed ? [] : template.dsh?.profile?.bundles ?? []), ...(current.dsh?.profile?.bundles ?? [])].filter(name => !retired.has(name) && !Object.hasOwn(nativeRows, name)))]
  const manifest = { ...current, name: 'deepviewer-desktop-profile', private: true, dependencies: pruneDependencies(current.dependencies),
    ...(current.devDependencies ? { devDependencies: pruneDependencies(current.devDependencies) } : {}),
    ...(current.optionalDependencies ? { optionalDependencies: pruneDependencies(current.optionalDependencies) } : {}),
    dsh: { ...current.dsh, profile: { ...current.dsh?.profile, bundles } } }
  const patchSource = existsSync(join(target, 'cordis.patch.yml')) ? target : source
  const patch = existsSync(join(patchSource, 'cordis.patch.yml')) ? migratePatch(load(readFileSync(join(patchSource, 'cordis.patch.yml'), 'utf8'))) as Record<string, unknown>[] : []
  if (!Array.isArray(patch) || patch.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('DeepViewer profile patch must be a list of rows')
  for (const name of disabled) {
    const id = nativeRows[name]; if (!id) continue
    const row = patch.findLast(row => row.id === id)
    if (row) row.disabled = true
    else patch.push({ id, disabled: true })
    if (name === '@deepviewer/adapter' && !patch.some(row => row.id === 'preset-deepviewer-chat' && row.disabled === true)) patch.push({ id: 'preset-deepviewer-chat', disabled: true })
  }
  if (patch.length || existsSync(join(patchSource, 'cordis.patch.yml'))) atomic(join(target, 'cordis.patch.yml'), dump(patch))
  atomic(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const lockPath = join(target, 'pnpm-lock.yaml')
  if (existsSync(lockPath)) {
    const lock = load(readFileSync(lockPath, 'utf8')) as { importers?: Record<string, Record<string, Record<string, unknown>>> }
    const importer = lock?.importers?.['.']
    if (importer) {
      let changed = false
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const name of Object.keys(importer[field] ?? {})) if (obsoleteDependency(name)) { delete importer[field]![name]; changed = true }
      }
      if (changed) atomic(lockPath, dump(lock))
    }
  }
  for (const [name, owned] of Object.entries(ownedLinks)) {
    if (!Object.hasOwn(nativeRows, name)) continue
    const link = join(target, 'node_modules', name)
    try { if (lstatSync(link).isSymbolicLink() && resolve(dirname(link), readlinkSync(link)) === owned) unlinkSync(link) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  // A failed conversion leaves its own completion unset, allowing a backed-up retry.
  atomic(marker, `${JSON.stringify({ ...journal, schemaVersion: SCHEMA, nativeModulesVersion: 1, completedAt: journal.completedAt ?? new Date().toISOString(), sourceProfile: existsSync(source) ? 'web' : null, ownedLinks })}\n`)
}

/** Explicit metadata rollback. Preserve a second backup of current state; never downgrade or delete Session/credential data. */
export function rollbackDesktopProfile(home: string): void {
  const target = join(home, 'profiles', 'desktop')
  const marker = join(home, '.deepviewer-desktop-migration.json'), journal = JSON.parse(readFileSync(marker, 'utf8'))
  const native = journal.nativeModulesVersion === 1
  const backup = join(home, 'migration-backups', native ? 'builtins-v1' : 'desktop-v1')
  const index = JSON.parse(readFileSync(join(backup, 'index.json'), 'utf8'))
  if (index.schemaVersion !== SCHEMA) throw new Error('Unsupported rollback schema')
  for (const [name, owned] of Object.entries(journal.ownedLinks ?? {})) {
    const link = join(target, 'node_modules', name)
    try { if (!lstatSync(link).isSymbolicLink() || resolve(dirname(link), readlinkSync(link)) !== owned) throw new Error(`Plugin changed since migration: ${name}`) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  const currentBackup = join(home, 'migration-backups', `rollback-${randomUUID()}`); mkdirSync(currentBackup, { recursive: true, mode: 0o700 })
  for (const file of ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml']) {
    const path = join(target, file)
    if (existsSync(path)) backupFile(path, join(currentBackup, file))
    if (index.desktopFiles.includes(file)) atomic(path, readFileSync(join(backup, 'desktop', file), 'utf8'))
    else if (existsSync(path)) unlinkSync(path)
  }
  atomic(join(currentBackup, 'migration.json'), JSON.stringify(journal))
  const previous = native ? JSON.parse(readFileSync(join(backup, 'previous-migration.json'), 'utf8')) : null
  if (previous) {
    for (const [name, owned] of Object.entries(previous.ownedLinks ?? {}) as [string, string][]) {
      const link = join(target, 'node_modules', name)
      // All existing links were checked above before any metadata was restored.
      try { lstatSync(link) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        mkdirSync(dirname(link), { recursive: true }); symlinkSync(owned, link, 'dir')
      }
    }
    atomic(marker, `${JSON.stringify(previous)}\n`)
  } else {
    for (const name of Object.keys(journal.ownedLinks ?? {})) { try { unlinkSync(join(target, 'node_modules', name)) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error } }
    unlinkSync(marker)
  }
}
