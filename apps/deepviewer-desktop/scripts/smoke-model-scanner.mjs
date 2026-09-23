import { readImageProbe } from './fixtures/image-probe-fixture.mjs'
import { modelEdit } from '../../dsh-plugin-reasoning/src/client/model-config.mjs'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ScanService } from '../../dsh-plugin-reasoning/src/scan-service.mjs'
import { endpoint, LIMITS, scanModel, mergedModels, SCAN_VERSION } from '../../dsh-plugin-reasoning/src/scanner.mjs'
import { parseModelsDevCatalog, resolveDeclaredCapability } from '../../dsh-plugin-reasoning/src/capability-sources.mjs'
const home = mkdtempSync(join(tmpdir(), 'deepviewer-scan-unit-'))
let revision = 0, requests = []
const user = { providers: Object.fromEntries(['alpha','beta'].map(route => [route, { api: 'openai-completions', baseURL: 'https://' + route + '.example/v1', apiKeyEnv: 'LOCAL_SCAN_KEY', models: [{ id: 'good', contextWindow: 4096, compat: { supportsStore: false } }, { id: 'denied' }, { id: 'uncertain', reasoningEfforts: { high: 'custom' } }] }])) }
const request = async (url, init) => {
  assert.equal(init.redirect, 'error')
  if (url.endsWith('/api/pricing')) return Response.json({ data: [] })
  assert.equal(init.headers.Authorization, 'Bearer local-fixture')
  if (url.endsWith('/models')) return Response.json({ data: ['good','denied','uncertain','ignored','text-image-model'].map(id => ({ id })) })
  const body = JSON.parse(init.body); requests.push(body)
  assert.equal(body.max_tokens, LIMITS.outputTokens)
  if (body.model === 'denied') return new Response('no access', { status: 403 })
  if (body.model === 'uncertain') return new Response('busy', { status: 429 })
  assert.ok(['system','developer'].includes(body.messages[0].role))
  if (body.model === 'good' && body.messages[0].role === 'developer') return new Response('messages: Unexpected role developer. Allowed roles are user or assistant', { status: 400 })
  if (Array.isArray(body.messages.at(-1).content) && body.model === 'good') return new Response('data: ' + JSON.stringify({choices:[{delta:{content:readImageProbe(body)}}]}) + '\n\ndata: [DONE]\n\n')
  if (body.model === 'good' && body.reasoning_effort === '__deepviewer_invalid_effort__') return new Response('invalid reasoning_effort', { status: 400 })
  return new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n')
}
const read = () => ({ ns: 'llm-pi-ai', user: structuredClone(user), value: structuredClone(user), revision })
const mutate = async (ops, expected) => { assert.equal(expected, revision); for (const op of ops) user.providers[op.path[1]].models = op.value; revision++ }
const service = new ScanService({ read, mutate, resolveKey: async () => 'local-fixture', request, file: home + '/reports.json' })
async function wait(route) { for (let i = 0; i < 100 && service.status(route).status === 'running'; i++) await new Promise(r => setTimeout(r, 5)); return service.status(route) }
try {
 const declared = parseModelsDevCatalog({ anthropic: { models: { 'claude-sonnet-4': { modalities: { input: ['text', 'image'] }, reasoning: true, reasoning_options: { values: ['low', 'high'] } } } } })
 assert.deepEqual(resolveDeclaredCapability({ id: 'claude-sonnet-4-7', modelsDev: declared }), { modalities: ['text', 'image'], reasoning: { low: 'low', high: 'high' }, source: 'models.dev', confidence: 'family-matched' })
 assert.equal(resolveDeclaredCapability({ id: 'unlisted-model', modelsDev: declared }).source, 'probe')
 const budgetLimited = await scanModel({baseURL:'https://fixture.example/v1'}, 'fixture', {id:'budget-limited'}, new AbortController().signal, async (_url, init) => {
   const body = JSON.parse(init.body)
   if (body.messages[0].role === 'developer') return new Response('Unexpected role developer', {status:400})
   if (body.reasoning_effort) return new Response('max_tokens must exceed thinking budget_tokens', {status:400})
   return new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n')
 })
 assert.deepEqual(budgetLimited.compat,{supportsDeveloperRole:false}); assert.deepEqual(budgetLimited.efforts,[])
 await service.start('alpha'); const report = await wait('alpha')
 assert.equal(report.status, 'complete'); assert.deepEqual(report.results.find(x => x.id === 'good').efforts, ['low','medium','high'])
 assert.equal(report.results.find(x => x.id === 'ignored').efforts.length, 0)
 assert.equal(report.results.find(x => x.id === 'denied').availability, 'permission_denied')
 assert.equal(report.results.find(x => x.id === 'uncertain').availability, 'uncertain')
 assert.ok(!JSON.stringify(report).includes('local-fixture'))
 const before = structuredClone(user.providers.alpha.models)
 await service.apply('alpha', report.id, true)
 assert.equal(user.providers.alpha.models.some(x => x.id === 'denied'), true)
 assert.equal(user.providers.alpha.models.find(x => x.id === 'good').contextWindow, 4096)
 assert.deepEqual(user.providers.alpha.models.find(x => x.id === 'good').compat, { supportsStore: false, supportsDeveloperRole: false })
 assert.equal(requests.filter(x => x.model === 'good').length, LIMITS.requestsPerModel)
 assert.deepEqual(user.providers.alpha.models.find(x => x.id === 'good').input, ['text','image'])
 assert.equal(report.results.find(x => x.id === 'ignored').imageInput.status, 'uncertain')
 assert.ok(report.results.find(x => x.id === 'text-image-model').availability === 'available')
 assert.equal(user.providers.alpha.models.find(x => x.id === 'uncertain').reasoningEfforts.high, 'custom')
 assert.ok(user.providers.alpha.models.some(x => x.id === 'ignored'))
 await service.restore('alpha', report.id); assert.deepEqual(user.providers.alpha.models, before)
 await service.start('beta'); const beta = await wait('beta')
 user.providers.beta.baseURL = 'https://changed.example/v1'; revision++
 await assert.rejects(service.apply('beta', beta.id, true), /配置已变化/)
 assert.equal(service.status('beta').stale, true)
 assert.equal(service.status('alpha').stale, false)
 assert.throws(() => endpoint('https://user:password@example.com', 'models'))
 assert.throws(() => endpoint('http://external.example', 'models'))
 const restarted = new ScanService({ read, mutate, resolveKey: async () => 'local-fixture', request, file: home + '/reports.json' })
 assert.equal(restarted.status('alpha').status, 'complete'); restarted.dispose()
 const blockedRequest = (_url, init) => new Promise((resolve, reject) => { if (init.signal.aborted) return reject(Error('cancelled')); init.signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true }) })
 const cancel = new ScanService({ read, mutate, resolveKey: async () => 'local-fixture', request: blockedRequest })
 await cancel.start('alpha'); await assert.rejects(cancel.start('beta'), /已有扫描/); cancel.stop('alpha')
 for (let i=0;i<100 && cancel.status('alpha').status === 'running';i++) await new Promise(r=>setTimeout(r,5))
 assert.equal(cancel.status('alpha').status,'cancelled');cancel.dispose()
 // A 404 must be confirmed in two independent scan windows before apply can
 // remove the model; permission failures remain listed (covered above).
 const ghostHome = mkdtempSync(join(tmpdir(), 'deepviewer-delist-unit-'))
 let ghostRevision = 0
 const ghostUser = { providers: { ghost: { api: 'openai-completions', baseURL: 'https://ghost.example/v1', apiKeyEnv: 'LOCAL_SCAN_KEY', models: [{ id: 'ghost' }, { id: 'keep' }] } } }
 const ghostRead = () => ({ ns: 'llm-pi-ai', user: structuredClone(ghostUser), value: structuredClone(ghostUser), revision: ghostRevision })
 const ghostMutate = async (ops, expected) => { assert.equal(expected, ghostRevision); for (const op of ops) ghostUser.providers.ghost.models = op.value; ghostRevision++ }
 const ghostRequest = async (url, init) => {
   assert.equal(init.redirect, 'error')
   if (url.endsWith('/api/pricing')) return Response.json({ data: [] })
   assert.equal(init.headers.Authorization, 'Bearer local-fixture')
   if (url.endsWith('/models')) return Response.json({ data: [{ id: 'ghost' }, { id: 'keep' }] })
   const body = JSON.parse(init.body)
   if (body.model === 'ghost') return new Response('model_not_found', { status: 404 })
   return new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n')
 }
 const ghostService = new ScanService({ read: ghostRead, mutate: ghostMutate, resolveKey: async () => 'local-fixture', request: ghostRequest, file: ghostHome + '/reports.json' })
 const waitGhost = async () => { for (let i = 0; i < 200 && ghostService.status('ghost').status === 'running'; i++) await new Promise(r => setTimeout(r, 5)); return ghostService.status('ghost') }
 await ghostService.start('ghost'); const firstGhost = await waitGhost()
 assert.equal(firstGhost.results.find(x => x.id === 'ghost').listing.state, 'pending_removal')
 await ghostService.start('ghost'); const secondGhost = await waitGhost()
 assert.equal(secondGhost.results.find(x => x.id === 'ghost').listing.state, 'delisted')
 await ghostService.apply('ghost', secondGhost.id, true)
 assert.equal(ghostUser.providers.ghost.models.some(x => x.id === 'ghost'), false)
 assert.equal(ghostUser.providers.ghost.models.some(x => x.id === 'keep'), true)
 ghostService.dispose(); rmSync(ghostHome, { recursive: true, force: true })
 // Image failures must not mark a working text model unavailable or clear manual input.
 for (const [status, message, expected] of [[400,'This model does not support image input','unsupported'],[429,'rate limit','uncertain'],[400,'max_tokens budget exceeded','uncertain'],[400,'invalid image format','uncertain']]) {
   const result = await scanModel({baseURL:'https://fixture.example/v1'}, 'fixture', {id:'vision'}, new AbortController().signal, async (_url, init) => {
     const body=JSON.parse(init.body)
     return Array.isArray(body.messages.at(-1).content) ? new Response(message,{status}) : new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n')
   })
   assert.equal(result.availability,'available'); assert.equal(result.imageInput.status,expected)
   assert.deepEqual(mergedModels([{id:'vision',input:['text','image']}],[result],true)[0].input,['text','image'])
 }
 const imageView={user:{providers:{manual:{models:[{id:'m',input:['text'],compat:{supportsDeveloperRole:false}}]}}}}
 const edit=(mode)=>modelEdit(imageView,'manual','m','inherit',{},mode).value[0]
 assert.deepEqual(edit('image').input,['text','image']); assert.deepEqual(edit('text').input,['text']); assert.equal(edit('inherit').input,undefined)
 assert.deepEqual(edit('image').compat,{supportsDeveloperRole:false}); assert.throws(()=>edit('video'))
 service.jobs.get('alpha').scanVersion=SCAN_VERSION-1
 assert.equal(service.status('alpha').stale,true);await assert.rejects(service.apply('alpha',report.id),/扫描规则/)
 const cancelled=new AbortController();cancelled.abort();let called=false
 await assert.rejects(scanModel({baseURL:'https://fixture.example/v1'},'fixture',{id:'m'},cancelled.signal,async()=>{called=true}),/停止/);assert.equal(called,false)
 console.log('PASS: two generic providers, bounded probes, ignored-parameter guard, credential isolation, apply/restore, stale config refusal, persistence, cancellation and single-job limit')
} finally { service.dispose(); rmSync(home, { recursive: true, force: true }) }
