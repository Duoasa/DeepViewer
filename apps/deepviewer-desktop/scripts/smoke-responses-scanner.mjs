import assert from 'node:assert/strict'
import { test } from 'node:test'
import { probe, scanModel, discover, mergedModels, LIMITS } from '../../dsh-plugin-reasoning/src/scanner.mjs'
import { ScanService } from '../../dsh-plugin-reasoning/src/scan-service.mjs'
import { RESPONSES_OUTPUT_TOKENS } from '../../dsh-plugin-reasoning/src/responses-probe.mjs'
import { readImageProbe } from './fixtures/image-probe-fixture.mjs'
const profile = { api: 'openai-responses', baseURL: 'https://fixture.example/v1', apiKeyEnv: 'TEST_KEY', modelsDev: false, piAiCatalog: [] }
const signal = () => new AbortController().signal
const completed = text => ({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } })
const sse = events => new Response(events.map(e => 'data: ' + JSON.stringify(e)).join('\n\n') + '\n\n', { headers: { 'content-type': 'text/event-stream' } })
const requestFor = handler => async (url, init) => {
  assert.equal(url, profile.baseURL + '/responses'); assert.equal(init.headers.Authorization, 'Bearer fixture'); assert.equal(init.redirect, 'error')
  const body = JSON.parse(init.body)
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, RESPONSES_OUTPUT_TOKENS); assert.equal(body.messages, undefined); assert.equal(body.reasoning_effort, undefined)
  return handler(body, init)
}
const run = request => scanModel(profile, 'fixture', { id: 'm' }, signal(), request)
const ok = requestFor(() => sse([completed('OK')]))
test('Responses payload, effort and image capability with bounded requests', async () => {
  let count = 0
  const result = await run(requestFor(body => {
    count++
    if (body.reasoning?.effort === '__deepviewer_invalid_effort__') return Response.json({ error: { param: 'reasoning.effort', message: 'Invalid value' } }, { status: 400 })
    const input = body.input.at(-1).content
    if (Array.isArray(input)) {
      const content = input.map(p => p.type === 'input_image' ? { type: 'image_url', image_url: { url: p.image_url } } : { type: 'text', text: p.text })
      return sse([completed(readImageProbe({ messages: [{ content }] }))])
    }
    return sse([completed('OK')])
  }))
  assert.equal(result.availability, 'available'); assert.deepEqual(result.efforts, ['low', 'medium', 'high']); assert.equal(result.imageInput.status, 'supported'); assert.ok(count <= LIMITS.requestsPerModel)
})
test('fragmented CRLF/multiline SSE and final event without newline', async () => {
  const text = 'event: response.completed\r\ndata: {"type":"response.completed",\r\ndata: "response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"好"}]}]}}'
  const encoded = new TextEncoder().encode(text)
  const response = new Response(new ReadableStream({ start(c) { for (let i = 0; i < encoded.length; i += 7) c.enqueue(encoded.slice(i, i + 7)); c.close() } }))
  assert.equal((await probe(profile, 'fixture', 'm', undefined, signal(), requestFor(() => response))).ok, true)
})
test('JSON fallback and output deltas completed without duplicate image text', async () => {
  for (const headers of [{ 'content-type': 'application/json' }, {}]) {
    const response = new Response(JSON.stringify(completed('OK').response, null, 2), { headers })
    assert.equal((await probe(profile, 'fixture', 'm', undefined, signal(), requestFor(() => response))).ok, true)
  }
  const response = sse([{ type: 'response.output_text.delta', delta: 'OK' }, { type: 'response.completed', response: { status: 'completed', output: [] } }])
  assert.equal((await probe(profile, 'fixture', 'm', undefined, signal(), requestFor(() => response))).ok, true)
})
test('no availability inferred from created, interrupted, failed or exhausted streams', async () => {
  for (const events of [
    [{ type: 'response.created', response: { status: 'in_progress' } }],
    [{ type: 'response.output_text.delta', delta: 'OK' }],
    [completed('')],
    [{ type: 'response.output_text.delta', delta: 'OK' }, { type: 'response.failed', response: { error: { message: 'failure' } } }],
    [{ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }],
  ]) assert.equal((await run(requestFor(() => sse(events)))).availability, 'uncertain')
})
test('HTTP errors separate missing route, permissions, quota, budget and missing model', async () => {
  for (const [status, text, expected] of [[404,'Not Found','uncertain'],[405,'Method not allowed','uncertain'],[401,'denied','permission_denied'],[403,'model_not_found','permission_denied'],[429,'limit','uncertain'],[500,'model_not_found','uncertain'],[400,'max_output_tokens must be larger','uncertain'],[404,'model_not_found','model_not_found']]) {
    const result = await run(requestFor(() => new Response(text, { status })))
    assert.equal(result.availability, expected)
  }
  assert.equal((await run(requestFor(() => sse([{type:'error',code:'insufficient_quota',message:'quota'}])))).availability, 'permission_denied')
})
test('ignored reasoning values do not confirm support and uncertain image preserves config', async () => {
  const result = await run(ok)
  assert.deepEqual(result.efforts, []); assert.equal(result.imageInput.status, 'uncertain')
  assert.deepEqual(mergedModels([{id:'m',input:['text','image'],reasoningEfforts:{high:'manual'}}],[result],true)[0].reasoningEfforts, {high:'manual'})
})
test('developer-role fallback stays within request limit', async () => {
  let calls = 0
  const result = await run(requestFor(body => { calls++; return body.input[0].role === 'developer' ? new Response('Unsupported developer role', {status:400}) : sse([completed('OK')]) }))
  assert.equal(result.compat.supportsDeveloperRole, false); assert.ok(calls <= 7)
})
test('capability catalog alone cannot mark a Responses model available', async () => {
  let called = false
  const result = await scanModel(profile,'fixture',{id:'m',capability:{source:'models.dev',modalities:['text'],reasoning:{high:'high'}}},signal(),requestFor(() => {called=true;return new Response('denied',{status:403})}))
  assert.ok(called); assert.equal(result.availability,'permission_denied')
})
test('missing model directory falls back only to configured models', async () => {
  const request = async () => new Response('Not found',{status:404})
  assert.deepEqual((await discover({...profile,models:[{id:'m'}]},'fixture',signal(),request)).map(x=>x.id), ['m'])
  await assert.rejects(discover(profile,'fixture',signal(),request), /获取模型列表失败/)
})
test('cancellation and request errors do not classify model as unavailable', async () => {
  const c = new AbortController(); c.abort(); let called = false
  await assert.rejects(probe(profile,'fixture','m',undefined,c.signal,async()=>{called=true}),/停止/); assert.equal(called,false)
  assert.equal((await run(requestFor(()=>{throw new Error('network')}))).availability,'uncertain')
})
test('Responses service supports apply/restore and protocol changes invalidate report', async () => {
  const original=[{id:'m',contextWindow:4096}]; const user={providers:{p:{...profile,models:structuredClone(original)}}}; let revision=0
  const service=new ScanService({read:()=>({user:structuredClone(user),value:structuredClone(user),revision}),resolveKey:async()=> 'fixture',mutate:async(ops,rev)=>{assert.equal(rev,revision);user.providers.p.models=ops[0].value;revision++}, request:async(url,init)=>{
    if (url.endsWith('/api/pricing')) return Response.json({data:[]})
    if (url.endsWith('/models')) return Response.json({data:[{id:'m'}]})
    return ok(url,init)
  }})
  try {
    await service.start('p')
    for(let i=0;i<200 && service.status('p').status==='running';i++) await new Promise(r=>setTimeout(r,5))
    const report=service.status('p');assert.equal(report.status,'complete')
    await service.apply('p',report.id);await service.restore('p',report.id);assert.deepEqual(user.providers.p.models,original)
    user.providers.p.api='openai-completions';assert.equal(service.status('p').stale,true)
  } finally {service.dispose()}
})
test('unconfirmed missing-model result cannot remove a configured model', async () => {
  let calls=0
  const result=await run(requestFor(()=>++calls===1 ? new Response('model_not_found',{status:404}) : new Response('busy',{status:429})))
  assert.equal(result.availability,'uncertain')
  const pending={id:'m',availability:'model_not_found',efforts:[],listing:{state:'pending_removal'}}
  assert.equal(mergedModels([{id:'m'},{id:'keep'}],[pending],true).length,2)
})
test('abort in flight cancels the active request', async () => {
  const controller=new AbortController()
  const job=probe(profile,'fixture','m',undefined,controller.signal,requestFor((_body,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))))
  controller.abort();await assert.rejects(job,/停止/)
})
