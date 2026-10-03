import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createImageChallenge } from '../src/host/challenge.mjs'
import { DEFAULT_LIMITS, effortsDict, scanModel } from '../src/host/scanner.mjs'
import { fakeGateway } from './fake-gateway.mjs'

/** A catalog claiming things that the gateway contradicts, to prove probes win. */
const catalog = [
  { id: 'deepseek-v4-flash', provider: 'deepseek', input: ['text'], reasoning: true },
  { id: 'glm-5.2', provider: 'zai', input: ['text'] },
  { id: 'glm-5.3', provider: 'zai', input: ['text', 'image'] },
  { id: 'qwen3-vl-plus', provider: 'alibaba', input: ['text', 'image'], thinkingLevelMap: { off: null, low: 'low', high: 'high' } },
  { id: 'some-thinker', provider: 'x', input: ['text'], reasoning: true, thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' } },
]

function harness(models) {
  let current
  const gateway = fakeGateway(models, { expected: () => current.expected })
  const route = { baseURL: 'https://gw.test/v1', api: 'openai-completions', apiKey: 'test-key' }
  const scan = (id, configured, limits = {}) =>
    scanModel(route, { id, configured }, {
      catalog,
      limits: { ...DEFAULT_LIMITS, ...limits },
      signal: new AbortController().signal,
      fetch: gateway.fetch,
      challenge: () => { let position = 0; return current = createImageChallenge(max => position++ % max) },
    })
  return { scan, gateway }
}

test('probe result overrides a text-only catalog entry (deepseek-v4-flash reads images through the gateway)', async () => {
  const { scan } = harness({ 'deepseek-v4-flash': { image: 'read', efforts: ['low', 'medium', 'high'] } })
  const result = await scan('deepseek-v4-flash')
  assert.equal(result.availability, 'available')
  assert.equal(result.image.status, 'supported')
  assert.equal(result.image.source, 'probe')
  assert.deepEqual(result.reasoning, { status: 'confirmed', levels: ['low', 'medium', 'high'], source: 'probe', note: '非法档位被拒绝且合法档位通过' })
  assert.equal(result.compat.supportsDeveloperRole, false)
})

test('unconfigured custom gateway validates developer then records a working system fallback', async () => {
  const { scan, gateway } = harness({ 'qwen3-vl-plus': { image: 'read' } })
  const result = await scan('qwen3-vl-plus')
  assert.equal(result.image.status, 'supported')
  assert.equal(gateway.calls[0].messages[0].role, 'developer')
  assert.ok(gateway.calls.slice(1).every((call) => call.messages[0].role === 'system'))
  assert.equal(result.compat.supportsDeveloperRole, false)
})

test('configured supportsDeveloperRole=true falls back to system and records the fact', async () => {
  const { scan, gateway } = harness({ 'qwen3-vl-plus': { image: 'read' } })
  const result = await scan('qwen3-vl-plus', { id: 'qwen3-vl-plus', compat: { supportsDeveloperRole: true } })
  assert.equal(result.image.status, 'supported')
  assert.equal(result.compat.supportsDeveloperRole, false)
  assert.equal(gateway.calls[0].messages[0].role, 'developer')
  assert.equal(gateway.calls[1].messages[0].role, 'system')
})

test('explicit image refusal wins over a catalog claim of image support (glm-5.3 text-only deployment)', async () => {
  const { scan } = harness({ 'glm-5.3': { image: 'reject' } })
  const result = await scan('glm-5.3')
  assert.equal(result.image.status, 'unsupported')
  assert.equal(result.image.source, 'probe')
  assert.match(result.image.note, /allowed values/u)
})

test('reasoning model that exhausts the first image budget gets a larger retry', async () => {
  const { scan, gateway } = harness({ thinker: { image: 'read', thinkTokens: 200 } })
  const result = await scan('thinker', undefined, { imageOutputTokens: 96, imageRetryOutputTokens: 1024 })
  assert.equal(result.image.status, 'supported')
  const budgets = gateway.calls.filter((call) => Array.isArray(call.messages[1].content)).map((call) => call.max_tokens)
  assert.deepEqual(budgets, [96, 1024, 1024], 'includes final image configuration verification')
})

test('a single wrong colour still passes; a reversed guess does not', async () => {
  const { scan } = harness({ near: { image: 'read-one-wrong' }, guesser: { image: 'guess' } })
  assert.equal((await scan('near')).image.status, 'supported')
  const guess = await scan('guesser')
  assert.equal(guess.image.status, 'uncertain')
  assert.equal(guess.image.source, 'probe')
})

test('NO IMAGE is inconclusive regardless of catalog claims', async () => {
  const { scan } = harness({ 'glm-5.2': { image: 'drop' }, 'qwen3-vl-plus': { image: 'drop' } })
  assert.equal((await scan('glm-5.2')).image.status, 'uncertain')
  const vl = await scan('qwen3-vl-plus')
  assert.equal(vl.image.status, 'uncertain')
  assert.match(vl.image.note, /保留/u)
})

test('model_not_found needs two confirmations; permission denied keeps the model', async () => {
  const { scan, gateway } = harness({ kept: { deny: true } })
  const missing = await scan('ghost')
  assert.equal(missing.availability, 'model_not_found')
  assert.equal(gateway.calls.filter((call) => call.model === 'ghost').length, 2)
  const denied = await scan('kept')
  assert.equal(denied.availability, 'permission_denied')
  assert.equal(denied.image.status, 'uncertain')
})

test('server errors and rate limits are uncertain, never verdicts', async () => {
  const { scan } = harness({ 'MiniMax-H3': { flaky500: true } })
  const result = await scan('MiniMax-H3')
  assert.equal(result.availability, 'uncertain')
  assert.match(result.note, /服务端错误/u)
})

test('efforts: ignored parameter remains unconfirmed even with exact catalog match', async () => {
  const { scan } = harness({ 'some-thinker': { image: 'reject' }, 'plain-chat': { image: 'reject' } })
  const thinker = await scan('some-thinker')
  assert.equal(thinker.reasoning.status, 'unconfirmed')
  assert.deepEqual(thinker.reasoning.levels, [])
  const plain = await scan('plain-chat')
  assert.equal(plain.reasoning.status, 'unconfirmed')
  assert.deepEqual(plain.reasoning.levels, [])
})

test('request budget is respected', async () => {
  const { scan, gateway } = harness({ m: { image: 'read', efforts: ['low', 'medium', 'high'] } })
  await scan('m', undefined, { requestsPerModel: 3 })
  assert.equal(gateway.calls.length, 3)
})

test('effortsDict drops unknown levels, maps off to null, refuses off-only', () => {
  assert.deepEqual(effortsDict(['high', 'off', 'weird', 'low']), { off: null, low: 'low', high: 'high' })
  assert.equal(effortsDict(['off']), undefined)
  assert.equal(effortsDict([]), undefined)
})

test('explicit system configuration avoids developer requests; accepted developer is persisted', async () => {
  const system = harness({ a: { image: 'reject' } })
  assert.equal((await system.scan('a', { compat: { supportsDeveloperRole: false } })).compat.supportsDeveloperRole, false)
  assert.ok(system.gateway.calls.every(call => call.messages[0].role === 'system'))
  const developer = harness({ a: { developer: true, image: 'reject', efforts: ['low', 'high'] } })
  assert.equal((await developer.scan('a')).compat.supportsDeveloperRole, true)
})

test('catalog reasoning=false does not suppress wire validation', async () => {
  const gateway = fakeGateway({ a: { developer: true, image: 'reject', efforts: ['low', 'high'] } }, { expected: () => [] })
  const result = await scanModel({ baseURL: 'https://fixture.invalid/v1', api: 'openai-completions', apiKey: 'test-key' }, { id: 'a' }, {
    catalog: [{ id: 'a', reasoning: false }], limits: DEFAULT_LIMITS, signal: new AbortController().signal, fetch: gateway.fetch,
  })
  assert.deepEqual(result.reasoning.levels, ['low', 'high'])
})
