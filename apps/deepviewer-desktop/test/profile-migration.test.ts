import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir, hostname } from 'node:os'
import { migrateDeepViewerFileNames, migrateDeepViewerProfile } from '../src/main/profile-migration.js'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture(development = true) {
  const appData = mkdtempSync(join(tmpdir(), 'deepviewer-profile-')); roots.push(appData)
  const source = join(appData, development ? 'DeepViewer Dev 0.3.3' : 'DeepViewer 0.3.3')
  const target = join(appData, development ? 'DeepViewer Dev' : 'DeepViewer')
  put(source, 'harness-home/.credentials.yaml', 'private-fixture')
  return { appData, development, source, target }
}
function put(root: string, path: string, bytes: string) {
  const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes)
}

describe('DeepViewer profile migration', () => {
  it.each([true, false])('preserves all personal files and browser preferences (development=%s)', development => {
    const f = fixture(development)
    const personal = ['harness-home/sessions/p/s/session.v4.jsonl.zstd', 'harness-home/attachments/v1/objects/blob',
      'harness-home/storages/settings.json', 'harness-home/profiles/web/package.json',
      'Local Storage/leveldb/000001.log', 'Partitions/sidebar/Cookies', 'Preferences', 'workspace/notes.txt']
    for (const file of personal) put(f.source, file, `fixture:${file}`)
    mkdirSync(join(f.source, 'workspace/empty'), { recursive: true })
    put(f.source, 'Cache/discard', 'cache'); put(f.source, 'data-migrations/old/backup', 'old-backup')
    const result = migrateDeepViewerProfile(f)
    expect(result.migrated).toBe(true)
    for (const file of personal) expect(readFileSync(join(f.target, file))).toEqual(readFileSync(join(f.source, file)))
    expect(readFileSync(join(f.target, 'harness-home/.credentials.yaml'), 'utf8')).toBe('private-fixture')
    expect(lstatSync(join(f.target, 'harness-home/.credentials.yaml')).mode & 0o777).toBe(0o600)
    expect(lstatSync(f.target).mode & 0o777).toBe(0o700)
    expect(existsSync(join(f.target, 'workspace/empty'))).toBe(true)
    expect(existsSync(join(f.target, 'Cache'))).toBe(false)
    expect(existsSync(join(f.source, 'data-migrations/old/backup'))).toBe(true)
    expect(migrateDeepViewerProfile(f).migrated).toBe(false)
  })

  it.each([true, false])('does not import Scoder, Saidex or the other DeepViewer channel (development=%s)', development => {
    const f = fixture(development)
    rmSync(f.source, { recursive: true })
    for (const name of ['Saidex', 'Saidex Dev', 'Scoder', 'Scoder Dev', 'Scoder 0.7.0', 'Scoder Dev 0.7.0', 'Saidex Preview/0.3.2-preview.1', development ? 'DeepViewer 0.3.3' : 'DeepViewer Dev 0.3.3']) put(join(f.appData, name), 'harness-home/.credentials.yaml', 'foreign')
    expect(migrateDeepViewerProfile(f).migrated).toBe(false)
    expect(existsSync(f.target)).toBe(false)
  })

  it('selects only the versioned DeepViewer profile alongside foreign product data', () => {
    const f = fixture()
    put(join(f.appData, 'Saidex Dev'), 'harness-home/.credentials.yaml', 'earlier-copy')
    expect(migrateDeepViewerProfile(f).source).toBe(f.source)
    expect(readFileSync(join(f.target, 'harness-home/.credentials.yaml'), 'utf8')).toBe('private-fixture')
  })

  it('does not rediscover old data when a canonical profile already exists', () => {
    const f = fixture()
    put(f.target, 'harness-home/storages/settings.json', 'current-settings')
    expect(migrateDeepViewerProfile(f).migrated).toBe(false)
    expect(existsSync(join(f.target, 'harness-home/.credentials.yaml'))).toBe(false)
  })

  it('explicit test profiles never discover or copy real directories', () => {
    const f = fixture()
    expect(migrateDeepViewerProfile({ ...f, explicitDirectory: true }).migrated).toBe(false)
    expect(existsSync(f.target)).toBe(false)
  })

  it.each(['copied', 'verified', 'published'] as const)('can retry an interrupted migration at %s', phase => {
    const f = fixture()
    expect(() => migrateDeepViewerProfile({ ...f, checkpoint: current => { if (current === phase) throw new Error('crash') } })).toThrow('crash')
    expect(readFileSync(join(f.source, 'harness-home/.credentials.yaml'), 'utf8')).toBe('private-fixture')
    migrateDeepViewerProfile(f)
    expect(readFileSync(join(f.target, 'harness-home/.credentials.yaml'), 'utf8')).toBe('private-fixture')
    expect(migrateDeepViewerProfile(f).migrated).toBe(false)
  })

  it('rejects a live source and an active migration lock', () => {
    const f = fixture()
    symlinkSync(`${hostname()}-${process.ppid}`, join(f.source, 'SingletonLock'))
    expect(() => migrateDeepViewerProfile(f)).toThrow('Quit the older app')
    rmSync(join(f.source, 'SingletonLock'))
    put(f.appData, 'DeepViewer Migrations/development.lock', String(process.ppid))
    expect(() => migrateDeepViewerProfile(f)).toThrow('迁移正在进行')
    expect(existsSync(f.target)).toBe(false)
  })

  it('rejects source writes during copying without publishing the new profile', () => {
    const f = fixture()
    expect(() => migrateDeepViewerProfile({ ...f, checkpoint: phase => {
      if (phase === 'copied') put(f.source, 'harness-home/.credentials.yaml', 'changed')
    } })).toThrow('源数据在迁移时发生变化')
    expect(existsSync(f.target)).toBe(false)
  })

  it('preserves links without reading external targets and redirects internal absolute links', () => {
    const f = fixture()
    symlinkSync('/external/project', join(f.source, 'external'))
    symlinkSync(join(f.source, 'harness-home'), join(f.source, 'internal'))
    migrateDeepViewerProfile(f)
    expect(readlinkSync(join(f.target, 'external'))).toBe('/external/project')
    expect(readlinkSync(join(f.target, 'internal'))).toBe(join(f.target, 'harness-home'))
    expect(readlinkSync(join(f.source, 'internal'))).toBe(join(f.source, 'harness-home'))
  })

  it('does not overwrite unrelated target files or follow a linked root', () => {
    const f = fixture()
    put(f.target, 'personal.txt', 'keep')
    expect(() => migrateDeepViewerProfile(f)).toThrow('目标目录已有文件')
    expect(readFileSync(join(f.target, 'personal.txt'), 'utf8')).toBe('keep')
    rmSync(f.target, { recursive: true }); symlinkSync(f.source, f.target)
    expect(() => migrateDeepViewerProfile(f)).toThrow('普通文件夹')
  })

  it('retains the established layout, old scan report and log filenames without overwriting current reports', () => {
    const f = fixture()
    put(f.source, 'harness-home/.deepviewer-layout.json', 'layout')
    put(f.source, 'harness-home/deepviewer-model-scans.json', 'scan')
    put(f.source, 'logs/deepviewer.log', 'log')
    migrateDeepViewerProfile(f); migrateDeepViewerFileNames(f.target)
    expect(readFileSync(join(f.target, 'harness-home/.deepviewer-layout.json'), 'utf8')).toBe('layout')
    expect(readFileSync(join(f.target, 'harness-home/deepviewer-model-scans.json'), 'utf8')).toBe('scan')
    expect(readFileSync(join(f.target, 'logs/deepviewer.log'), 'utf8')).toBe('log')
    expect(readdirSync(join(f.source, 'harness-home'))).toContain('.deepviewer-layout.json')
    put(f.target, 'harness-home/deepviewer-model-capability-scans.json', 'current-scan')
    migrateDeepViewerFileNames(f.target)
    expect(readFileSync(join(f.target, 'harness-home/deepviewer-model-scans.json'), 'utf8')).toBe('scan')
    expect(readFileSync(join(f.target, 'harness-home/deepviewer-model-capability-scans.json'), 'utf8')).toBe('current-scan')
  })
})
