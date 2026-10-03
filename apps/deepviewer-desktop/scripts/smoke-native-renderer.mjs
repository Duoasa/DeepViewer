import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'), fixture = mkdtempSync(join(tmpdir(), 'deepviewer-renderer-'))
const electron = createRequire(join(appRoot, 'package.json'))('electron')
writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'deepviewer-renderer-smoke', version: '0.7.0', main: 'main.cjs' }))
const presentationSmoke = readFileSync(new URL('../../deepviewer-adapter/presentation/smoke-renderer.js.txt', import.meta.url), 'utf8')
writeFileSync(join(fixture, 'main.cjs'), `
const { app, BrowserWindow, dialog } = require('electron')
const fs = require('node:fs'), path = require('node:path')
app.getAppPath = () => ${JSON.stringify(appRoot)}
app.getVersion = () => '0.7.0'
BrowserWindow.prototype.show = function() {}
BrowserWindow.prototype.showInactive = function() {}
dialog.showErrorBox = (title, error) => { console.error(title, error); process.exitCode = 1; app.exit(1) }
let finished = false
function finish(result, error) { if (finished) return; finished = true; console.info(JSON.stringify({result: error ? 'FAIL' : 'PASS', ...result, error})); if (error) app.exit(1); else app.quit() }
app.on('web-contents-created', (_, contents) => {
 contents.on('console-message', (_, details) => { if (details.level === 'error') console.error('renderer:', details.message) })
 contents.on('did-finish-load', async () => {
  if (!contents.getURL().startsWith('dsh-app://app/')) return
  const window = BrowserWindow.fromWebContents(contents)
  const minimum = window?.getMinimumSize()
  if (!minimum || minimum[0] !== 900 || minimum[1] !== 640) return finish({}, 'DeepViewer minimum window size is not 900x640')
  for (let i = 0; i < 360 && !finished; i++) {
   try { const state = await contents.executeJavaScript('({boot:!!document.querySelector("[data-dsh-boot]"), deepviewer:document.body.innerText.includes("DeepViewer"), workChat:document.body.innerText.includes("Work") && document.body.innerText.includes("Chat"), hero:!!document.querySelector("[data-deepviewer-hero]"), failed:document.querySelector("[data-dsh-boot]")?.innerText.includes("Failed"), text:document.body.innerText.slice(0,1500)})')
    if (state.failed) return finish({}, state.text)
    if (!state.boot && state.deepviewer && state.workChat) { window.setSize(1400,800); await new Promise(resolve => setTimeout(resolve,100)); const presentation = await contents.executeJavaScript(${JSON.stringify(presentationSmoke)}).catch(error => { throw new Error('Presentation smoke: ' + error.message) }); window.setSize(320, 300); const size = window.getSize(); if (size[0] < 900 || size[1] < 640) return finish({}, 'Window shrank below the safe minimum'); return finish({nativeRenderer:true, minimumWindowSize:[900,640], brand:true, workChat:true, hero:state.hero, ...presentation}) }
   } catch (error) { if (contents.isDestroyed()) return; if (String(error).includes('Presentation smoke:')) return finish({},String(error)) }
   await new Promise(resolve => setTimeout(resolve,250))
  }
 })
})
setTimeout(() => finish({},'Native renderer did not become ready within 90 seconds'),95000).unref()
import(${JSON.stringify(pathToFileURL(join(appRoot, 'lib/main.js')).href)}).catch(error => finish({},String(error)))
`)
const environment = { ...process.env, DEEPVIEWER_DEV_USER_DATA: join(fixture, 'user-data'), DEEPVIEWER_PROFILE: 'development', DSH_TELEMETRY_MODE: 'DISABLED' }
for (const key of Object.keys(environment)) if (/KEY|TOKEN|SECRET|PASSWORD/u.test(key)) delete environment[key]
delete environment.ELECTRON_RUN_AS_NODE
try {
 const child = spawn(electron, [fixture], { cwd: appRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
 const sanitize = chunk => chunk.toString().replace(/([?&]token=)[^&\s]+/gu, '$1[REDACTED]')
 let output = ''
 child.stdout.on('data', chunk => { output += sanitize(chunk); process.stdout.write(sanitize(chunk)) }); child.stderr.on('data', chunk => process.stderr.write(sanitize(chunk)))
 const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) }); if (code !== 0 || !output.includes('"result":"PASS"')) throw new Error(`Renderer smoke did not pass (exit ${code})`)
} finally { rmSync(fixture, { recursive: true, force: true }) }
