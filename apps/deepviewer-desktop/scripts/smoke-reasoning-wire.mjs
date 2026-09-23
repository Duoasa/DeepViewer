import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const store=resolve(root, 'upstream/deepseek-harness/node_modules/.pnpm'),entry=readdirSync(store).find(x=>x.startsWith('@earendil-works+pi-ai@'))
const {streamSimple}=await import(pathToFileURL(resolve(store,entry,'node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js')))
for(const supportsDeveloperRole of [true,false]) for(const level of ['low','medium','high']){
 let captured
 const stream=streamSimple({id:'claude-sonnet-5',name:'Smoke',api:'openai-completions',provider:'easyrouter',baseUrl:'http://127.0.0.1:1/v1',reasoning:true,compat:{supportsDeveloperRole},thinkingLevelMap:{off:null,minimal:null,low:'low',medium:'medium',high:'high',xhigh:null,max:null},input:['text'],contextWindow:4096,maxTokens:256,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}, {systemPrompt:'Keep this instruction intact.',messages:[{role:'user',content:'Smoke only',timestamp:Date.now()}]}, {apiKey:'local-smoke-no-key',reasoning:level,onPayload:p=>{captured=p;throw Error('stop-before-network')}})
 await stream.result();assert.equal(captured?.reasoning_effort,level);assert.equal(captured.messages[0].role,supportsDeveloperRole?'developer':'system');assert.equal(captured.messages[0].content,'Keep this instruction intact.')
}
console.log('PASS: native SDK preserves system instructions and effort values with developer compatibility on/off; no network requests')

// The native SDK must preserve an admitted image in the OpenAI-compatible wire payload.
let imagePayload
const imageStream=streamSimple({id:'vision-fixture',name:'Vision',api:'openai-completions',provider:'fixture',baseUrl:'http://127.0.0.1:1/v1',reasoning:false,input:['text','image'],contextWindow:4096,maxTokens:256,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}, {messages:[{role:'user',content:[{type:'text',text:'Describe this image.'},{type:'image',data:'fixture-base64',mimeType:'image/png'}],timestamp:Date.now()}]}, {apiKey:'local-smoke-no-key',onPayload:p=>{imagePayload=p;throw Error('stop-before-network')}})
await imageStream.result()
assert.equal(imagePayload.messages[0].content.find(p=>p.type==='image_url').image_url.url,'data:image/png;base64,fixture-base64')
console.log('PASS: native SDK preserves image data URL; no network requests')
