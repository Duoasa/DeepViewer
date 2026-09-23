import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, symlinkSync, statSync, utimesSync } from 'node:fs'
import { tmpdir, hostname } from 'node:os'
import { join } from 'node:path'
import { DATA_LAYOUT_FILE, prepareUserData, type MigrationOptions } from '../src/main/user-data-migration.js'
import { resolveDevelopmentUserDataPath, resolveInstalledUserDataPath } from '../src/main/development-profile.js'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function setup(development = true) {
  const appData = mkdtempSync(join(tmpdir(), 'deepviewer-data-'))
  roots.push(appData)
  const userData = development ? resolveDevelopmentUserDataPath(appData) : resolveInstalledUserDataPath(appData)
  return { appData, userData, development } satisfies MigrationOptions
}
function put(profile: string, file: string, value: string, timestamp = 1_000) {
  const target = join(profile, 'harness-home', file)
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, value)
  utimesSync(target, timestamp, timestamp)
}
const get = (root: string, file: string) => readFileSync(join(root, 'harness-home', file), 'utf8')
function registry(rows: Record<string, { path: string; ids: string[] }>) {
  return JSON.stringify({ unit: { name: 'workspace', version: 2 }, global: { initialized: true, workspaceIds: Object.keys(rows), archivedSessionIds: [] }, tables: { workspaces: Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, { path: row.path, title: id, sessionIds: row.ids, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }])) } })
}

describe('stable data roots', () => {
  it('has exactly one version-independent root per channel', () => {
    expect(resolveDevelopmentUserDataPath('/data')).toBe('/data/DeepViewer Dev')
    expect(resolveInstalledUserDataPath('/data')).toBe('/data/DeepViewer')
    // Replacing any app/core version cannot change these APIs: neither accepts a version.
    expect(resolveDevelopmentUserDataPath('/data')).not.toBe(resolveInstalledUserDataPath('/data'))
  })

  it.each([true, false])('imports only the selected channel (development=%s)', development => {
    const options = setup(development)
    const stable = join(options.appData, 'DeepViewer Preview', '0.3.2-preview.1')
    const dev = join(options.appData, 'DeepViewer Dev', 'dsh-0.1.5-rc.2')
    put(stable, 'settings.yaml', 'stable-config')
    put(dev, 'settings.yaml', 'dev-config')
    prepareUserData(options)
    expect(get(options.userData, 'settings.yaml')).toBe(development ? 'dev-config' : 'stable-config')
    expect(get(stable, 'settings.yaml')).toBe('stable-config')
    expect(get(dev, 'settings.yaml')).toBe('dev-config')
  })

  it('explicit smoke profiles never discover real legacy data', () => {
    const options = setup()
    put(join(options.appData, 'DeepViewer Dev', 'dsh-0.1.5-rc.2'), '.credentials.yaml', 'private')
    prepareUserData({ ...options, explicitDirectory: true })
    expect(existsSync(join(options.userData, 'harness-home', '.credentials.yaml'))).toBe(false)
  })
})

describe('legacy profile import', () => {
  it('unions existing and multiple legacy histories, workspaces and attachments while retaining source snapshots', () => {
    const options = setup()
    const older = join(options.userData, 'dsh-0.1.4')
    const recent = join(options.userData, 'dsh-0.1.5-rc.2')
    put(options.userData, 'sessions/project/a/session.jsonl', 'old-target-history')
    put(options.userData, 'storages/workspace.json', registry({ original: { path: '/projects/one', ids: ['a'] } }))
    put(older, 'sessions/project/b/session.jsonl', 'older-history', 2_000)
    put(older, 'storages/workspace.json', registry({ old: { path: '/projects/two', ids: ['b'] } }), 2_000)
    put(recent, 'sessions/project/c/session.v3.jsonl', 'new-history', 3_000)
    put(recent, 'storages/workspace.json', registry({ current: { path: '/projects/one', ids: ['c'] } }), 3_000)
    put(recent, 'settings.yaml', 'recent-settings', 3_000)
    put(recent, '.credentials.yaml', 'fixture-only-credential', 3_000)
    put(options.userData, 'settings.yaml', 'older-settings')
    put(older, 'attachments/v1/objects/blob', 'binary-payload')
    const result = prepareUserData(options)
    expect(result.sourceCount).toBe(3)
    expect(get(options.userData, 'sessions/project/a/session.jsonl')).toBe('old-target-history')
    expect(get(options.userData, 'sessions/project/b/session.jsonl')).toBe('older-history')
    expect(get(options.userData, 'sessions/project/c/session.v3.jsonl')).toBe('new-history')
    expect(get(options.userData, 'settings.yaml')).toBe('recent-settings')
    expect(get(options.userData, 'attachments/v1/objects/blob')).toBe('binary-payload')
    expect(get(options.userData, '.credentials.yaml')).toBe('fixture-only-credential')
    const merged = JSON.parse(get(options.userData, 'storages/workspace.json'))
    expect(merged.global.workspaceIds).toEqual(['current', 'old'])
    expect(merged.tables.workspaces.current.sessionIds).toEqual(['c', 'a'])
    expect(merged.tables.workspaces.old.sessionIds).toEqual(['b'])
    expect(readFileSync(join(result.backupDirectory!, 'previous-home/settings.yaml'), 'utf8')).toBe('older-settings')
    expect(get(recent, 'settings.yaml')).toBe('recent-settings')
    expect(statSync(join(options.userData, 'harness-home/.credentials.yaml')).mode & 0o777).toBe(0o600)
    expect(statSync(result.backupDirectory!).mode & 0o777).toBe(0o700)
  })

  it('never combines divergent generations, and keeps conflicts in complete snapshots', () => {
    const options = setup()
    const legacy = join(options.userData, 'dsh-0.1.5-rc.2')
    put(options.userData, 'sessions/p/s/session.jsonl', 'old', 1_000)
    put(legacy, 'sessions/p/s/session.v3.jsonl', 'new', 2_000)
    const result = prepareUserData(options)
    expect(readdirSync(join(options.userData, 'harness-home/sessions/p/s'))).toEqual(['session.v3.jsonl'])
    expect(result.conflictCount).toBe(1)
    expect(readFileSync(join(result.backupDirectory!, 'sources/1/sessions/p/s/session.jsonl'), 'utf8')).toBe('old')
  })

  it('does not resurrect deleted sessions or overwrite settings on subsequent app/core upgrades', () => {
    const options = setup()
    const legacy = join(options.userData, 'dsh-0.1.5-rc.2')
    put(legacy, 'sessions/p/s/session.jsonl', 'history')
    put(legacy, 'settings.yaml', 'old-setting')
    prepareUserData(options)
    rmSync(join(options.userData, 'harness-home/sessions/p/s'), { recursive: true })
    put(options.userData, 'settings.yaml', 'user-updated-setting')
    put(join(options.userData, 'dsh-9.9.9'), 'sessions/p/s/session.jsonl', 'unexpected-old-import')
    expect(prepareUserData(options).migrated).toBe(false)
    expect(existsSync(join(options.userData, 'harness-home/sessions/p/s'))).toBe(false)
    expect(get(options.userData, 'settings.yaml')).toBe('user-updated-setting')
  })

  it('regenerates cache and dependency links, preserving regular configuration', () => {
    const options = setup()
    const legacy = join(options.userData, 'dsh-0.1.5-rc.2')
    put(legacy, 'profiles/web/cordis.patch.yml', 'user-plugin-config')
    put(legacy, 'sessions/p/s/session.lock', '')
    put(legacy, 'sessions/p/s/session.jsonl', 'history')
    put(legacy, 'storages/session_projcache/sessions/s.json', 'stale-cache')
    mkdirSync(join(legacy, 'harness-home/profiles/node_modules'), { recursive: true })
    symlinkSync('/unavailable/runtime', join(legacy, 'harness-home/profiles/node_modules/runtime'))
    prepareUserData(options)
    expect(get(options.userData, 'profiles/web/cordis.patch.yml')).toBe('user-plugin-config')
    for (const file of ['profiles/node_modules', 'storages/session_projcache', 'sessions/p/s/session.lock']) {
      expect(existsSync(join(options.userData, 'harness-home', file))).toBe(false)
    }
  })

  it.each(['prepared', 'backed-up', 'published'] as const)('recovers a crash at %s without losing either history', phase => {
    const options = setup()
    put(options.userData, 'sessions/p/old/session.jsonl', 'old')
    put(join(options.userData, 'dsh-0.1.5-rc.2'), 'sessions/p/new/session.jsonl', 'new', 2_000)
    expect(() => prepareUserData({ ...options, checkpoint: current => { if (current === phase) throw new Error('simulated crash') } })).toThrow('simulated crash')
    prepareUserData(options)
    expect(get(options.userData, 'sessions/p/old/session.jsonl')).toBe('old')
    expect(get(options.userData, 'sessions/p/new/session.jsonl')).toBe('new')
    expect(existsSync(join(options.userData, 'data-migrations/pending.json'))).toBe(false)
    expect(prepareUserData(options).migrated).toBe(false)
  })

  it('recovers the first installation interrupted before publication', () => {
    const options = setup()
    put(join(options.userData, 'dsh-0.1.5-rc.2'), 'sessions/p/new/session.jsonl', 'new')
    expect(() => prepareUserData({ ...options, checkpoint: phase => { if (phase === 'backed-up') throw new Error('crash') } })).toThrow()
    prepareUserData(options)
    expect(get(options.userData, 'sessions/p/new/session.jsonl')).toBe('new')
  })

  it('rejects a source modified during import and leaves the current profile untouched', () => {
    const options = setup()
    put(options.userData, 'settings.yaml', 'original')
    const legacy = join(options.userData, 'dsh-0.1.5-rc.2')
    put(legacy, 'sessions/p/s/session.jsonl', 'before')
    expect(() => prepareUserData({ ...options, checkpoint: phase => { if (phase === 'snapshotted') put(legacy, 'sessions/p/s/session.jsonl', 'after') } })).toThrow('Source data changed')
    expect(get(options.userData, 'settings.yaml')).toBe('original')
    expect(existsSync(join(options.userData, 'harness-home', DATA_LAYOUT_FILE))).toBe(false)
  })

  it('refuses to silently downgrade a newer desktop schema', () => {
    const options = setup()
    put(options.userData, DATA_LAYOUT_FILE, JSON.stringify({ schemaVersion: 99, transaction: 'future' }))
    expect(() => prepareUserData(options)).toThrow('Unsupported data layout')
  })

  it('does not guess an unknown workspace format', () => {
    const options = setup()
    put(options.userData, 'settings.yaml', 'safe')
    put(join(options.userData, 'dsh-0.1.5-rc.2'), 'storages/workspace.json', '{"unit":{"name":"workspace","version":99}}')
    expect(() => prepareUserData(options)).toThrow('Unsupported workspace registry')
    expect(get(options.userData, 'settings.yaml')).toBe('safe')
  })

  it('refuses arbitrary symlinks and journal traversal before switching the target', () => {
    const options = setup()
    put(options.userData, 'settings.yaml', 'safe')
    symlinkSync('/etc/passwd', join(options.userData, 'harness-home/unsafe'))
    expect(() => prepareUserData(options)).toThrow('Unsupported link')
    expect(get(options.userData, 'settings.yaml')).toBe('safe')
    rmSync(join(options.userData, 'harness-home/unsafe'))
    mkdirSync(join(options.userData, 'data-migrations'), { recursive: true })
    writeFileSync(join(options.userData, 'data-migrations/pending.json'), '{"transaction":"../../escape"}')
    expect(() => prepareUserData(options)).toThrow('Invalid migration journal')
  })

  it('blocks while an older Electron instance owns its legacy directory', () => {
    const options = setup()
    const legacy = join(options.userData, 'dsh-0.1.5-rc.2')
    put(legacy, 'settings.yaml', 'old')
    symlinkSync(`${hostname()}-${process.ppid}`, join(legacy, 'SingletonLock'))
    expect(() => prepareUserData(options)).toThrow('Quit the older app')
    expect(existsSync(join(options.userData, 'harness-home'))).toBe(false)
  })
})
