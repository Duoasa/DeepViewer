import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Script } from 'node:vm'
import { stageBetterSidebar } from './stage-better-sidebar.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = join(project, 'upstream/deepseek-harness')
const plugin = stageBetterSidebar(upstream)
const scratch = mkdtempSync(join(tmpdir(), 'deepviewer-sidebar-smoke-'))
const outsideScratch = mkdtempSync(join(tmpdir(), 'deepviewer-sidebar-outside-'))
const home = join(scratch, 'home')
mkdirSync(join(home, 'profiles/node_modules'), { recursive: true })
symlinkSync(plugin, join(home, 'profiles/node_modules/dsh-better-sidebar'), 'dir')
const child = spawn(process.execPath, ['--expose-internals', join(upstream, 'apps/cli/lib/bin.js'), 'web', '--patch', join(plugin, 'cordis.patch.yml'), '--port', '0', '--no-open'], {
  cwd: scratch, env: { PATH: process.env.PATH, HOME: scratch, SHELL: '/bin/sh', DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
})
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
  const url = new URL(match[1])
  const bootstrap = await fetch(url, { redirect: 'manual' })
  assert.equal(bootstrap.status, 303)
  const cookie = bootstrap.headers.getSetCookie().map(v => v.split(';')[0]).join('; ')
  await bootstrap.body?.cancel()
  const headers = { cookie, origin: url.origin, 'content-type': 'application/json' }
  for (const name of ['terminal', 'editor', 'mermaid']) {
    const response = await fetch(`${url.origin}/sidebar/bundle/${name}.js`, { headers })
    assert.equal(response.status, 200, name)
    assert.ok((await response.text()).length > 1000, name)
  }
  const settings = await fetch(`${url.origin}/sidebar/api/settings.get`, { method: 'POST', headers, body: '{}' })
  assert.equal(settings.status, 200)
  const body = await settings.json()
  assert.equal(body.ok, true)
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
  const browserConfig = join(scratch, 'renderer-config.json')
  writeFileSync(browserConfig, JSON.stringify({ origin: url.origin, cookie, previewUrl, sessionId, imageUrl }), { mode: 0o600 })
  const electronRequire = createRequire(join(project, 'package.json'))
  const rendererEnv = { ...process.env }
  delete rendererEnv.ELECTRON_RUN_AS_NODE
  const renderer = spawn(electronRequire('electron'), [join(project, process.env.DEEPVIEWER_FULL_BROWSER_SMOKE === '1' ? 'apps/deepviewer-desktop/scripts/fixtures/full-sidebar-browser-smoke.cjs' : 'apps/deepviewer-desktop/scripts/fixtures/sidebar-renderer-smoke.cjs'), browserConfig], { env: rendererEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  let rendererOutput = ''
  renderer.stdout.on('data', data => { rendererOutput += data })
  renderer.stderr.on('data', data => { rendererOutput += data })
  const rendererTimer = setTimeout(() => renderer.kill('SIGKILL'), 35000)
  const [rendererCode] = await once(renderer, 'exit')
  clearTimeout(rendererTimer)
  assert.equal(rendererCode, 0, rendererOutput.slice(-2500))
  assert.match(rendererOutput, /SIDEBAR_RENDERER_MOUNTED/)
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
  console.log('Better Sidebar smoke passed: pinned host, authenticated settings, editor/terminal/mermaid chunks, anonymous/cross-origin denial, native PTY, authenticated HTML preview, isolated renderer mount.' +
    (fullBrowserSmoke ? ' Real DSH browser tab lifecycle checked.' : ' HTML relative script/storage checked.'))
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
