import assert from 'node:assert/strict'
import { test } from 'node:test'
import { probe, listModels, MAX_BODY_BYTES, MAX_ERROR_BYTES, MAX_LIST_BYTES } from '../src/host/probe.mjs'

const base = { baseURL: 'https://fixture.invalid/v1', api: 'openai-completions', model: 'fixture', apiKey: 'opaque-secret/+987654',
  headers: { 'x-internal-token': 'internal-opaque-987654' }, systemRole: 'developer', maxOutputTokens: 8, timeoutMs: 2000,
  signal: new AbortController().signal }
const chat = { choices: [{ index: 0, message: { content: 'OK' }, finish_reason: 'stop' }] }
const completed = { object: 'response', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] }
const sse = (...values) => new Response(values.map(value => `data: ${JSON.stringify(value)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } })
const run = (response, extra = {}) => probe({ ...base, ...extra }, async () => response)

test('empty 200, unfinished chat and length-limited chat are never successful', async () => {
  for (const response of [new Response(''), Response.json({ choices: [] }), sse({ choices: [{ delta: { content: 'OK' } }] }),
    sse({ choices: [{ delta: { content: 'OK' }, finish_reason: 'length' }] })]) {
    assert.equal((await run(response)).status, 'incomplete')
  }
  assert.equal((await run(Response.json(chat))).status, 'ok')
})

test('Responses requires a completed terminal response with output', async () => {
  const extra = { api: 'openai-responses' }
  for (const response of [sse({ type: 'response.created', response: { status: 'in_progress' } }),
    sse({ type: 'response.output_text.delta', delta: 'OK' }),
    new Response('data: [DONE]\n\n'), Response.json({ ...completed, status: 'in_progress' }),
    Response.json({ ...completed, output: [] })]) assert.equal((await run(response, extra)).status, 'incomplete')
  for (const response of [Response.json({ ...completed, status: 'failed' }),
    sse({ type: 'response.failed', response: { error: { message: 'failed fixture' } } })]) assert.equal((await run(response, extra)).status, 'error')
  const limited = await run(sse({ type: 'response.incomplete', response: { ...completed, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }), extra)
  assert.equal(limited.status, 'incomplete'); assert.equal(limited.finishedByLength, true)
  assert.equal((await run(Response.json(completed), extra)).status, 'ok')
})

test('SSE accepts chunk boundaries, CRLF, multiline data and a final unterminated event', async () => {
  const wire = 'event: message\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"你好"},"finish_reason":"stop"}]}'
  const bytes = new TextEncoder().encode(wire)
  const response = new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
    controller.close()
  } }), { headers: { 'content-type': 'text/event-stream' } })
  const result = await run(response)
  assert.equal(result.status, 'ok'); assert.equal(result.text, '你好')
})

test('Responses terminal snapshot does not duplicate earlier text deltas', async () => {
  const result = await run(sse({ type: 'response.output_text.delta', delta: 'OK' }, { type: 'response.completed', response: completed }), { api: 'openai-responses' })
  assert.equal(result.status, 'ok'); assert.equal(result.text, 'OK')
  assert.equal((await run(new Response('data: {broken}\n\n'))).status, 'malformed')
})

test('request-scoped secrets are removed from JSON errors, SSE errors, output and thrown errors', async () => {
  const secrets = [base.apiKey, base.headers['x-internal-token'], encodeURIComponent(base.apiKey)]
  const echo = secrets.join(' / ')
  const responses = [Response.json({ error: { message: echo } }, { status: 400 }),
    sse({ error: { message: echo } }), Response.json({ choices: [{ message: { content: echo }, finish_reason: 'stop' }] }),
    sse({ type: 'response.failed', response: { error: { message: echo } } })]
  for (let i = 0; i < responses.length; i++) {
    const result = await run(responses[i], i === 3 ? { api: 'openai-responses' } : {})
    for (const secret of secrets) assert.ok(!JSON.stringify(result).includes(secret))
  }
  const thrown = await probe(base, async () => { throw new Error(echo) })
  const listing = await listModels(base, async () => { throw new Error(echo) })
  for (const secret of secrets) assert.ok(!JSON.stringify({ thrown, listing }).includes(secret))
  const list = await listModels(base, async () => Response.json({ data: [{ id: base.apiKey }, { id: 'valid-model' }] }))
  assert.deepEqual(list.entries, [{ id: 'valid-model' }])
})

function oversized(cap, status = 200) {
  let read = 0, cancelled = false
  const response = new Response(new ReadableStream({
    pull(controller) { read++; controller.enqueue(new Uint8Array(8192).fill(32)) },
    cancel() { cancelled = true },
  }), { status })
  return { response, check() { assert.equal(cancelled, true); assert.ok(read * 8192 <= cap + 16384) } }
}

test('stream, HTTP error and model-list byte limits cancel the reader early', async () => {
  for (const [cap, status] of [[MAX_BODY_BYTES, 200], [MAX_ERROR_BYTES, 400]]) {
    const body = oversized(cap, status)
    assert.equal((await run(body.response)).status, 'truncated'); body.check()
  }
  const body = oversized(MAX_LIST_BYTES)
  assert.equal((await listModels(base, async () => body.response)).ok, false); body.check()
})

test('custom headers, role and protocol-specific budgets survive request construction', async () => {
  for (const api of ['openai-completions', 'openai-responses']) {
    await probe({ ...base, api, effort: 'low', maxTokensField: 'max_completion_tokens', image: { prompt: 'fixture', dataUrl: 'data:image/png;base64,AA==' } }, async (url, init) => {
      const body = JSON.parse(init.body)
      assert.equal(init.redirect, 'error')
      assert.equal(init.headers.get('x-internal-token'), base.headers['x-internal-token'])
      assert.equal(init.headers.get('authorization'), `Bearer ${base.apiKey}`)
      assert.equal((body.messages ?? body.input)[0].role, 'developer')
      assert.equal(body[api === 'openai-responses' ? 'max_output_tokens' : 'max_completion_tokens'], api === 'openai-responses' ? 16 : 8)
      if (api === 'openai-responses') {
        assert.deepEqual(body.reasoning, { effort: 'low', summary: 'auto' })
        assert.deepEqual(body.include, ['reasoning.encrypted_content'])
      }
      return Response.json(api === 'openai-responses' ? completed : chat)
    })
  }
})
