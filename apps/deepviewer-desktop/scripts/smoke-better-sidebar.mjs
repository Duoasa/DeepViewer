import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Script } from 'node:vm'
import { stageBetterSidebar, validateBetterSidebar } from './stage-better-sidebar.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = join(project, 'upstream/deepseek-harness')
const runtimeRoot = process.argv.find(arg => arg.startsWith('--runtime-root='))?.slice('--runtime-root='.length)
const electronHost = process.argv.includes('--electron-host')
const electronRequire = createRequire(join(project, 'package.json'))
if ((process.argv.includes('--host-only') || process.argv.includes('--mount-only')) && process.env.DEEPVIEWER_FULL_BROWSER_SMOKE === '1') throw new Error('Noninteractive smoke cannot enable browser interactions')
const plugin = runtimeRoot ? join(resolve(runtimeRoot), 'node_modules/dsh-better-sidebar') : stageBetterSidebar(upstream)
validateBetterSidebar(plugin)
const scratch = mkdtempSync(join(tmpdir(), 'deepviewer-sidebar-smoke-'))
const outsideScratch = mkdtempSync(join(tmpdir(), 'deepviewer-sidebar-outside-'))
const home = join(scratch, 'home')
mkdirSync(join(home, 'profiles/node_modules'), { recursive: true })
symlinkSync(plugin, join(home, 'profiles/node_modules/dsh-better-sidebar'), 'dir')
// Exercise the desktop's real profile preparation, including the disabled
// baseline used by fallback launches, rather than CLI-inserting the plugin.
const ts = electronRequire('typescript')
const locator = new Script(ts.transpileModule(readFileSync(join(project, 'apps/deepviewer-desktop/src/main/resource-locator.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText + '\nexports').runInNewContext({ exports: {}, require: electronRequire, process })
const enabledPatch = locator.prepareBetterSidebarProfile(home)
const disabledPatch = join(home, 'sidebar-disabled.patch.yml')
writeFileSync(disabledPatch, '- id: better-sidebar\n  disabled: true\n')
const patches = [disabledPatch, enabledPatch]
// A temporary, authenticated host probe checks tool registration without a
// model request, account or UI interaction. It is never staged into the app.
const probePath = join(scratch, 'sidebar-settings-probe.mjs')
writeFileSync(probePath, `export const inject = ['webServer', 'connection', 'tools'];
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/deepviewer-smoke/sidebar-tools', handler(req, res) {
    if (ctx.connection.requestRejection(req) !== undefined) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ sidebarOpen: ctx.tools.get('sidebar_open') !== undefined }));
  }}));
}`)
const probePatch = join(scratch, 'sidebar-settings-probe.patch.yml')
writeFileSync(probePatch, `- insert:\n    - id: deepviewer-sidebar-smoke-probe\n      name: ${JSON.stringify(probePath)}\n`)
patches.push(probePatch)
if (runtimeRoot) {
  for (const name of ['dsh-plugin-subscriptions', '@deepviewer/dsh-plugin-model-capabilities']) {
    const installed = join(resolve(runtimeRoot), 'node_modules', name)
    const link = join(home, 'profiles/node_modules', name)
    mkdirSync(dirname(link), { recursive: true })
    symlinkSync(installed, link, 'dir')
    patches.push(join(installed, 'cordis.patch.yml'))
  }
}
const entry = runtimeRoot ? join(resolve(runtimeRoot), 'node_modules/@deepseek-ai/dsh/lib/bin.js') : join(upstream, 'apps/cli/lib/bin.js')
const hostOptions = {
  cwd: scratch, env: { PATH: process.env.PATH, HOME: scratch, SHELL: '/bin/sh', DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', ...(electronHost ? { ELECTRON_RUN_AS_NODE: '1' } : {}) }, stdio: ['ignore', 'pipe', 'pipe'],
}
const startHost = activePatches => spawn(electronHost ? electronRequire('electron') : process.execPath,
  ['--expose-internals', entry, 'web', ...activePatches.flatMap(patch => ['--patch', patch]), '--port', '0', '--no-open'], hostOptions)
let child = startHost(patches)
let output = ''
let terminal
child.stdout.on('data', b => { output += b })
child.stderr.on('data', b => { output += b })
try {
  const deadline = Date.now() + 60000
  let match
  while (!(match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/))) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Sidebar host did not start: ' + output.replace(/token=\S+/g, 'token=[REDACTED]').slice(-4000))
    await new Promise(r => setTimeout(r, 100))
  }
  let url = new URL(match[1])
  if (electronHost) console.log('ELECTRON_HOST_READY: actual desktop Node-mode host booted successfully.')
  const bootstrap = await fetch(url, { redirect: 'manual' })
  assert.equal(bootstrap.status, 303)
  const cookie = bootstrap.headers.getSetCookie().map(v => v.split(';')[0]).join('; ')
  await bootstrap.body?.cancel()
  let headers = { cookie, origin: url.origin, 'content-type': 'application/json' }
  const restartHost = async activePatches => {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    await exited
    clearTimeout(timer)
    output = ''
    child = startHost(activePatches)
    child.stdout.on('data', b => { output += b })
    child.stderr.on('data', b => { output += b })
    const deadline = Date.now() + 60000
    let match
    while (!(match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/))) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error('Sidebar restart failed: ' + output.replace(/token=\S+/g, 'token=[REDACTED]').slice(-2000))
      await new Promise(r => setTimeout(r, 100))
    }
    url = new URL(match[1])
    const response = await fetch(url, { redirect: 'manual' })
    assert.equal(response.status, 303)
    headers = { ...headers, cookie: response.headers.getSetCookie().map(v => v.split(';')[0]).join('; '), origin: url.origin }
    await response.body?.cancel()
  }
  if (runtimeRoot) {
    const response = await fetch(`${url.origin}/subscriptions-auth/status`, { method: 'POST', headers, body: JSON.stringify({ type: 'client-request', rpcId: 'runtime-status', method: 'status', payload: {} }) })
    assert.equal(response.status, 200)
    const status = await response.json()
    assert.equal(status.result.ok, true)
    for (const provider of Object.values(status.result.value.providers)) assert.equal(provider.loggedIn, false)
    console.log('PACKED_RUNTIME_PLUGINS_OK: subscriptions, model capabilities and sidebar booted from the contained Runtime; all providers signed out.')
  }
  for (const name of ['terminal', 'editor', 'mermaid']) {
    const response = await fetch(`${url.origin}/sidebar/bundle/${name}.js`, { headers })
    assert.equal(response.status, 200, name)
    assert.ok((await response.text()).length > 1000, name)
  }
  const settings = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers, body: '{}' })
  assert.equal(settings.status, 200)
  const body = await settings.json()
  assert.equal(body.ok, true)
  assert.equal(typeof body.value?.value?.agentOpenTools, 'boolean', 'Sidebar settings must expose resolved preferences')
  assert.equal('bottomPanelAutoTerminal' in body.value.value, false, 'Removed workbench preference must not be served')
  assert.equal(typeof body.value.revision, 'number')
  const toolGate = async () => {
    const response = await fetch(`${url.origin}/deepviewer-smoke/sidebar-tools`, { headers })
    assert.equal(response.status, 200)
    return (await response.json()).sidebarOpen
  }
  const updatePrefs = (patch, expectedRevision) => fetch(`${url.origin}/sidebar/api/settings.update`, {
    method: 'POST', headers, body: JSON.stringify({ patch, expectedRevision }),
  })
  assert.equal(body.value.value.agentOpenTools, false)
  assert.equal(await toolGate(), false)
  const enabled = await updatePrefs({ agentOpenTools: true }, body.value.revision)
  const enabledBody = await enabled.json()
  assert.equal(enabled.status, 200, JSON.stringify(enabledBody))
  assert.equal(enabledBody.ok, true)
  assert.equal(enabledBody.value.value.agentOpenTools, true)
  assert.ok(enabledBody.value.revision > body.value.revision)
  assert.equal(await toolGate(), true, 'Enabling the preference must register sidebar_open live')
  assert.match(readFileSync(join(home, 'profiles/web/cordis.patch.yml'), 'utf8'), /agentOpenTools: true/, 'Preference must be persisted to the writable profile')
  const stale = await updatePrefs({ agentOpenTools: false }, body.value.revision)
  assert.equal(stale.status, 409)
  assert.equal((await stale.json()).error.code, 'settings-conflict')
  const invalid = await updatePrefs({ agentOpenTools: 'invalid' }, enabledBody.value.revision)
  assert.equal(invalid.status, 400)
  await invalid.body?.cancel()
  assert.equal(await toolGate(), true, 'Rejected writes must preserve the active tool')
  const disabled = await updatePrefs({ agentOpenTools: false }, enabledBody.value.revision)
  assert.equal(disabled.status, 200)
  assert.equal((await disabled.json()).value.value.agentOpenTools, false)
  assert.equal(await toolGate(), false, 'Disabling the preference must unregister sidebar_open live')
  console.log('SIDEBAR_SETTINGS_OK: read/write, live sidebar_open registration/removal, stale revision and invalid-value rejection.')
  const denied = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.ok([401, 403].includes(denied.status))
  await denied.body?.cancel()
  const hostile = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers: { ...headers, origin: 'https://untrusted.example' }, body: '{}' })
  assert.ok([401, 403].includes(hostile.status))
  await hostile.body?.cancel()
  const fullBrowserSmoke = process.env.DEEPVIEWER_FULL_BROWSER_SMOKE === '1'
  let sessionRequest = { cwd: scratch }
  if (fullBrowserSmoke) {
    const workspace = await fetch(`${url.origin}/api/workspace/create`, { method: 'POST', headers,
      body: JSON.stringify({ type: 'client-request', rpcId: 'workspace-smoke', method: 'workspace/create', payload: { args: { request: { path: scratch } } } }) })
    const result = await workspace.json()
    assert.equal(result.result?.ok, true, JSON.stringify(result))
    sessionRequest = { workspaceId: result.result.value.workspace.workspaceId }
  }
  const created = await fetch(`${url.origin}/api/session/create`, {
    method: 'POST', headers,
    body: JSON.stringify({ type: 'client-request', rpcId: 'sidebar-preview-smoke', method: 'session/create', payload: { args: { request: sessionRequest } } }),
  })
  const sessionResult = await created.json()
  assert.equal(sessionResult.result?.ok, true, JSON.stringify(sessionResult))
  const sessionId = sessionResult.result.value.sessionId
  // Exercise the staged native-tab adapter, then request its actual media URL.
  const client = readFileSync(join(plugin, 'lib/client.js'), 'utf8')
  const functions = ['isAbsolutePath$1', 'resolveSidebarPath', 'fileUrl', 'createNativeTabRecords'].map(name => {
    const start = client.indexOf(`function ${name}(`)
    assert.ok(start >= 0, `Missing sidebar function: ${name}`)
    return client.slice(start, client.indexOf('\n\t\t}', start) + 5)
  }).join('\n')
  const { records, fileUrl } = new Script(functions + '\n({ records: createNativeTabRecords(), fileUrl })').runInNewContext({ URLSearchParams })
  const scope = { sessionId, cwd: scratch }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
  const imageName = '跑车 #1%.png'
  writeFileSync(join(scratch, imageName), png)
  const broken = await fetch(url.origin + fileUrl(scope, imageName, false), { headers })
  assert.equal(broken.status, 400, 'Host rejects unadapted relative image paths')
  await broken.body?.cancel()
  let imageUrl
  for (const path of [imageName, join(scratch, imageName)]) {
    const view = records.ensure({ id: path, kind: 'editor', title: imageName, params: { path }, scope })
    assert.equal(view.tab.path, join(scratch, imageName))
    imageUrl = fileUrl(scope, view.tab.path, false)
    const image = await fetch(url.origin + imageUrl, { headers })
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
  }
  const anonymousImage = await fetch(url.origin + imageUrl)
  assert.ok([401, 403].includes(anonymousImage.status))
  await anonymousImage.body?.cancel()
  writeFileSync(join(outsideScratch, 'outside.png'), png)
  const escaped = records.ensure({ id: 'escape', kind: 'editor', params: { path: `../${basename(outsideScratch)}/outside.png` }, scope })
  const outside = await fetch(url.origin + fileUrl(scope, escaped.tab.path, false), { headers })
  assert.equal(outside.status, 403, 'Workspace fence still rejects traversal')
  await outside.body?.cancel()
  console.log('SIDEBAR_IMAGE_PATH_OK: card-relative and picker-absolute paths load identical PNG bytes; auth and workspace fence remain enforced.')
  const previewPath = join(scratch, 'preview.html')
  writeFileSync(previewPath, '<!doctype html><html><body>Preview<script src="./preview.js"></script></body></html>')
  writeFileSync(join(scratch, 'preview.js'), 'localStorage.setItem("sidebar-smoke", "ok"); document.body.dataset.ready = "yes";')
  const previewUrl = `/sidebar/html/${encodeURIComponent(sessionId)}/${previewPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`
  const preview = await fetch(url.origin + previewUrl, { headers })
  assert.equal(preview.status, 200)
  assert.doesNotMatch(preview.headers.get('content-security-policy') ?? '', /sandbox/)
  await preview.body?.cancel()
  const anonymousPreview = await fetch(url.origin + previewUrl)
  assert.ok([401, 403].includes(anonymousPreview.status))
  await anonymousPreview.body?.cancel()
  let rendererOutput = ''
  if (!process.argv.includes('--host-only')) {
  const browserConfig = join(scratch, 'renderer-config.json')
  writeFileSync(browserConfig, JSON.stringify({ origin: url.origin, cookie, previewUrl, sessionId, imageUrl }), { mode: 0o600 })
  const rendererEnv = { ...process.env, DEEPVIEWER_SMOKE_MOUNT_ONLY: process.argv.includes('--mount-only') ? '1' : '0' }
  delete rendererEnv.ELECTRON_RUN_AS_NODE
  const renderer = spawn(electronRequire('electron'), [join(project, process.env.DEEPVIEWER_FULL_BROWSER_SMOKE === '1' ? 'apps/deepviewer-desktop/scripts/fixtures/full-sidebar-browser-smoke.cjs' : 'apps/deepviewer-desktop/scripts/fixtures/sidebar-renderer-smoke.cjs'), browserConfig], { env: rendererEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  renderer.stdout.on('data', data => { rendererOutput += data })
  renderer.stderr.on('data', data => { rendererOutput += data })
  const rendererTimer = setTimeout(() => renderer.kill('SIGKILL'), 35000)
  const [rendererCode] = await once(renderer, 'exit')
  clearTimeout(rendererTimer)
  assert.equal(rendererCode, 0, rendererOutput.slice(-2500))
  assert.match(rendererOutput, /SIDEBAR_RENDERER_MOUNTED/)
  }
  if (fullBrowserSmoke) {
    assert.match(rendererOutput, /FULL_DSH_BROWSER_SWITCH_OK/)
    console.log('FULL_DSH_BROWSER_SWITCH_OK: actual app tab switching preserves guest, unsaved input, scroll and navigation history.')
  }
  const require = createRequire(join(plugin, 'package.json'))
  terminal = require('node-pty').spawn('/bin/sh', ['-c', 'printf DEEPVIEWER_PTY_OK'], { cwd: scratch, env: { PATH: '/usr/bin:/bin', HOME: scratch }, cols: 80, rows: 24 })
  let terminalOutput = ''
  terminal.onData(data => { terminalOutput += data })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PTY timeout')), 5000)
    terminal.onExit(() => { clearTimeout(timer); resolve() })
  })
  assert.match(terminalOutput, /DEEPVIEWER_PTY_OK/)
  // Confirm saved preferences survive a new host, then exercise the desktop's
  // disabled fallback without modifying an account or opening any UI.
  const beforeRestart = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers, body: '{}' }).then(r => r.json())
  const saveForRestart = await updatePrefs({ agentOpenTools: true }, beforeRestart.value.revision)
  assert.equal(saveForRestart.status, 200)
  await saveForRestart.body?.cancel()
  await restartHost(patches)
  const restored = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers, body: '{}' }).then(r => r.json())
  assert.equal(restored.value.value.agentOpenTools, true)
  assert.equal(await toolGate(), true)
  await restartHost(patches.filter(patch => patch !== enabledPatch))
  assert.equal(await toolGate(), false)
  const fallbackSettings = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers, body: '{}' })
  // The web app's fallback router may answer POST with 405 instead of 404.
  assert.ok([404, 405].includes(fallbackSettings.status))
  await fallbackSettings.body?.cancel()
  console.log('SIDEBAR_RESTART_OK: persisted preference and tool restored; disabled fallback boots without sidebar tools or routes.')
  console.log('Better Sidebar smoke passed: pinned host, authenticated settings, editor/terminal/mermaid chunks, anonymous/cross-origin denial, native PTY and authenticated HTML preview.' +
    (process.argv.includes('--host-only') ? ' Host-only; no renderer or UI interaction.' : process.argv.includes('--mount-only') ? ' Hidden renderer startup and HTML script/storage checked; no UI interaction.' : fullBrowserSmoke ? ' Real DSH browser tab lifecycle checked.' : ' Isolated renderer and HTML relative script/storage checked.'))
} finally {
  try { terminal?.kill() } catch {}
  if (child.exitCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    await exited
    clearTimeout(timer)
  }
  rmSync(scratch, { recursive: true, force: true })
  rmSync(outsideScratch, { recursive: true, force: true })
}
