import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const plugin=process.env.MODEL_CAPABILITIES_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=fs.mkdtempSync(path.join(tmpdir(),'deepviewer-capabilities-host-'));
const upstream=process.env.DSH_ROOT;
const nativeModules=process.env.SMOKE_NATIVE_MODULES==='1';
if(!upstream)throw Error('Set DSH_ROOT to the pinned DSH source/installation root');
const home=path.join(root,'isolated-home');
fs.mkdirSync(path.join(home,'profiles/web/node_modules/@deepviewer'),{recursive:true,mode:0o700});
if(!nativeModules)fs.symlinkSync(plugin,path.join(home,'profiles/web/node_modules/@deepviewer/dsh-plugin-model-capabilities'));
fs.writeFileSync(path.join(home,'.credentials.yaml'),JSON.stringify({version:1,refs:{REVIEW_KEY:'fixture-only'}}),{mode:0o600});
fs.writeFileSync(path.join(home,'settings.yaml'),JSON.stringify({'llm-pi-ai':{providers:{review:{api:'openai-completions',baseURL:'https://fixture.invalid/v1',apiKeyEnv:'REVIEW_KEY',models:[{id:'review-model',name:'Review model',contextWindow:4096,maxTokens:256}]}}}}),{mode:0o600});
fs.writeFileSync(path.join(root,'network-fixture.mjs'),`
const original=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(url.hostname==='fixture.invalid'){
  if(url.pathname.endsWith('/models'))return Response.json({data:[{id:'review-model'}]});
  const body=JSON.parse(options.body);
  if(Array.isArray(body.messages.at(-1).content))return Response.json({error:{message:'image input not supported'}},{status:400});
  if(body.reasoning_effort==='__dsh_invalid_effort__')return Response.json({error:{message:'invalid reasoning_effort'}},{status:400});
  return Response.json({choices:[{message:{content:'OK'},finish_reason:'stop'}]});
 }
 if(['127.0.0.1','localhost'].includes(url.hostname))return original(input,options);
 return new Response('{}',{status:404});
};
`);
const extraPatches=[];
for(const installed of nativeModules?[]:JSON.parse(process.env.SMOKE_EXTRA_PLUGIN_ROOTS || '[]')){
 const manifest=JSON.parse(fs.readFileSync(path.join(installed,'package.json'),'utf8'));
 const link=path.join(home,'profiles/web/node_modules',manifest.name);
 fs.mkdirSync(path.dirname(link),{recursive:true});fs.symlinkSync(installed,link);
 extraPatches.push('--patch',path.join(installed,'cordis.patch.yml'));
}
let legacy;
if(process.env.SMOKE_LEGACY_SCANS==='1'){
 legacy=JSON.stringify({version:2,jobs:[{route:'review',id:'legacy',status:'complete',scanVersion:1,results:[{note:'old-secret-echo'}]}],models:{}});
 fs.writeFileSync(path.join(home,'deepviewer-model-scans.json'),legacy,{mode:0o600});
}
const extraRoots=nativeModules?[]:JSON.parse(process.env.SMOKE_EXTRA_PLUGIN_ROOTS || '[]');
fs.writeFileSync(path.join(home,'profiles/web/package.json'),JSON.stringify({name:'deepviewer-capability-smoke',private:true,dependencies:nativeModules?{}:{'@deepviewer/dsh-plugin-model-capabilities':JSON.parse(fs.readFileSync(path.join(plugin,'package.json'),'utf8')).version,...Object.fromEntries(extraRoots.map(directory=>{const manifest=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));return [manifest.name,manifest.version]}))},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app',...(nativeModules?[]:['@deepviewer/dsh-plugin-model-capabilities',...extraRoots.map(directory=>JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')).name)])]}}}),{mode:0o600});
const cliRoot=process.env.SMOKE_CLI_ROOT || path.join(upstream,'apps/cli');
const child=spawn(process.execPath,['--expose-internals','--import',path.join(root,'network-fixture.mjs'),path.join(cliRoot,'lib/bin.js'),'web','--port','0','--no-open'],{cwd:home,env:{PATH:process.env.PATH,HOME:home,DSH_HOME:home,DSH_TELEMETRY_MODE:'DISABLED'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
try{
 let url;for(let i=0;i<150;i++){url=logs.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)?.[0];if(url||child.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}
 if(!url)throw Error('Host not ready');
 const origin=new URL(url).origin;
 const auth=await fetch(url,{redirect:'manual'});
 const cookie=auth.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 async function rpc(method,args,channel='/api/'){
  const response=await fetch(origin+channel+method,{method:'POST',headers:{'content-type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method,payload:channel==='/api/'?{args}:args})});
  const body=await response.text();assert.equal(response.ok,true,`${method}: HTTP ${response.status} ${body.slice(0,600)}`);const result=JSON.parse(body);assert.equal(result.result?.ok,true,JSON.stringify(result));return result.result.value;
 }
 const scan=(method,args)=>rpc(method,args,'/dsh-model-capabilities/');
 const html=await(await fetch(origin,{headers:{Cookie:cookie}})).text();
 assert.ok(html.includes('@deepviewer/dsh-plugin-model-capabilities'));
 await rpc('settings/describe',{});
 assert.equal((await scan('status',{route:'review'})).status,legacy ? 'interrupted' : 'new');
 assert.ok(!html.includes('@deepviewer/dsh-plugin-reasoning'));
 assert.ok(!html.includes('@deepviewer/dsh-plugin-reasoning'));
 const catalogBefore=await rpc('session/modelCatalog',{});
 assert.equal(catalogBefore.groups.find(group=>group.id==='review').models[0].reasoning,undefined);
 if(extraPatches.length){
  assert.ok(html.includes('dsh-plugin-subscriptions'));
  const subscriptions=await rpc('status',{},'/subscriptions-auth/');
  for(const provider of Object.values(subscriptions.providers))assert.equal(provider.loggedIn,false);
  assert.ok(!html.includes('dsh-better-sidebar'));
 }

 await scan('start',{route:'review'});
 let report;for(let i=0;i<100;i++){report=await scan('status',{route:'review'});if(report.status!=='running')break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(report.status,'complete',JSON.stringify(report));
 assert.deepEqual(report.results[0].reasoning.levels,['low','medium','high']);
 const applied=await scan('apply',{route:'review',id:report.id});assert.equal(applied.canRestore,true);
 const catalogAfter=await rpc('session/modelCatalog',{});
 assert.deepEqual(catalogAfter.groups.find(group=>group.id==='review').models[0].reasoning.efforts.map(level=>level.id),['off','low','medium','high']);
 const restored=await scan('restore',{route:'review',id:report.id});assert.equal(restored.canRestore,false);
 assert.equal((await rpc('session/modelCatalog',{})).groups.find(group=>group.id==='review').models[0].reasoning,undefined);
 await scan('apply',{route:'review',id:report.id});
 const settings=await rpc('settings/describe',{});
 const view=settings.namespaces.find(view=>view.ns==='llm-pi-ai');
 const models=view.user.providers.review.models;
 assert.equal(models[0].compat.supportsUsageInStreaming,false);
 const edited=await scan('edit',{route:'review',id:'review-model',models,revision:view.revision});
 assert.equal(edited.stale,true);assert.equal(edited.canRestore,false);
 const saved=JSON.parse(fs.readFileSync(path.join(home,'deepviewer-model-capability-scans.json'),'utf8'));
 assert.equal(saved.version,4);assert.ok(!JSON.stringify(saved).includes('fixture-only'));
 if(legacy){assert.equal(fs.readFileSync(path.join(home,'deepviewer-model-scans.json'),'utf8'),legacy);assert.ok(!JSON.stringify(saved).includes('old-secret-echo'));}
 console.log('PASS: built plugin loads on pinned RC2; client advertised; authenticated scan/apply/restore/manual-edit RPC; native effort catalog; private v4 store; fake API only.');
}catch(error){console.error(String(error));process.exitCode=1;}
finally{
 fs.writeFileSync(path.join(root,'host.log'),logs.replace(/token=[^\s]+/g,'token=REDACTED'),{mode:0o600});
 console.log('Isolated smoke artifacts:',root);
 if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>{const timer=setTimeout(()=>{child.kill('SIGKILL');r();},3000);child.once('exit',()=>{clearTimeout(timer);r();});});}
}
