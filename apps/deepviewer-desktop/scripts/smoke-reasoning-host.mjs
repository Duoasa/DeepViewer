import { readImageProbe } from './fixtures/image-probe-fixture.mjs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), upstream=resolve(root,'upstream/deepseek-harness')
const home=mkdtempSync('/private/tmp/deepviewer-reasoning-smoke-')
mkdirSync(home+'/profiles/node_modules/@deepviewer',{recursive:true})
symlinkSync(upstream+'/node_modules/@deepviewer/dsh-plugin-reasoning',home+'/profiles/node_modules/@deepviewer/dsh-plugin-reasoning')
const requests=[]
const fake=createServer(async(req,res)=>{
 if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'smoke-model'},{id:'blocked-model'}]}));return}
 let text='';for await(const chunk of req)text+=chunk
 const body=JSON.parse(text);requests.push(body)
 assert.equal(req.headers.authorization,'Bearer fixture-only')
 assert.equal(body.max_tokens,128)
 if(body.model==='blocked-model'){res.writeHead(403);res.end('denied');return}
 if(body.messages[0].role==='developer'){res.writeHead(400);res.end('messages: Unexpected role developer. Allowed roles are user or assistant');return}
 if(body.reasoning_effort==='__deepviewer_invalid_effort__'){res.writeHead(400);res.end('invalid reasoning_effort');return}
 if(Array.isArray(body.messages.at(-1).content)){res.setHeader('Content-Type','text/event-stream');res.end('data: '+JSON.stringify({choices:[{delta:{content:readImageProbe(body)}}]})+'\n\ndata: [DONE]\n\n');return}
 res.setHeader('Content-Type','text/event-stream');res.end('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n')
})
await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve))
const fakeBase='http://127.0.0.1:'+fake.address().port+'/v1'
writeFileSync(home+'/.credentials.yaml',JSON.stringify({version:1,refs:{SCAN_FIXTURE_KEY:'fixture-only'}}),{mode:0o600})
writeFileSync(home+'/settings.yaml', JSON.stringify({'llm-pi-ai':{providers:{smoke:{api:'openai-completions',baseURL:fakeBase,apiKeyEnv:'SCAN_FIXTURE_KEY',models:[{id:'smoke-model',name:'Smoke model',contextWindow:4096,maxTokens:256}]}}}}))
const child=spawn(process.execPath,['--expose-internals',upstream+'/apps/cli/lib/bin.js','web','--patch',upstream+'/node_modules/@deepviewer/dsh-plugin-reasoning/cordis.patch.yml','--port','0','--no-open'],{env:{...process.env,DSH_HOME:home},stdio:['ignore','pipe','pipe']})
let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',x=>logs+=x)
try {
 let url;for(let i=0;i<100;i++){url=logs.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)?.[0];if(url)break;if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,200))}
 if(!url)throw Error('Host not ready: '+logs.replace(/token=[^\s]+/g,'token=REDACTED').slice(-3500))
 const auth=await fetch(url,{redirect:'manual'}),cookie=auth.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),origin=new URL(url).origin
 async function rpc(endpoint,payload={},channel='/api/') {const r=await fetch(origin+channel+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:channel==='/api/'?{args:payload}:payload})});const text=await r.text();if(!r.ok)throw Error('RPC '+r.status+' '+text.slice(0,400));const answer=JSON.parse(text).result;if(!answer.ok)throw Error(JSON.stringify(answer.error));return answer.value}
 console.log('Host started; isolated home:',home)
 const result=await rpc('settings/describe');console.log('describe namespaces:',result.namespaces.length)
 const catalog=await rpc('session/modelCatalog'); assert.equal(catalog.groups.find(x=>x.id==='smoke').models[0].reasoning,undefined)
 const namespace=result.namespaces.find(x=>x.ns==='llm-pi-ai')
 const models=structuredClone(namespace.user.providers.smoke.models)
 models[0].reasoningEfforts={low:'low',high:'high'}
 const payload={ns:'llm-pi-ai',ops:[{op:'set',path:['providers','smoke','models'],value:models}],expectedRevision:namespace.revision}
 const saved=await rpc('settings/mutate',payload)
 const updated=await rpc('session/modelCatalog')
 assert.deepEqual(updated.groups.find(x=>x.id==='smoke').models[0].reasoning.efforts.map(x=>x.id),['low','high'])
 await assert.rejects(rpc('settings/mutate',payload),/revision|conflict|stale/i)
 await rpc('settings/mutate',{...payload,ops:[{...payload.ops[0],value:namespace.user.providers.smoke.models}],expectedRevision:saved.revision})
 const restored=await rpc('session/modelCatalog')
 assert.equal(restored.groups.find(x=>x.id==='smoke').models[0].reasoning,undefined)
 const html=await (await fetch(origin+'/',{headers:{Cookie:cookie}})).text()
 assert.ok(html.includes('@deepviewer/dsh-plugin-reasoning'),'Native client must be advertised by the Host')
 const scan=(method,payload)=>rpc(method,payload,'/deepviewer-model-scans/')
 assert.equal((await scan('status',{route:'smoke'})).status,'new')
 await scan('start',{route:'smoke'})
 let report
 for(let i=0;i<100;i++){report=await scan('status',{route:'smoke'});if(report.status!=='running')break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(report.status,'complete')
 assert.deepEqual(report.results.find(x=>x.id==='smoke-model').efforts,['low','medium','high'])
 assert.equal(report.results.find(x=>x.id==='blocked-model').availability,'unavailable')
 await scan('apply',{route:'smoke',id:report.id,exclude:true})
 const savedScan=(await rpc('settings/describe')).namespaces.find(x=>x.ns==='llm-pi-ai')
 assert.equal(savedScan.user.providers.smoke.models[0].compat.supportsDeveloperRole,false)
 assert.deepEqual(savedScan.user.providers.smoke.models[0].input,['text','image'])
 const scannedCatalog=await rpc('session/modelCatalog')
 assert.deepEqual(scannedCatalog.groups.find(x=>x.id==='smoke').models[0].reasoning.efforts.map(x=>x.id),['low','medium','high'])
 // modelCatalog exposes picker fields only; the upload gate uses resolveModelInfo.
 const {Context}=await import(pathToFileURL(upstream+'/vendor/cordis/lib/index.js'))
 const {default:Llm}=await import(pathToFileURL(upstream+'/packages/llm/llm/lib/index.js'))
 const PiAi=await import(pathToFileURL(upstream+'/packages/llm/llm-pi-ai/lib/index.js'))
 const ctx=new Context(), forks=[]
 try {
   forks.push(await ctx.plugin(Llm));forks.push(await ctx.plugin(PiAi,{providers:{smoke:savedScan.user.providers.smoke}}))
   assert.deepEqual((await ctx.llm.resolveModelInfo('smoke','smoke-model')).inputModalities,['text','image'])
 } finally {for(const fork of forks.reverse()) fork.dispose()}

 await scan('restore',{route:'smoke',id:report.id})
 assert.equal((await rpc('session/modelCatalog')).groups.find(x=>x.id==='smoke').models[0].reasoning,undefined)
 assert.equal(requests.length,9)
 const appliedView=(await rpc('settings/describe')).namespaces.find(x=>x.ns==='llm-pi-ai')
 assert.equal(appliedView.user.providers.smoke.models[0].compat?.supportsDeveloperRole,undefined)
 console.log('PASS: authenticated plugin scan RPC, local fake API, capability apply/restore, settings CAS and native model catalog; no external model requests')
}finally{fake.close();if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(()=>{child.kill('SIGKILL');r()},2000)})}}
