import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeModels } from '../src/host/merge.mjs'

const working = (id, input = ['text'], reasoningEfforts = false, compat = { supportsDeveloperRole: false }) => ({
  id, availability: 'available', recommended: { input, reasoningEfforts, compat },
})

test('verified configuration replaces stale manual capabilities and preserves unrelated model fields', () => {
  const existing = [{ id: 'm', name: 'Internal model', contextWindow: 10000, input: ['text', 'image'], reasoningEfforts: { high: 'unsupported-wire-value' }, compat: { supportsDeveloperRole: true, requiresToolResultName: true } }]
  const { models, changed } = mergeModels(existing, [working('m')])
  assert.deepEqual(models[0].input, ['text'])
  assert.equal(models[0].reasoningEfforts, false)
  assert.deepEqual(models[0].compat, { supportsDeveloperRole: false, requiresToolResultName: true })
  assert.equal(models[0].contextWindow, 10000); assert.equal(models[0].name, 'Internal model')
  assert.deepEqual(changed, ['m'])
  assert.deepEqual(existing[0].input, ['text', 'image'], 'source snapshot remains available for restore')
})

test('verified image and efforts replace a previous manual text-only restriction', () => {
  const existing = [{ id: 'm', input: ['text'], reasoningEfforts: false }]
  const result = mergeModels(existing, [working('m', ['text', 'image'], { low: 'low', high: 'high' })])
  assert.deepEqual(result.models[0].input, ['text', 'image'])
  assert.deepEqual(result.models[0].reasoningEfforts, { low: 'low', high: 'high' })
})

test('later successful text fallback corrects previously enabled images regardless of ownership', () => {
  const first = mergeModels([{ id: 'm', input: ['text', 'image'] }], [working('m', ['text', 'image'])])
  const next = mergeModels(first.models, [working('m')], { ownership: first.ownership })
  assert.deepEqual(next.models[0].input, ['text'])
})

test('catalog-only and failed scans cannot fabricate a working configuration', () => {
  const existing = [{ id: 'm', input: ['text', 'image'] }]
  for (const row of [{ id: 'm', availability: 'available', image: { status: 'supported', source: 'listing' } },
    { ...working('m'), availability: 'uncertain' }]) assert.deepEqual(mergeModels(existing, [row]).models, existing)
})

test('successful larger budget repairs undersized explicit maxTokens without reducing larger budgets', () => {
  const recommendation = { ...working('a'), recommended: { ...working('a').recommended, minOutputTokens: 1024 } }
  assert.equal(mergeModels([{ id: 'a', maxTokens: 8 }], [recommendation]).models[0].maxTokens, 1024)
  assert.equal(mergeModels([{ id: 'a', maxTokens: 4096 }], [recommendation]).models[0].maxTokens, 4096)
})

test('removal requires explicit option and confirmed missing; discovered working models can be added', () => {
  const existing = [{ id: 'keep' }, { id: 'gone' }, { id: 'audio-name' }]
  const rows = [working('keep'), { id: 'gone', availability: 'model_not_found' }, { id: 'audio-name', availability: 'non-text' }, working('new')]
  assert.deepEqual(mergeModels(existing, rows).models.map(m => m.id), ['keep', 'gone', 'audio-name'])
  assert.deepEqual(mergeModels(existing, rows, { exclude: true, addDiscovered: true }).models.map(m => m.id), ['keep', 'audio-name', 'new'])
  assert.throws(() => mergeModels([{ id: 'gone' }], rows, { exclude: true }), /no models/u)
})
