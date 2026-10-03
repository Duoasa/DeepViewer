#!/usr/bin/env node
/** Capture the pinned pi-ai payload before dispatch. No network, credentials or live profile. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { scanModel, DEFAULT_LIMITS } from '../src/host/scanner.mjs'
import { mergeModels } from '../src/host/merge.mjs'
import { fakeGateway } from '../test/fake-gateway.mjs'

const integrated = join(dirname(fileURLToPath(import.meta.url)), '../../deepviewer-desktop/.desktop/native-runtime/package.json')
const staged = join(dirname(fileURLToPath(import.meta.url)), '../../../upstream/deepseek-harness/node_modules/@deepviewer/dsh-plugin-model-capabilities/package.json')
const require = createRequire(existsSync(integrated) ? integrated : existsSync(staged) ? staged : import.meta.url)
const llm = dirname(require.resolve('@deepseek-ai/dsh-llm-pi-ai/package.json'))
const pi = join(llm, 'node_modules/@earendil-works/pi-ai')
const { stream: chat } = await import(pathToFileURL(join(pi, 'dist/api/openai-completions.js')))
const { stream: responses } = await import(pathToFileURL(join(pi, 'dist/api/openai-responses.js')))
let captured = 0, networkCalls = 0
for (const api of ['openai-completions', 'openai-responses']) for (const reasoning of [true, false]) {
  const gateway = fakeGateway({ fixture: { developer: false, image: 'reject', ...(reasoning ? { efforts: ['low', 'high'] } : {}) } }, { expected: () => [] })
  const route = { api, baseURL: 'https://fixture.invalid/v1', apiKey: 'test-key' }
  const result = await scanModel(route, { id: 'fixture' }, { limits: DEFAULT_LIMITS, catalog: [], signal: new AbortController().signal,
    fetch: api === 'openai-completions' ? gateway.fetch : async (_, init) => {
      const body = JSON.parse(init.body)
      if (body.input[0].role === 'developer') return Response.json({ error: { message: 'unsupported developer role' } }, { status: 400 })
      if (Array.isArray(body.input[1].content)) return Response.json({ error: { message: 'image input not supported' } }, { status: 400 })
      if (reasoning && body.reasoning?.effort && !['low', 'medium', 'high'].includes(body.reasoning.effort)) return Response.json({ error: { message: 'invalid reasoning_effort' } }, { status: 400 })
      return Response.json({ object: 'response', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] })
    },
  })
  assert.equal(result.availability, 'available')
  const applied = mergeModels([{ id: 'fixture', input: ['text', 'image'], reasoningEfforts: { high: 'wrong' } }], [result]).models[0]
  const model = { id: 'fixture', name: 'Fixture', api, provider: 'custom', baseUrl: route.baseURL, reasoning: applied.reasoningEfforts !== false,
    thinkingLevelMap: applied.reasoningEfforts || undefined, input: applied.input, contextWindow: 4096, maxTokens: 1024,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compat: applied.compat }
  const stream = api === 'openai-completions' ? chat : responses
  let payload
  const events = stream(model, { messages: [{ role: 'system', content: 'Synthetic probe', timestamp: 0 }, { role: 'user', content: 'OK', timestamp: 0 }] }, {
    apiKey: 'fixture-only', maxTokens: 1024, ...(reasoning ? { reasoningEffort: 'low' } : {}),
    onPayload(body) {
      captured++
      payload = body
      throw new Error('Intentional stop before dispatch')
    },
    fetch() { networkCalls++; throw new Error('Network forbidden') },
  })
  await events.result()
  assert.ok(payload, 'runtime payload must be captured')
  assert.equal((payload.messages ?? payload.input)[0].role, 'system', JSON.stringify({ api, reasoning, payload, compat: applied.compat }))
  if (api === 'openai-completions') {
    assert.equal(payload.max_tokens, 1024); assert.equal(payload.max_completion_tokens, undefined)
    assert.equal(payload.stream_options, undefined); assert.equal(payload.store, undefined)
    assert.equal(payload.reasoning_effort, reasoning ? 'low' : undefined)
  } else {
    assert.equal(payload.max_output_tokens, 1024)
    assert.equal(payload.reasoning?.effort, reasoning ? 'low' : undefined)
    assert.equal(payload.reasoning?.summary, reasoning ? 'auto' : undefined)
    assert.deepEqual(payload.include, reasoning ? ['reasoning.encrypted_content'] : undefined)
  }
}
assert.equal(captured, 4); assert.equal(networkCalls, 0)
console.log('PASS: four real pi-ai payloads match applied roles, token fields and effort parameters; zero network calls.')
