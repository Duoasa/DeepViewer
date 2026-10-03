import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadStore, writeStore } from '../src/host/store.mjs'

const fixture = version => ({ version, jobs: [{ route: 'internal', id: 'old', status: 'complete', scanVersion: 5,
  total: 1, progress: 1, error: 'legacy-secret', results: [{ note: 'legacy-secret' }], beforeModels: [{ headers: { token: 'legacy-secret' } }] }], ownership: { internal: { models: { a: { input: true } } } } })
function home(t) { const dir = mkdtempSync(join(tmpdir(), 'mc-store-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir }

for (const version of [2, 3]) test(`migrates v${version} metadata once, retains original, drops all old write authority`, t => {
  const dir = home(t), old = join(dir, 'legacy.json'), file = join(dir, 'current.json')
  const original = JSON.stringify(fixture(version)); writeFileSync(old, original)
  const loaded = loadStore(file, [old])
  assert.equal(loaded.version, 4); assert.equal(loaded.jobs[0].scanVersion, 0)
  assert.deepEqual(loaded.jobs[0].results, []); assert.deepEqual(loaded.ownership, {})
  assert.equal(loaded.jobs[0].beforeModels, undefined)
  assert.ok(!readFileSync(file, 'utf8').includes('legacy-secret'))
  assert.equal(readFileSync(old, 'utf8'), original)
  assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.deepEqual(loadStore(file, [old]), JSON.parse(JSON.stringify(loaded)))
})

test('explicit legacy store gets a retained backup; malformed/newer formats cannot be overwritten', t => {
  const dir = home(t), file = join(dir, 'scans.json')
  writeFileSync(file, JSON.stringify(fixture(3)))
  loadStore(file)
  assert.equal(readdirSync(dir).filter(name => name.endsWith('.bak')).length, 1)
  for (const raw of ['{bad', JSON.stringify(fixture(99))]) {
    writeFileSync(file, raw)
    assert.throws(() => loadStore(file))
    assert.equal(readFileSync(file, 'utf8'), raw)
  }
})

test('current file takes precedence; symbolic links cannot redirect reads or writes', t => {
  const dir = home(t), old = join(dir, 'old.json'), file = join(dir, 'current.json'), link = join(dir, 'link.json')
  writeFileSync(old, JSON.stringify(fixture(3))); writeStore(file, { jobs: [], ownership: {} })
  assert.deepEqual(loadStore(file, [old]).jobs, [])
  symlinkSync(old, link)
  assert.throws(() => loadStore(link), /普通文件/u)
  assert.throws(() => writeStore(link, { jobs: [] }), /普通文件/u)
})

test('imports the DeepViewer 0.3.3 reasoning report without reviving model records or overwriting its source', t => {
  const dir = home(t), old = join(dir, 'deepviewer-model-scans.json'), file = join(dir, 'deepviewer-model-capability-scans.json')
  const original = JSON.stringify({ ...fixture(2), models: { 'internal:model': { availability: { outcome: 'available' }, listing: { state: 'delisted' } } } })
  writeFileSync(old, original)
  const loaded = loadStore(file, [old, join(dir, 'model-capability-scans.json')])
  assert.equal(loaded.jobs[0].route, 'internal'); assert.equal(loaded.jobs[0].legacy, true)
  assert.equal(loaded.jobs[0].status, 'interrupted'); assert.equal(loaded.jobs[0].scanVersion, 0)
  assert.deepEqual(loaded.jobs[0].results, []); assert.deepEqual(loaded.ownership, {})
  assert.equal(loaded.models, undefined); assert.equal(loaded.jobs[0].beforeModels, undefined)
  assert.equal(readFileSync(old, 'utf8'), original)
  assert.ok(!readFileSync(file, 'utf8').includes('legacy-secret'))
  writeStore(file, { jobs: [], ownership: {} })
  assert.deepEqual(loadStore(file, [old]).jobs, [], 'later starts honor the current store instead of reimporting old reports')
})
