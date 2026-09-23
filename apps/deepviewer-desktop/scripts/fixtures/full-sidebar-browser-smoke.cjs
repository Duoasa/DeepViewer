// Exercises the real DSH app, slot dispatch and tab controls, with an isolated profile.
const {app,BrowserWindow,webContents,session}=require('electron')
const {readFileSync,writeFileSync}=require('node:fs')
const {join,dirname}=require('node:path')
const {createServer}=require('node:http')
const assert=require('node:assert/strict')
const config=JSON.parse(readFileSync(process.argv[2],'utf8'))
const scratch=dirname(process.argv[2]);app.setPath('userData',join(scratch,'full-renderer-data'))
let win,server
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await sleep(100)}throw Error('Timeout: '+label+' '+await run(`document.body.innerText.slice(0,5000)`))}
const run=code=>win.webContents.executeJavaScript(code,true)
app.whenReady().then(async()=>{
 for(const pair of config.cookie.split('; ')){const i=pair.indexOf('=');await session.defaultSession.cookies.set({url:config.origin,name:pair.slice(0,i),value:pair.slice(i+1),httpOnly:true,sameSite:'lax'})}
 const preload=join(scratch,'browser-preload.cjs');writeFileSync(preload,"require('electron').contextBridge.exposeInMainWorld('deepviewerDesktop',{onBrowserOpen:()=>()=>{}})")
 server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<title>${req.url}</title><a id="next" href="/next">Next</a><input id="draft"><div style="height:3000px"></div>`)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`
 win=new BrowserWindow({show:false,width:1500,height:950,webPreferences:{preload,webviewTag:true,contextIsolation:true,nodeIntegration:false,sandbox:true}})
 await win.loadURL(config.origin)
 await until(()=>run(`!!document.querySelector('[data-dsh-better-sidebar]')`),'app mount')
 await run(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='继续')?.click()`)
 await until(()=>run(`!![...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='稍后配置')`),'isolated onboarding')
 await run(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='稍后配置').click()`)
 await until(()=>run(`!!document.querySelector('[role="treeitem"][aria-selected]')`),'session row')
 await run(`document.querySelector('[role="treeitem"][aria-selected]').click()`)
 await sleep(400)
 for(const path of ['/first','/second']) {
  await run(`(()=>{const a=document.createElement('a');a.href=${JSON.stringify(origin)}+${JSON.stringify(path)};a.textContent='Test link';document.body.append(a);a.click();a.remove()})()`)
  await sleep(500)
 }
 const guests=()=>webContents.getAllWebContents().filter(w=>w.getType()==='webview')
 await until(()=>guests().length===2&&guests().every(w=>!w.isLoading()),'two real sidebar guests')
 const first=guests().find(w=>w.getURL().endsWith('/first'));assert.ok(first)
 await first.executeJavaScript(`document.querySelector('#next').click()`,true)
 await until(()=>first.getURL().endsWith('/next')&&!first.isLoading(),'navigate first guest')
 await first.executeJavaScript(`document.querySelector('#draft').value='keep this';window.scrollTo(0,550);window.instanceProof='original'`)
 // Find the actual tab strip control by its record id, exposed by the keep-alive wrapper.
 const ids=await run(`JSON.stringify([...document.querySelectorAll('[data-deepviewer-tab-body]')].filter(e=>e.querySelector('webview')).map(e=>e.dataset.deepviewerTabBody))`)
 const tabIds=JSON.parse(ids);assert.equal(tabIds.length,2)
 for(const id of [tabIds[0],tabIds[1],tabIds[0]]) {
  const selected=await run(`(()=>{const el=document.querySelector('[data-dockkit-tab="'+${JSON.stringify(id)}+'"]');el?.click();return !!el})()`)
  if(!selected) throw Error('Real tab chip selector missing: '+await run(`JSON.stringify([...document.querySelectorAll('[role="tab"]')].map(e=>e.outerHTML.slice(0,600)))`))
  await until(()=>run(`(()=>{const chip=document.querySelector('[data-dockkit-tab="'+${JSON.stringify(id)}+'"]');const body=document.querySelector('[data-deepviewer-tab-body="'+${JSON.stringify(id)}+'"]');return chip?.getAttribute('aria-selected')==='true'&&body&&getComputedStyle(body).display==='flex'})()`),'selected tab is visible')
  assert.equal(guests().length,2,'switching must neither drop nor duplicate a guest')
 }
 assert.equal(first.isDestroyed(),false)
 assert.deepEqual(await first.executeJavaScript(`({draft:document.querySelector('#draft').value,scroll:window.scrollY,proof:window.instanceProof})`),{draft:'keep this',scroll:550,proof:'original'})
 assert.equal(first.navigationHistory.canGoBack(),true)
 console.log('SIDEBAR_RENDERER_MOUNTED FULL_DSH_BROWSER_SWITCH_OK')
 win.destroy();server.close();app.exit(0)
}).catch(e=>{console.error(e);win?.destroy();server?.close();app.exit(1)})
