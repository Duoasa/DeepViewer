import { load, dump } from 'js-yaml'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'), root = resolve(appRoot, '../..'), upstream = join(root, 'upstream/deepseek-harness')
const { register } = await import(createRequire(join(upstream, 'package.json')).resolve('tsx/esm/api')); register()
const { prepareDesktopProfile } = await import(join(root, 'apps/deepviewer-adapter/migrations/desktop-profile.ts'))
const { DesktopHostProcess } = await import(join(upstream, 'apps/desktop/src/host-process.ts'))
const { DesktopProjectManager } = await import(join(upstream, 'apps/desktop/src/project-manager.ts'))
const { resolveDesktopPaths } = await import(join(upstream, 'apps/desktop/src/paths.ts'))
const fixture = mkdtempSync(join(tmpdir(), 'deepviewer-070-host-')), home = join(fixture, 'home'), runtime = process.env.DEEPVIEWER_RUNTIME_OVERRIDE ?? join(appRoot, '.desktop/native-runtime')
const stdout = process.stdout.write.bind(process.stdout)
process.stdout.write = (chunk, ...args) => stdout(chunk.toString().replace(/([?&]token=)[^&\s]+/gu, '$1[REDACTED]'), ...args)
let host
const modelServer = createServer((request, response) => {
  request.resume()
  response.writeHead(200, { 'content-type': 'text/event-stream' })
  response.end('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'fixture', choices: [{ index: 0, delta: { role: 'assistant', content: 'Fixture complete.' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n')
})
await new Promise(resolve => modelServer.listen(0, '127.0.0.1', resolve))
try {
  process.env.DSH_HOME = home
  const integrations = ['@deepviewer/adapter', '@deepviewer/dsh-plugin-model-capabilities', 'dsh-plugin-subscriptions'].map(name => { const directory = join(runtime, 'node_modules', name); return { name, directory, version: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version } })
  prepareDesktopProfile(home, runtime, integrations)
  const paths = resolveDesktopPaths(home)
  writeFileSync(join(home, '.credentials.yaml'), JSON.stringify({ version: 1, refs: { SMOKE_KEY: 'fixture-only' } }), { mode: 0o600 })
  writeFileSync(join(home, 'settings.yaml'), dump({ 'llm-pi-ai': { providers: { fixture: { api: 'openai-completions', baseURL: `http://127.0.0.1:${modelServer.address().port}/v1`, apiKeyEnv: 'SMOKE_KEY', models: [{ id: 'fixture', name: 'Fixture model', contextWindow: 128000, maxTokens: 1024 }] } } } }), { mode: 0o600 })
  await new DesktopProjectManager(paths, { dsh: runtime }).applyRelease()
  const patch = load(readFileSync(join(paths.profile, 'cordis.patch.yml'), 'utf8')); writeFileSync(join(paths.profile, 'cordis.patch.yml'), dump([...(patch ?? []), { id: 'webserver', config: { host: '127.0.0.1', port: 0 } }]))
  const environment = { ...process.env, DSH_HOME: home, DEEPVIEWER_HOST_PORT: '0', DSH_TELEMETRY_MODE: 'DISABLED', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' }
  for (const key of Object.keys(environment)) if (/KEY|TOKEN|SECRET|PASSWORD/u.test(key)) delete environment[key]
  const createHost = () => new DesktopHostProcess(process.execPath, runtime, paths.profile, undefined, environment, undefined, process.env.DSH_DESKTOP_PRIMARY_RUNTIME_DIR ?? join(appRoot, '.desktop/runtime/primary-runtime'), { pnpm: join(appRoot, 'node_modules/pnpm/bin/pnpm.mjs'), nodeBin: join(appRoot, 'scripts/node-bin') })
  host = createHost()
  const ready = await host.start()
  assert.equal(new URL(ready.url).hostname, '127.0.0.1')
  assert.ok(ready.injections?.length)
  const unauthenticated = await fetch(new URL('/api', ready.url), { redirect: 'manual' })
  assert.equal(unauthenticated.status, 401)
  const authenticated = await fetch(ready.url, { redirect: 'manual' })
  const cookies = authenticated.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const document = await fetch(new URL('/', ready.url), { headers: { cookie: cookies } })
  assert.equal(document.status, 200)
  const html = await document.text(); assert.ok(html.includes('__DSH_BOOT__'))
  for (const integration of integrations) assert.ok(html.includes(integration.name), `Missing active integration: ${integration.name}`); assert.ok(!html.includes('dsh-better-sidebar'))
  let origin = new URL(ready.url).origin, cookie = cookies
  async function rpc(method, args, channel = '/api/', expected = true) {
    const response = await fetch(origin + channel + method, { method: 'POST', headers: { 'content-type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: channel === '/api/' ? { args } : args }), signal: AbortSignal.timeout(15000) })
    const body = await response.text(); assert.equal(response.ok, true, `HTTP ${response.status}: ${method} ${body.slice(0,600)}`)
    const result = JSON.parse(body); assert.equal(result.result?.ok, expected, JSON.stringify(result)); return expected ? result.result.value : result.result.error
  }
  await rpc('status', {}, '/subscriptions-auth/')
  await rpc('status', { route: 'fixture' }, '/dsh-model-capabilities/')
  const anonymousMap = await fetch(origin + '/deepviewer-synapse/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(anonymousMap.status, 401)
  const bundles = await rpc('pluginManager/listBundles', {})
  for (const integration of integrations) assert.ok(!bundles.some(bundle => bundle.name === integration.name), `Built-in exposed as a managed bundle: ${integration.name}`)
  const preparedManifest = JSON.parse(readFileSync(join(paths.profile,'package.json'),'utf8'))
  for (const integration of integrations) { assert.ok(!preparedManifest.dsh.profile.bundles.includes(integration.name)); assert.ok(!Object.hasOwn(preparedManifest.dependencies ?? {},integration.name)) }
  const workspace = join(fixture, 'workspace'); mkdirSync(workspace); writeFileSync(join(workspace, 'file.txt'), 'original')
  const work = await rpc('session/create', { request: { sessionId: 'smoke-work', cwd: workspace } })
  const chat = await rpc('session/create', { request: { sessionId: 'smoke-chat', agentPreset: 'deepviewer-chat' } })
  await rpc('session/create', { request: { sessionId: 'bad-chat', agentPreset: 'deepviewer-chat', cwd: workspace } }, '/api/', false)
  await rpc('session/rename', { request: { sessionId: work.sessionId, title: 'DeepViewer Work cold fixture' } })
  await rpc('session/rename', { request: { sessionId: chat.sessionId, title: 'DeepViewer Chat cold fixture' } })
  for (const session of [work, chat]) {
    await rpc('session/selectModel', { request: { sessionId: session.sessionId, provider: 'fixture', model: 'fixture' } })
    await rpc('session/prompt', { request: { requestId: crypto.randomUUID(), sessionId: session.sessionId, mode: 'queue', content: [{ type: 'text', text: 'deepviewer-cold-search-fixture' }] } })
  }
  for (let i = 0; await host.updateTasks('inspect'); i++) { assert.ok(i < 100, 'Fixture model did not settle'); await new Promise(resolve => setTimeout(resolve,100)) }
  const file = await rpc('editor.read', { sessionId: work.sessionId, path: 'file.txt' }, '/deepviewer-workspace/')
  await rpc('editor.save', { sessionId: work.sessionId, path: 'file.txt', text: 'saved', version: file.version }, '/deepviewer-workspace/')
  assert.equal(readFileSync(join(workspace, 'file.txt'), 'utf8'), 'saved')
  await rpc('editor.read', { sessionId: chat.sessionId, path: join(workspace, 'file.txt') }, '/deepviewer-workspace/', false)
  await rpc('editor.read', { sessionId: work.sessionId, path: join(fixture, 'outside') }, '/deepviewer-workspace/', false)
  await host.stop(true)
  host = createHost()
  const restarted = await host.start(); origin = new URL(restarted.url).origin
  const reauth = await fetch(restarted.url, { redirect: 'manual' }); cookie = reauth.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const cold = await rpc('session/list', { _request: {} })
  const coldWork = cold.items.find(item => item.sessionId === work.sessionId), coldChat = cold.items.find(item => item.sessionId === chat.sessionId)
  assert.ok(coldWork); assert.ok(coldChat); assert.equal(coldChat.cwd, undefined); assert.equal(coldChat.projections.values.agentPreset, 'deepviewer-chat')
  assert.deepEqual((await rpc('session/search', { request: { query: 'deepviewer-cold-search-fixture', mode: 'chat' } })).items.map(item => item.sessionId), [chat.sessionId])
  assert.deepEqual((await rpc('session/search', { request: { query: 'deepviewer-cold-search-fixture', mode: 'work' } })).items.map(item => item.sessionId), [work.sessionId])
  const projections = await rpc('session/projections', { request: { sessionId: chat.sessionId } })
  const history = await rpc('session/page', { request: { address: { kind: 'session', sessionId: chat.sessionId }, throughSeq: projections.asOfSeq } })
  assert.ok(JSON.stringify(history).includes('deepviewer-cold-search-fixture'))
  const mapList = await rpc('request', { path: '/synapse/api/workspaces' }, '/deepviewer-synapse/')
  assert.ok(mapList.workspaces.length >= 1)
  const mapped = []
  for (const workspace of mapList.workspaces) {
    const result = await rpc('request', { path: '/synapse/api/workspaces/' + workspace.id }, '/deepviewer-synapse/')
    mapped.push(...result.workspace.threads)
  }
  for (const session of [work, chat]) {
    const thread = mapped.find(item => item.dshSessionId === session.sessionId)
    assert.ok(thread, 'Cold session missing from native map')
    assert.ok(JSON.stringify(thread.messages).includes('deepviewer-cold-search-fixture'))
  }
  await rpc('request', { path: '/synapse/api/reset', method: 'POST' }, '/deepviewer-synapse/', false)
  await rpc('session/rename', { request: { sessionId: chat.sessionId, title: 'Resumed Chat' } })
  await rpc('editor.read', { sessionId: chat.sessionId, path: join(workspace, 'file.txt') }, '/deepviewer-workspace/', false)
  await host.stop(true); host = undefined
  // Official recovery disables user plugins. Application-owned modules stay available.
  await new DesktopProjectManager(paths, { dsh: runtime }).disableAllPlugins()
  prepareDesktopProfile(home, runtime, integrations)
  const recoveredManifest = JSON.parse(readFileSync(join(paths.profile,'package.json'),'utf8'))
  for (const plugin of integrations) assert.ok(!recoveredManifest.dsh.profile.bundles.includes(plugin.name))
  host = createHost(); const recovered = await host.start(); origin = new URL(recovered.url).origin
  const recoveryLogin = await fetch(recovered.url, { redirect: 'manual' }); cookie = recoveryLogin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  await rpc('status', {}, '/subscriptions-auth/')
  await rpc('status', { route: 'fixture' }, '/dsh-model-capabilities/')
  const recoveryBundles = await rpc('pluginManager/listBundles', {})
  for (const integration of integrations) assert.ok(!recoveryBundles.some(bundle => bundle.name === integration.name))
  await rpc('session/create', { request: { sessionId: 'recovered-core', cwd: workspace } })
  await host.stop(true); host = undefined
  // The diagnostic flag wins over a stale explicit enable override and opens pure native core.
  writeFileSync(join(paths.profile,'cordis.patch.yml'),dump([{id:'model-capabilities',disabled:false}]))
  environment.DEEPVIEWER_DISABLE_BUILTINS = '1'
  host = createHost(); const diagnostic = await host.start(); origin = new URL(diagnostic.url).origin
  const diagnosticLogin = await fetch(diagnostic.url,{redirect:'manual'}); cookie = diagnosticLogin.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
  const diagnosticHtml = await (await fetch(new URL('/',diagnostic.url),{headers:{cookie}})).text()
  for (const integration of integrations) assert.ok(!diagnosticHtml.includes(integration.name), `Diagnostic flag did not disable native module: ${integration.name}`)
  await rpc('session/create', { request: { sessionId: 'diagnostic-core', cwd: workspace } })
  await host.stop(true); host = undefined
  console.info(JSON.stringify({ result: 'PASS', core: '0.2.0-rc.2', privateHost: true, integrationRPC: true, nativeSynapse: true, nativeModules: true, noManagedBundles: true, workChatIsolation: true, coldHistory: true, editorRPC: true, integrations: integrations.map(plugin => plugin.name), nativeRecovery: true, diagnosticPureCore: true, gracefulShutdown: true }))
} finally { await host?.stop(); await new Promise(resolve => modelServer.close(resolve)); rmSync(fixture, { recursive: true, force: true }) }
