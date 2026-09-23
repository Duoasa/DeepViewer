import { build } from 'vite'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(join(project, 'package.json'))
const scratch = mkdtempSync(join(tmpdir(), 'deepviewer-native-browser-'))
try {
  await build({configFile:false,logLevel:'error',build:{emptyOutDir:false,outDir:scratch,lib:{entry:join(project,'apps/deepviewer-desktop/src/main/sidebar-browser.ts'),formats:['cjs'],fileName:()=> 'host.cjs'},rollupOptions:{external:['electron']}}})
  const source = readFileSync(join(project, 'apps/deepviewer-desktop/scripts/sidebar-browser-client.js'), 'utf8')
  const tabBodies = readFileSync(join(project,'apps/deepviewer-desktop/upstream-overrides/dsh-015/browser-tab-lifetime.fragment'),'utf8')
  writeFileSync(join(scratch,'entry.tsx'), `import * as react from 'react'; import {createRoot} from 'react-dom/client';
const React=react; const sidebar_module_css_default = {}; ${source}
window.mountBrowser = (id, url) => {
 const div = document.createElement('div'); div.style.height='400px'; document.body.append(div);
 const root = createRoot(div); root.render(react.createElement(BrowserView, {tab:{id,path:url},ctx:{get:()=>({updateTab:()=>{}})}}));
 return () => {root.unmount();div.remove()};
};
const css={};
function TabGroup({tabs,activeId}) {
 const state={tabs}; const pane={tabs:tabs.map(t=>t.id)}; const getTab=(s,id)=>s.tabs.find(t=>t.id===id); const active=tabs.find(t=>t.id===activeId);
 const callbacks={labels:{emptyPane:''},renderTab:tab=>react.createElement(BrowserView,{tab,ctx:{get:()=>({updateTab:()=>{}})}})};
 return <>${tabBodies}</>;
}
window.mountGroup=(urls)=>{
 const div=document.createElement('div');div.style.height='400px';document.body.append(div);const root=createRoot(div);
 let tabs=urls.map((path,i)=>({id:'kept-'+i,kind:'browser',path}));
 window.selectGroup=id=>root.render(react.createElement(TabGroup,{tabs,activeId:id}));
 window.closeGroup=id=>{tabs=tabs.filter(t=>t.id!==id);window.selectGroup(tabs[0]?.id)};
 window.selectGroup('kept-0');
};`)
  symlinkSync(join(project,'node_modules'),join(scratch,'node_modules'),'dir')
  await build({configFile:false,logLevel:'error',resolve:{alias:{'react-dom/client':join(project,'upstream/deepseek-harness/node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js'),react:join(project,'upstream/deepseek-harness/node_modules/.pnpm/react@18.3.1/node_modules/react')}},define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{emptyOutDir:false,outDir:scratch,lib:{entry:join(scratch,'entry.tsx'),formats:['iife'],name:'BrowserSmoke',fileName:()=> 'renderer.js'}}})
  writeFileSync(join(scratch, 'index.html'), '<!doctype html><html><meta charset="utf-8"><body><script src="renderer.js"></script></body></html>')
  writeFileSync(join(scratch, 'preload.cjs'), `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('deepviewerDesktop',{onBrowserOpen: fn=>{ipcRenderer.on('browser:open-url',(_,url)=>fn(url));return ()=>{};}});`)
  const fixture = join(project, 'apps/deepviewer-desktop/scripts/fixtures/native-browser-smoke.cjs')
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE
  for(const phase of ['initial','restore']) {
  const child = spawn(require('electron'), [fixture, scratch, phase], {env,stdio:['ignore','pipe','pipe']})
  let output=''; child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b)
  const timer=setTimeout(()=>child.kill('SIGKILL'),45000)
  const [code]=await once(child,'exit');clearTimeout(timer)
  if(code!==0) throw new Error(output)
  console.log(output.split('\n').filter(line=>line.includes('_OK')).join('\n'))
  }
} finally { rmSync(scratch,{recursive:true,force:true}) }
