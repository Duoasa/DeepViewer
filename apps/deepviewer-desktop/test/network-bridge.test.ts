import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, request, type Server } from 'node:http'
import { createConnection, type AddressInfo } from 'node:net'
import { startNetworkBridge, type NetworkBridge } from '../src/main/network/bridge.js'

const bridges: NetworkBridge[] = [], servers: Server[] = []
afterEach(async () => {
  await Promise.all(bridges.splice(0).map(b => b.close()))
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
async function origin() {
  const hits = vi.fn()
  const server = createServer((req, res) => { hits(req.headers); res.writeHead(200, { 'content-type': 'text/plain', 'set-cookie': 'secret=never-forward' }).end('fixture') })
  servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { port: (server.address() as AddressInfo).port, hits }
}
async function bridge(overrides: Partial<Parameters<typeof startNetworkBridge>[0]> = {}) {
  const b = await startNetworkBridge({ resolveProxy: async () => 'DIRECT', proxyEnv: {}, ask: async () => 'deny', log: () => {}, ...overrides })
  bridges.push(b); return b
}
async function web(b: NetworkBridge, target: string, authorized = true) {
  const url = new URL(b.webUrl), secret = url.password; url.username = ''; url.password = ''
  return fetch(url, { method: 'POST', headers: { 'x-deepviewer-target': target, ...(authorized ? { authorization: `Bearer ${secret}` } : {}), cookie: 'browser=must-not-leak' } })
}
describe('authenticated desktop bridge', () => {
  it('supports ordinary HTTP proxy clients without forwarding proxy credentials', async () => {
    let received: unknown
    const server = createServer((req, res) => {
      let body = ''; req.setEncoding('utf8'); req.on('data', chunk => { body += chunk })
      req.on('end', () => { received = { headers: req.headers, body, method: req.method }; res.end('saved') })
    })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const b = await bridge(), proxy = new URL(b.proxyUrl)
    const response = await new Promise<string>((resolve, reject) => {
      const req = request({ hostname: proxy.hostname, port: proxy.port, method: 'POST', path: `http://127.0.0.1:${(server.address() as AddressInfo).port}/resource`,
        headers: { authorization: 'Bearer target-only', 'proxy-authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}` } }, res => {
        let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk }); res.on('end', () => resolve(body))
      })
      req.once('error', reject); req.end('payload')
    })
    expect(response).toBe('saved')
    expect(received).toMatchObject({ method: 'POST', body: 'payload', headers: { authorization: 'Bearer target-only' } })
    expect((received as { headers: object }).headers).not.toHaveProperty('proxy-authorization')
  })
  it('does not touch a local service before authorization, then forwards without browser state', async () => {
    const server = await origin()
    const deny = await bridge()
    const noAuth = await web(deny, `http://127.0.0.1:${server.port}`, false)
    expect(noAuth.status).toBe(401); await noAuth.body?.cancel()
    const rejected = await web(deny, `http://127.0.0.1:${server.port}`)
    expect(rejected.headers.get('x-deepviewer-error')).toBe('LOCAL_ACCESS_DENIED'); await rejected.body?.cancel()
    expect(server.hits).not.toHaveBeenCalled()
    const allow = await bridge({ ask: async () => 'once' })
    const response = await web(allow, `http://127.0.0.1:${server.port}`)
    expect(response.status).toBe(200); expect(await response.text()).toBe('fixture')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(server.hits.mock.calls[0]?.[0]).not.toHaveProperty('cookie')
    expect(server.hits.mock.calls[0]?.[0]).not.toHaveProperty('authorization')
  })
  it('uses updated system routes on the next connection and never silently bypasses a dead proxy', async () => {
    const server = await origin()
    const proxy = createServer(); servers.push(proxy)
    const connects = vi.fn()
    proxy.on('connect', (_req, client, head) => {
      connects()
      const upstream = createConnection({ host: '127.0.0.1', port: server.port }, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head)
        client.pipe(upstream); upstream.pipe(client)
      })
      client.once('close', () => upstream.destroy()); upstream.once('close', () => client.destroy())
    })
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve))
    let route = `PROXY 127.0.0.1:${(proxy.address() as AddressInfo).port}`
    const b = await bridge({ resolveProxy: async () => route, resolve: async () => [{ address: '198.18.1.30', family: 4 }] })
    const success = await web(b, 'http://public.test'); expect(await success.text()).toBe('fixture'); expect(connects).toHaveBeenCalledTimes(1)
    route = 'DIRECT'
    const direct = await web(b, 'http://public.test'); expect(direct.headers.get('x-deepviewer-error')).toBe('FAKE_IP_WITHOUT_PROXY'); await direct.body?.cancel()
    route = 'PROXY 127.0.0.1:1'
    const failure = await web(b, 'http://public.test'); expect(failure.headers.get('x-deepviewer-error')).toBe('ECONNREFUSED'); await failure.body?.cancel()
    expect(server.hits).toHaveBeenCalledTimes(1)
  })
  it('preserves HTTP versus HTTPS system routing for runtime CONNECT requests', async () => {
    const server = await origin()
    const resolveProxy = vi.fn().mockResolvedValue('DIRECT')
    const b = await bridge({ resolveProxy })
    for (const [proxyUrl, scheme] of [[b.proxyUrl, 'http:'], [b.httpsProxyUrl, 'https:']]) {
      const proxy = new URL(proxyUrl!)
      await new Promise<void>((resolve, reject) => {
        const req = request({ hostname: proxy.hostname, port: proxy.port, method: 'CONNECT', path: `127.0.0.1:${server.port}`,
          headers: { 'proxy-authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}` } })
        req.once('connect', (res, socket) => { expect(res.statusCode).toBe(200); socket.destroy(); resolve() }); req.once('error', reject); req.end()
      })
      expect(resolveProxy.mock.calls.at(-1)?.[0]).toBe(`${scheme}//127.0.0.1:${server.port}/`)
    }
  })
})
