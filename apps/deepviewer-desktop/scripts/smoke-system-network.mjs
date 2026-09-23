// Headless Electron + the built DSH provider; no account, paid request, or user preference changes.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const upstream = resolve(appRoot, '../../upstream/deepseek-harness')
const buildRoot = join(appRoot, '.desktop/network-smoke')

if (!process.versions.electron) {
  const { build } = await import('vite')
  await build({ configFile: false, root: appRoot, logLevel: 'error', ssr: { noExternal: true },
    build: { ssr: 'src/main/network/bridge.ts', target: 'node24', outDir: buildRoot, emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'bridge.mjs' } } } })
  const profile = mkdtempSync(join(tmpdir(), 'deepviewer-network-smoke-'))
  const env = { ...process.env, DEEPVIEWER_NETWORK_SMOKE_PROFILE: profile }
  delete env.ELECTRON_RUN_AS_NODE
  try {
    process.exitCode = await new Promise((done, reject) => {
      const child = spawn(createRequire(import.meta.url)('electron'), [fileURLToPath(import.meta.url)], { cwd: appRoot, env, stdio: 'inherit' })
      child.once('error', reject); child.once('exit', code => done(code ?? 1))
    })
  } finally { rmSync(profile, { recursive: true, force: true }) }
} else {
  // Electron emits ready after evaluating its ESM entry: do not await it at module scope.
  void runElectronSmoke()
}
async function runElectronSmoke() {
  const { app, session } = await import('electron')
  app.setPath('userData', process.env.DEEPVIEWER_NETWORK_SMOKE_PROFILE)
  const timeout = setTimeout(() => { console.error('Network smoke timed out'); app.exit(1) }, 110_000)
  const bridges = [], servers = []
  let restore
  try {
    await app.whenReady()
    const { startNetworkBridge } = await import(pathToFileURL(join(buildRoot, 'bridge.mjs')).href)
    const { HttpFetchProvider } = await import(pathToFileURL(join(upstream, 'packages/web/web-fetch-http/lib/index.js')).href)
    const limits = { maxResponseBytes: 5_000_000, maxBodyChars: 2000, timeoutMs: 25_000, maxRedirects: 5, userAgent: 'DeepViewer-network-smoke' }
    const options = { resolveProxy: url => session.defaultSession.resolveProxy(url), proxyEnv: {}, ask: async () => 'deny', log: message => console.log(message) }
    const bridge = await startNetworkBridge(options); bridges.push(bridge)
    const provider = new HttpFetchProvider(limits, undefined, bridge.webUrl)
    for (const url of ['https://github.com/deepseek-ai/deepseek-harness', 'https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/fb2c4b9e698e30edb738bca4cf0618587db7d203/README.md']) {
      const result = await provider.fetch({ url })
      assert.equal(result.statusCode, 200); assert.ok(result.body.content.length > 0)
      console.log(`PASS public ${new URL(url).hostname} status=200`)
    }
    // This is an unauthenticated HEAD, not a search execution or token-consuming POST.
    const { installProxyFromEnvironment } = await import(pathToFileURL(join(upstream, 'packages/util/http-proxy/lib/index.js')).href)
    const proxyEnv = { HTTP_PROXY: bridge.proxyUrl, HTTPS_PROXY: bridge.httpsProxyUrl }
    restore = await installProxyFromEnvironment({ get: key => proxyEnv[key] ? { value: proxyEnv[key] } : undefined }, () => {})
    const search = await fetch('https://api.deepseek.com/anthropic/v1/messages', { method: 'HEAD', signal: AbortSignal.timeout(25_000) })
    assert.ok([401, 405].includes(search.status), `Unexpected search endpoint status ${search.status}`)
    await search.body?.cancel()
    console.log(`PASS search transport status=${search.status}; no authenticated search performed`)
    await restore(); restore = undefined

    let hits = 0, prompts = 0
    const server = createServer((_req, res) => { hits++; res.setHeader('content-type', 'text/plain'); res.end('local fixture') })
    servers.push(server); await new Promise(done => server.listen(0, '127.0.0.1', done))
    const target = `http://127.0.0.1:${server.address().port}/`
    await assert.rejects(provider.fetch({ url: target }), error => error.code === 'WEB_BLOCKED_URL')
    assert.equal(hits, 0)
    const allowed = await startNetworkBridge({ ...options, ask: async () => { prompts++; return 'run' } }); bridges.push(allowed)
    const local = new HttpFetchProvider(limits, undefined, allowed.webUrl)
    for (let i = 0; i < 2; i++) assert.equal((await local.fetch({ url: target })).body.content, 'local fixture')
    assert.equal(prompts, 1); assert.equal(hits, 2)
    // A cross-origin redirect must pass through the local authorization gate too.
    const redirect = createServer((_req, res) => res.writeHead(302, { location: target }).end())
    servers.push(redirect); await new Promise(done => redirect.listen(0, '127.0.0.1', done))
    let redirectPrompts = 0
    const conditional = await startNetworkBridge({ ...options, ask: async () => ++redirectPrompts === 1 ? 'once' : 'deny' }); bridges.push(conditional)
    await assert.rejects(new HttpFetchProvider(limits, undefined, conditional.webUrl).fetch({ url: `http://127.0.0.1:${redirect.address().port}/` }), error => error.code === 'WEB_BLOCKED_URL')
    assert.equal(redirectPrompts, 2); assert.equal(hits, 2)
    console.log('PASS DSH deny, allow, grant reuse, and redirected private-target authorization')
    console.log('PASS Electron system network smoke')
  } catch (error) {
    console.error(error); process.exitCode = 1
  } finally {
    await restore?.()
    for (const bridge of bridges) await bridge.close()
    for (const server of servers) { server.closeAllConnections(); await new Promise(done => server.close(done)) }
    clearTimeout(timeout); app.exit(process.exitCode ?? 0)
  }
}
