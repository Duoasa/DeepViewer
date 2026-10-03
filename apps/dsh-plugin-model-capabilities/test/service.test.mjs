import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ScanService, dispatch } from '../src/host/service.mjs'
import { fakeGateway } from './fake-gateway.mjs'
import { createImageChallenge } from '../src/host/challenge.mjs'
import { publicMessage } from '../src/host/errors.mjs'

/** Minimal in-memory llm-pi-ai settings namespace with revision fencing. */
function fakeSettings(providers) {
  const state = { revision: 1, user: { providers: structuredClone(providers) } }
  return {
    state,
    readView: () => ({ ns: 'llm-pi-ai', revision: state.revision, writable: true, user: state.user, value: state.user, secrets: [] }),
    mutate: async (ops, revision) => {
      if (revision !== state.revision) throw new Error('revision mismatch')
      for (const op of ops) {
        assert.equal(op.op, 'set')
        let cursor = state.user
        for (const key of op.path.slice(0, -1)) cursor = cursor[key]
        cursor[op.path.at(-1)] = structuredClone(op.value)
      }
      state.revision++
    },
  }
}

const waitFor = async (predicate, ms = 5000) => {
  const deadline = Date.now() + ms
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function build(models, providers, extra = {}) {
  let current
  const gateway = fakeGateway(models, { expected: () => current?.expected ?? [] })
  const settings = fakeSettings(providers)
  const dir = mkdtempSync(join(tmpdir(), 'mc-'))
  const service = new ScanService({
    readView: settings.readView,
    resolveKey: async (ref) => (ref === 'MEVO_KEY' ? 'test-key' : undefined),
    mutate: settings.mutate,
    file: join(dir, 'scans.json'),
    fetch: gateway.fetch,
    loadCatalog: async () => [],
    limits: { concurrency: 2, timeoutMs: 2000 },
    challenge: () => (current = createImageChallenge()),
    ...extra,
  })
  return { service, gateway, settings, dir }
}

const providers = {
  mevo: { api: 'openai-completions', baseURL: 'https://gw.test/v1', apiKey: undefined, apiKeyEnv: 'MEVO_KEY', models: [{ id: 'deepseek-v4-flash', name: 'DS Flash' }, { id: 'glm-5.3', name: 'GLM' }] },
  anthropic: { api: 'anthropic-messages', baseURL: 'https://api.anthropic.com', apiKeyEnv: 'K' },
}

test('end to end: configured scope, apply, restore, persistence', async (t) => {
  const { service, settings, dir } = build({ 'deepseek-v4-flash': { image: 'read' }, 'glm-5.3': { image: 'reject' }, extra: { image: 'read' } }, providers)
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  assert.equal((await dispatch(service, 'status', { route: 'mevo' })).status, 'new')
  await assert.rejects(dispatch(service, 'status', { route: 'anthropic' }).then(() => dispatch(service, 'start', { route: 'anthropic' })), /OpenAI/u)
  await assert.rejects(dispatch(service, 'start', { route: 'nope' }), /保存/u)

  const started = await dispatch(service, 'start', { route: 'mevo' })
  assert.equal(started.status, 'running')
  await assert.rejects(dispatch(service, 'start', { route: 'mevo' }), /正在运行/u)
  await waitFor(() => service.status('mevo').status !== 'running')
  const done = service.status('mevo')
  assert.equal(done.status, 'complete')
  assert.equal(done.total, 2, 'configured scope scans only configured models')
  const byId = Object.fromEntries(done.results.map((row) => [row.id, row]))
  assert.equal(byId['glm-5.3'].image.status, 'unsupported')
  assert.equal(byId['deepseek-v4-flash'].image.status, 'supported')

  const applied = await dispatch(service, 'apply', { route: 'mevo', id: done.id })
  assert.ok(applied.appliedAt)
  assert.equal(applied.canRestore, true)
  assert.equal(settings.state.revision, 2)
  assert.deepEqual(settings.state.user.providers.mevo.models[0].input, ['text', 'image'])
  assert.deepEqual(settings.state.user.providers.mevo.models[1].input, ['text'], 'known-working text path overrides misleading catalog defaults')
  assert.deepEqual(applied.changed.sort(), ['deepseek-v4-flash', 'glm-5.3'])
  assert.equal(settings.state.user.providers.mevo.models[1].compat.supportsDeveloperRole, false)
  await assert.rejects(dispatch(service, 'apply', { route: 'mevo', id: done.id }), /没有可应用/u)

  // Persisted store survives a new service instance.
  const reloaded = new ScanService({ readView: settings.readView, resolveKey: async () => 'test-key', mutate: settings.mutate, file: join(dir, 'scans.json'), fetch: async () => new Response(''), loadCatalog: async () => [] })
  const status = reloaded.status('mevo')
  assert.equal(status.status, 'complete')
  assert.equal(status.canRestore, true)
  assert.ok(!('beforeModels' in status), 'internal fields do not leak to the client')

  const restored = await dispatch(reloaded, 'restore', { route: 'mevo', id: done.id })
  assert.equal(restored.canRestore, false)
  assert.deepEqual(settings.state.user.providers.mevo.models, providers.mevo.models)
  const raw = JSON.parse(readFileSync(join(dir, 'scans.json'), 'utf8'))
  assert.equal(raw.version, 4)
})

test('scope=all discovers listed models; profile change mid-scan cancels; stop works', async (t) => {
  const { service, settings, dir } = build({ 'deepseek-v4-flash': { image: 'read' }, 'glm-5.3': { image: 'reject' }, extra: { image: 'read' }, 'text-embedding-3': { image: 'reject', listing: {} } }, providers)
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  await dispatch(service, 'start', { route: 'mevo', scope: 'all' })
  await waitFor(() => service.status('mevo').status !== 'running')
  const done = service.status('mevo')
  assert.equal(done.status, 'complete')
  assert.equal(done.total, 4)
  const embedding = done.results.find((row) => row.id === 'text-embedding-3')
  assert.equal(embedding.availability, 'non-text', 'non-text models are not probed')
  const extra = done.results.find((row) => row.id === 'extra')
  assert.equal(extra.availability, 'available')

  // Stale after the profile changes.
  settings.state.user.providers.mevo.baseURL = 'https://other.test/v1'
  settings.state.revision++
  assert.equal(service.status('mevo').stale, true)
  await assert.rejects(dispatch(service, 'apply', { route: 'mevo', id: done.id }), /已变化/u)
})

test('stop cancels a running scan and leaves the job cancelled', async (t) => {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  const slowFetch = async (url, init) => {
    if (String(url).endsWith('/models')) return new Response(JSON.stringify({ data: [] }), { headers: { 'content-type': 'application/json' } })
    await gate
    return new Response(JSON.stringify({ error: { message: 'x' } }), { status: 500 })
  }
  const settings = fakeSettings(providers)
  const dir = mkdtempSync(join(tmpdir(), 'mc-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const service = new ScanService({ readView: settings.readView, resolveKey: async () => 'test-key', mutate: settings.mutate, file: join(dir, 's.json'), fetch: slowFetch, loadCatalog: async () => [] })
  await dispatch(service, 'start', { route: 'mevo' })
  await waitFor(() => service.status('mevo').total === 2)
  const stopped = await dispatch(service, 'stop', { route: 'mevo' })
  release()
  await waitFor(() => service.status('mevo').status !== 'running')
  assert.equal(service.status('mevo').status, 'cancelled')
  void stopped
  service.dispose()
})

test('rejects unsafe routes and unknown methods', async () => {
  const settings = fakeSettings(providers)
  const service = new ScanService({ readView: settings.readView, resolveKey: async () => 'k', mutate: settings.mutate, loadCatalog: async () => [] })
  await assert.rejects(dispatch(service, 'start', { route: '__proto__' }), /无效/u)
  await assert.rejects(dispatch(service, 'frobnicate', { route: 'mevo' }), /未知/u)
  await assert.rejects(dispatch(service, 'status', null), /无效/u)
  assert.equal(service.status('__proto__').status, 'new')
})

test('same-value manual save invalidates old apply/restore; stale and unrelated edits are rejected', async t => {
  const { service, settings, dir } = build({ 'deepseek-v4-flash': { image: 'read' }, 'glm-5.3': { image: 'reject' } }, providers)
  t.after(() => { service.dispose(); rmSync(dir, { recursive: true, force: true }) })
  await dispatch(service, 'start', { route: 'mevo' })
  await waitFor(() => service.status('mevo').status === 'complete')
  const job = service.status('mevo')
  await dispatch(service, 'apply', { route: 'mevo', id: job.id })
  // Match the real settings RPC, which rebuilds objects in schema order.
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)])) : value
  const models = reorder(structuredClone(settings.state.user.providers.mevo.models))
  const payload = { route: 'mevo', id: models[0].id, models, revision: settings.state.revision }
  await assert.rejects(dispatch(service, 'edit', { ...payload, revision: 0 }), /已变化/u)
  const bad = structuredClone(models); bad[1].name = 'unrelated change'
  await assert.rejects(dispatch(service, 'edit', { ...payload, models: bad }), /不支持的字段/u)
  const edited = await dispatch(service, 'edit', payload)
  assert.equal(edited.stale, true); assert.equal(edited.canRestore, false)
  assert.equal(service.ownership.get('mevo').models[models[0].id], undefined)
  await assert.rejects(dispatch(service, 'restore', { route: 'mevo', id: job.id }), /不能覆盖恢复/u)
})

test('configuration changed while resolving credentials cannot start a stale scan', async () => {
  const settings = fakeSettings(providers)
  let release
  const service = new ScanService({ readView: settings.readView, mutate: settings.mutate, resolveKey: () => new Promise(resolve => { release = resolve }) })
  const pending = dispatch(service, 'start', { route: 'mevo' })
  settings.state.user.providers.mevo.baseURL = 'https://changed.invalid'
  release('fixture')
  await assert.rejects(pending, /已变化/u)
  assert.equal(service.status('mevo').status, 'new')
})

test('concurrent state-changing RPCs cannot race a pending profile mutation', async () => {
  const settings = fakeSettings(providers)
  let release
  const service = new ScanService({ readView: settings.readView, mutate: async () => new Promise(resolve => { release = resolve }), resolveKey: async () => 'fixture' })
  const edit = { route: 'mevo', id: 'glm-5.3', models: structuredClone(providers.mevo.models), revision: 1 }
  const pending = dispatch(service, 'edit', edit)
  await assert.rejects(dispatch(service, 'edit', edit), /正在进行/u)
  assert.equal((await dispatch(service, 'status', { route: 'mevo' })).status, 'new')
  release(); await pending
})

test('opaque credential echoes never reach persisted reports or RPC-visible failures', async t => {
  const secret = 'opaque-key-1234/+not-sk', header = 'internal-header-fixture'
  const configured = structuredClone(providers); configured.mevo.headers = { 'x-secret': header }
  const { service, dir } = build({}, configured, {
    resolveKey: async () => secret,
    fetch: async url => String(url).endsWith('/models') ? Response.json({ data: [] }) : Response.json({ error: { message: `permission denied: ${secret} ${header}` } }, { status: 403 }),
  })
  t.after(() => { service.dispose(); rmSync(dir, { recursive: true, force: true }) })
  await dispatch(service, 'start', { route: 'mevo' })
  await waitFor(() => service.status('mevo').status !== 'running')
  for (const raw of [JSON.stringify(service.status('mevo')), readFileSync(join(dir, 'scans.json'), 'utf8'), publicMessage(new Error(secret))]) {
    assert.ok(!raw.includes(secret)); assert.ok(!raw.includes(header))
  }
})
