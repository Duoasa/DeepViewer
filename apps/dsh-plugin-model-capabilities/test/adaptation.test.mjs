import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scanModel, DEFAULT_LIMITS } from '../src/host/scanner.mjs'
import { mergeModels } from '../src/host/merge.mjs'
import { createImageChallenge } from '../src/host/challenge.mjs'

const route = { baseURL: 'https://fixture.invalid/v1', api: 'openai-completions', apiKey: 'fixture-only' }
const err = message => Response.json({ error: { message } }, { status: 400 })
const ok = (text = 'OK', finish = 'stop') => Response.json({ choices: [{ message: { content: text }, finish_reason: finish }] })
const scan = (fetch, extra = {}) => scanModel(route, { id: 'fixture', configured: { id: 'fixture', maxTokens: 8, input: ['text', 'image'], reasoningEfforts: { high: 'wrong' } } }, {
  limits: DEFAULT_LIMITS, catalog: [], signal: new AbortController().signal, fetch, ...extra,
})

test('repairs role, token field and reasoning budget, then applies a usable text path', async () => {
  const calls = []
  const result = await scan(async (_, init) => {
    const body = JSON.parse(init.body); calls.push(body)
    if (body.messages[0].role === 'developer') return err('unsupported developer role')
    if ('max_tokens' in body) return err('max_tokens unsupported, use max_completion_tokens')
    if (body.max_completion_tokens < 200) return ok('', 'length')
    if (Array.isArray(body.messages[1].content)) return err('image input not supported')
    if (body.reasoning_effort) return err('reasoning_effort unsupported')
    return ok()
  })
  assert.equal(result.availability, 'available')
  assert.equal(result.compat.maxTokensField, 'max_completion_tokens')
  assert.equal(result.compat.supportsDeveloperRole, false)
  assert.deepEqual(result.recommended.input, ['text'])
  assert.equal(result.recommended.reasoningEfforts, false)
  const applied = mergeModels([{ id: 'fixture', maxTokens: 8, input: ['text', 'image'], reasoningEfforts: { high: 'wrong' } }], [result]).models[0]
  assert.equal(applied.maxTokens, 1024); assert.equal(applied.reasoningEfforts, false)
  assert.ok(calls.length <= DEFAULT_LIMITS.requestsPerModel)
})

test('combined failure removes reasoning first and retains working images', async () => {
  let challenge
  const result = await scan(async (_, init) => {
    const body = JSON.parse(init.body), image = Array.isArray(body.messages[1].content)
    if (body.reasoning_effort === '__dsh_invalid_effort__') return err('invalid reasoning_effort')
    if (image && body.reasoning_effort) return err('image plus reasoning_effort unsupported')
    return ok(image ? challenge.expected.join(' ') : 'OK')
  }, { challenge: () => (challenge = createImageChallenge()) })
  assert.equal(result.image.status, 'supported'); assert.equal(result.reasoning.status, 'confirmed')
  assert.deepEqual(result.recommended.input, ['text', 'image']); assert.equal(result.recommended.reasoningEfforts, false)
  assert.equal(result.compat.supportsDeveloperRole, false)
})

test('cannot claim available when final and fallback requests fail', async () => {
  let calls = 0
  const result = await scan(async (_, init) => {
    calls++
    const body = JSON.parse(init.body)
    if (calls === 1) return ok()
    if (body.reasoning_effort === '__dsh_invalid_effort__') return err('invalid reasoning_effort')
    return err('gateway rejected request')
  })
  assert.equal(result.availability, 'uncertain'); assert.equal(result.recommended, undefined)
})

test('Responses wire minimum and final role match a non-reasoning runtime model', async () => {
  const calls = []
  const result = await scanModel({ ...route, api: 'openai-responses' }, { id: 'fixture' }, {
    limits: DEFAULT_LIMITS, catalog: [], signal: new AbortController().signal,
    fetch: async (_, init) => {
      const body = JSON.parse(init.body); calls.push(body)
      assert.ok(body.max_output_tokens >= 16)
      if (Array.isArray(body.input[1].content)) return err('image input not supported')
      return Response.json({ object: 'response', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] })
    },
  })
  assert.equal(result.availability, 'available')
  assert.equal(result.recommended.reasoningEfforts, false)
  assert.equal(calls.at(-1).input[0].role, 'system')
  assert.deepEqual(result.compat, { supportsDeveloperRole: false })
})
