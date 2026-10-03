import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'), root=resolve(appRoot,'../..'), fixture=mkdtempSync(join(tmpdir(),'deepviewer-web-state-'))
const electron=createRequire(join(appRoot,'package.json'))('electron'), tsx=createRequire(join(root,'upstream/deepseek-harness/package.json')).resolve('tsx/esm/api')
writeFileSync(join(fixture,'package.json'),JSON.stringify({name:'deepviewer-web-state-smoke',main:'main.cjs'}))
writeFileSync(join(fixture,'main.cjs'), `
const {app,BrowserWindow,protocol}=require('electron'), {createServer}=require('node:http'), fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const home=${JSON.stringify(join(fixture,'user-data'))}
app.setPath('userData',home)
app.on('window-all-closed',()=>{})
protocol.registerSchemesAsPrivileged([{scheme:'dsh-app',privileges:{standard:true,secure:true,supportFetchAPI:true}}])
app.whenReady().then(async()=>{
 let server,source,target
 try{
  protocol.handle('dsh-app',()=>new Response('<!doctype html><title>DeepViewer state fixture</title>',{headers:{'content-type':'text/html'}}))
  const {register}=await import(${JSON.stringify(pathToFileURL(tsx).href)});register()
  const {prepareWebState}=await import(${JSON.stringify(pathToFileURL(join(root,'apps/deepviewer-adapter/migrations/web-state.ts')).href)})
  server=createServer((req,res)=>res.end('<!doctype html><title>Legacy fixture</title>'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin='http://127.0.0.1:'+server.address().port
  source=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});await source.loadURL(origin)
  await source.webContents.executeJavaScript('localStorage.setItem("dsh.conversation.fixture",JSON.stringify({draft:"preserved draft",view:null}));localStorage.setItem("api-key","excluded credential")')
  source.destroy();source=undefined;await new Promise(resolve=>server.close(resolve));server=undefined
  fs.mkdirSync(path.join(home,'logs'),{recursive:true});fs.writeFileSync(path.join(home,'logs/deepviewer.log'),'INFO runtime ready origin='+origin+'\\n')
  await prepareWebState(home)
  target=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,preload:${JSON.stringify(join(root,'apps/deepviewer-adapter/desktop/preload-state.cjs'))}}});await target.loadURL('dsh-app://app/')
  const values=await target.webContents.executeJavaScript('({draft:localStorage.getItem("dsh.conversation.fixture"),credential:localStorage.getItem("api-key")})')
  assert.equal(JSON.parse(values.draft).draft,'preserved draft');assert.equal(values.credential,null)
  await target.webContents.executeJavaScript('localStorage.setItem("dsh.conversation.fixture",JSON.stringify({draft:"new edit",view:null}))');await target.reload()
  await new Promise(resolve=>target.webContents.once('did-finish-load',resolve))
  assert.equal(JSON.parse(await target.webContents.executeJavaScript('localStorage.getItem("dsh.conversation.fixture")')).draft,'new edit')
  const backup=JSON.parse(fs.readFileSync(path.join(home,'.deepviewer-web-state-v1.json'),'utf8'));assert.equal(backup.values['api-key'],undefined)
  assert.equal(fs.statSync(path.join(home,'.deepviewer-web-state-v1.json')).mode & 0o777,0o600)
  assert.ok(fs.existsSync(path.join(home,'.deepviewer-web-state-imported-v1.json')))
  console.info(JSON.stringify({result:'PASS',realElectronOrigins:true,draftPreserved:true,credentialsExcluded:true,newValuesNotOverwritten:true,privateBackup:true}));target.destroy();app.quit()
 }catch(error){console.error(error);source?.destroy();target?.destroy();server?.close();app.exit(1)}
})
setTimeout(()=>app.exit(1),30000).unref()
`)
try{const child=spawn(electron,[fixture],{cwd:appRoot,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>{output+=chunk.toString();process.stdout.write(chunk)});child.stderr.pipe(process.stderr);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});if(code!==0 || !output.includes('"result":"PASS"'))throw new Error('Real-origin frontend migration smoke failed')}finally{rmSync(fixture,{recursive:true,force:true})}
