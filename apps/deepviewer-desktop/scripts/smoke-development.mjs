import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Optional Playwright module path keeps the smoke usable with a host-provided runner.
const { _electron } = await import(process.env.DEEPVIEWER_PLAYWRIGHT_MODULE ?? 'playwright')
const require = createRequire(import.meta.url)
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const evidenceRoot = mkdtempSync(join(tmpdir(), 'deepviewer-dsh015-smoke-'))
const results = []

for (const subscriptions of [true, false]) {
  const userData = join(evidenceRoot, subscriptions ? 'default' : 'core')
  const env = { ...process.env, DEEPVIEWER_PROFILE: 'development', DEEPVIEWER_DEV_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.DEEPSEEK_API_KEY
  delete env.DEEPSEEK_BASE_URL
  delete env.DEEPSEEK_SEARCH_BASE_URL
  env.DEEPVIEWER_DISABLE_SUBSCRIPTIONS = subscriptions ? '0' : '1'
  const electron = await _electron.launch({ executablePath: require('electron'), args: [appRoot], cwd: appRoot, env, timeout: 45_000 })
  let runtimePid
  try {
    const page = await electron.firstWindow()
    const errors = []
    const pluginResponses = new Set()
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => {
      const url = new URL(response.url())
      if (url.pathname.includes('/plugins/') && response.ok()) pluginResponses.add(decodeURIComponent(url.pathname))
    })
    await page.waitForURL(url => url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.search === '', { timeout: 60_000 })
    await page.waitForFunction(() => document.documentElement.dataset.deepviewerMacosChromeInstalled === 'true', { timeout: 30_000 })
    await page.waitForFunction(() => document.querySelector('style[data-plugin="@deepseek-ai/dsh-client-ui-sidebar-documentpreview"]') !== null, { timeout: 30_000 })
    await page.getByRole('button', { name: /^(继续|Continue)$/ }).click()
    // The provider prompt is mounted after the informational onboarding closes.
    // Wait briefly for it rather than racing its first render with Settings.
    const configureLater = page.getByRole('button', { name: /^(稍后配置|Configure later)$/ })
    try { await configureLater.waitFor({ state: 'visible', timeout: 3_000 }); await configureLater.click() }
    catch (error) { if (error.name !== 'TimeoutError') throw error }
    await page.screenshot({ path: join(evidenceRoot, 'after-onboarding.png') })
    await page.getByRole('button', { name: /^(设置|Settings)$/ }).click()
    await page.getByRole('button', { name: /^(模型|Models)$/ }).click()
    await page.screenshot({ path: join(evidenceRoot, 'models.png') })
    if (subscriptions) {
      await page.getByRole('heading', { name: /^(订阅|Subscriptions)$/ }).waitFor()
      await page.getByText('Codex (ChatGPT)', { exact: true }).waitFor()
      const statusProbe = await page.evaluate(async () => {
        const response = await fetch('/subscriptions-auth/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'status', payload: {} }) })
        return { status: response.status, body: await response.text() }
      })
      assert.equal(statusProbe.status, 200)
      const status = JSON.parse(statusProbe.body)
      assert.equal(status.result.ok, true)
      for (const provider of Object.values(status.result.value.providers)) assert.equal(provider.loggedIn, false)
      await page.getByText(/^(未登录|Not logged in)$/).first().waitFor({ timeout: 5_000 })
    }
    await page.keyboard.press('Escape')
    const logPath = join(userData, 'logs/deepviewer.log')
    const logs = readFileSync(logPath, 'utf8')
    assert.match(logs, /ready origin=http:\/\/127\.0\.0\.1:/)
    assert.match(logs, /PREVIEW_OFFICIAL DSH=0\.1\.5-rc\.2/)
    assert.doesNotMatch(logs, /FALLBACK|START_FAILED|PREVIEW_ENABLED/)
    assert.match(logs, subscriptions ? /SUBSCRIPTIONS_ENABLED version=0.3.1/ : /SUBSCRIPTIONS_DISABLED/)
    assert.doesNotMatch(logs, /[?&]token=(?!\[REDACTED\])[^\s]+/)
    assert.deepEqual(errors, [], 'renderer boot must not throw')
    runtimePid = Number(logs.match(/spawned pid=(\d+)/)?.[1])
    assert.ok(runtimePid > 0)
    const runtimeUrl = page.url()
    const unauthenticated = await fetch(runtimeUrl)
    assert.equal(unauthenticated.status, 401)
    await unauthenticated.body?.cancel()
    if (subscriptions) {
      const unauthenticatedRpc = await fetch(new URL('/subscriptions-auth/status', runtimeUrl), { method: 'POST' })
      assert.equal(unauthenticatedRpc.status, 401)
      await unauthenticatedRpc.body?.cancel()
    }
    const runtime = await electron.evaluate(({ app }) => ({ arch: process.arch, node: process.versions.node, userData: app.getPath('userData') }))
    assert.equal(runtime.arch, 'arm64')
    assert.equal(runtime.userData, userData)
    await page.screenshot({ path: join(evidenceRoot, subscriptions ? 'default.png' : 'core.png') })
    results.push({ subscriptions, runtime, cleanAuthenticatedUrl: true, unauthenticatedStatus: 401, subscriptionStatus: subscriptions ? '200 / three signed-out providers; unauthenticated RPC 401' : 'disabled', chromeInstalled: true, officialPreviewLoaded: true, rendererErrors: errors, pluginResponses: [...pluginResponses], logPath })
  } finally {
    await electron.close()
    if (runtimePid !== undefined) {
      let alive = true
      for (let attempt = 0; attempt < 25; attempt++) {
        try { process.kill(runtimePid, 0) } catch { alive = false; break }
        await new Promise(resolvePromise => setTimeout(resolvePromise, 100))
      }
      assert.equal(alive, false, 'closing the app must stop its runtime')
    }
  }
}
writeFileSync(join(evidenceRoot, 'result.json'), `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify({ passed: true, evidenceRoot, configurations: results.length }))
