import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { modelEdit, validateEfforts } from '../../dsh-plugin-reasoning/src/client/model-config.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = resolve(root, 'upstream/deepseek-harness')
const require = createRequire(resolve(upstream, 'packages/client/ui-renderer/package.json'))
const view = { ns: 'llm-pi-ai', revision: 1, secrets: [], user: { providers: { smoke: { models: [{ id: 'one', contextWindow: 4096 }, { id: 'two' }] } } } }
const original = structuredClone(view)
const op = modelEdit(view, 'smoke', 'one', 'custom', { off: '', low: 'low', high: 'high' })
assert.deepEqual(op.value[0], { id: 'one', contextWindow: 4096, reasoningEfforts: { off: null, low: 'low', high: 'high' } })
assert.deepEqual(view, original)
assert.deepEqual(op.value[1], original.user.providers.smoke.models[1])
const edited = structuredClone(view); edited.user.providers.smoke.models = op.value
assert.deepEqual(modelEdit(edited, 'smoke', 'one', 'inherit', {}).value, original.user.providers.smoke.models)
assert.equal(validateEfforts('disabled', {}), false)
assert.throws(() => validateEfforts('custom', {}))
assert.throws(() => validateEfforts('custom', { high: '' }))
assert.throws(() => modelEdit({ ...view, secrets: [{ path: ['providers', 'smoke', 'models', '0', 'secret'] }] }, 'smoke', 'one', 'custom', { high: 'high' }))
assert.throws(() => modelEdit(view, 'smoke', 'missing', 'inherit', {}))
let bundle
vm.runInNewContext(readFileSync(resolve(upstream, 'node_modules/@deepviewer/dsh-plugin-reasoning/lib/client.js'), 'utf8'), { window: { __ModuleLoader__: { load: value => { bundle = value } } } })
assert.equal(bundle.id, '@deepviewer/dsh-plugin-reasoning')
const plugin = bundle.factory(require)
let registration, accepted, request, fail = false
const mirror = { acceptView: value => { accepted = value } }
plugin.apply({
  effect: action => action(),
  locale: { register: () => () => {}, bind: () => key => key },
  settingsScope: { describe: () => mirror },
  remote: { settings: { mutate: async (...args) => { request = args; return fail ? { ok: false, error: { message: 'revision conflict' } } : { ok: true, value: edited } } } },
  connection: { rpc: { call: async () => ({ ok: true, value: { status: 'new' } }) } },
  slots: { inject: (slot, action) => { assert.equal(slot, 'settings.models.provider-card'); action() }, register: value => { registration = value } },
})
const props = registration.inject()
await props.write(op, 1)
assert.deepEqual(structuredClone(request), ['llm-pi-ai', [op], 1])
assert.equal(accepted, edited)
fail = true
await assert.rejects(props.write(op, 1), /revision conflict/)
console.log('PASS: model edits, restoration, validation, secret guard, native client registration, revision forwarding and conflict propagation')
