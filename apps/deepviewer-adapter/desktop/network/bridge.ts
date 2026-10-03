import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, request as httpRequest, Agent, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import type { Duplex } from 'node:stream'
import { WebAccess, validateTarget, type Approval, type LocalTarget, type Resolver, type Address } from './access.js'
import { connectRoute, secureSocket, forwardGet } from './transport.js'
import { explicitRoutes, parseSystemRoutes, safeErrorCode, errorDescription, NetworkError, type Route } from './policy.js'

export interface BridgeOptions {
  appVersion?: string
  resolveProxy(url: string): Promise<string>
  proxyEnv: NodeJS.ProcessEnv
  ask(target: LocalTarget, signal: AbortSignal): Promise<Approval>
  log(message: string): void
  resolve?: Resolver
}
export interface NetworkBridge { proxyUrl: string; httpsProxyUrl: string; webUrl: string; close(): Promise<void> }
const token = () => randomBytes(32).toString('hex')
const equal = (actual: string | undefined, expected: string) => {
  if (typeof actual !== 'string') return false
  const bytes = Buffer.from(actual), wanted = Buffer.from(expected)
  return bytes.length === wanted.length && timingSafeEqual(bytes, wanted)
}

export async function startNetworkBridge(options: BridgeOptions): Promise<NetworkBridge> {
  const proxySecret = token(), webSecret = token()
  const proxyAuth = `Basic ${Buffer.from(`deepviewer-http:${proxySecret}`).toString('base64')}`
  const httpsProxyAuth = `Basic ${Buffer.from(`deepviewer-https:${proxySecret}`).toString('base64')}`
  const webAuth = `Bearer ${webSecret}`
  const access = new WebAccess(options.ask, options.resolve)
  const sockets = new Set<Duplex>()
  const controllers = new Set<AbortController>()
  const server = createServer({ maxHeaderSize: 32768 })
  let closing = false
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  server.on('clientError', (_error, socket) => socket.destroy())
  server.maxConnections = 128
  server.headersTimeout = 15000
  server.requestTimeout = 30000

  async function open(url: URL, web: boolean, signal: AbortSignal): Promise<Socket> {
    const routes = explicitRoutes(url, options.proxyEnv) ?? parseSystemRoutes(await options.resolveProxy(url.href))
    let last: unknown
    for (const route of routes) {
      let addresses: Address[] | undefined
      let chosen: Route = route
      if (web) {
        addresses = await access.check(url, route.kind !== 'direct', signal)
        if (addresses) chosen = { kind: 'direct' }
      }
      signal.throwIfAborted()
      if (closing) throw new NetworkError('BRIDGE_CLOSED', 'The application is closing.')
      try {
        const socket = await connectRoute(url, chosen, addresses, signal)
        sockets.add(socket); socket.once('close', () => sockets.delete(socket))
        options.log(`NETWORK_CONNECTED kind=${web ? 'web' : 'runtime'} host=${url.hostname} port=${url.port || (url.protocol === 'https:' ? '443' : '80')} route=${chosen.kind}`)
        return socket
      } catch (error) { last = error; signal.throwIfAborted() }
    }
    throw last ?? new NetworkError('NO_ROUTE', 'No network route was available.')
  }
  const report = (error: unknown, url?: URL) => {
    const code = safeErrorCode(error)
    options.log(`NETWORK_FAILED host=${url?.hostname ?? 'unknown'} code=${code}`)
    return { code, message: `${errorDescription(code)} [${code}]` }
  }
  function controllerFor(socket: { once(event: 'close', listener: () => void): unknown }): AbortController {
    const controller = new AbortController()
    controllers.add(controller)
    socket.once('close', () => { controller.abort(); controllers.delete(controller) })
    return controller
  }
  async function webFetch(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!equal(request.headers.authorization, webAuth)) { response.writeHead(401).end(); return }
    if (request.headers.origin !== undefined) { response.writeHead(403).end(); return }
    const target = request.headers['x-deepviewer-target']
    let url: URL | undefined
    const controller = controllerFor(response)
    try {
      if (typeof target !== 'string') throw new NetworkError('INVALID_TARGET', 'Missing web target.')
      url = validateTarget(target)
      const signal = controller.signal
      const raw = await open(url, true, signal)
      let socket: Socket
      try { socket = await secureSocket(raw, url, signal) } catch (error) { raw.destroy(); throw error }
      const upstream = await forwardGet(url, socket,
        'text/html,application/xhtml+xml,text/*;q=0.9,application/json;q=0.8', `DeepViewer${options.appVersion ? `/${options.appVersion}` : ''} (DSH web fetch)`, signal)
      const headers = { ...upstream.headers }
      for (const key of ['set-cookie', 'proxy-authenticate', 'proxy-authorization', 'transfer-encoding', 'connection', 'keep-alive', 'x-deepviewer-error', 'x-deepviewer-upstream']) delete headers[key]
      response.writeHead(upstream.statusCode ?? 502, { ...headers, 'x-deepviewer-upstream': '1' })
      upstream.once('error', () => response.destroy())
      upstream.pipe(response)
    } catch (error) {
      if (controller.signal.aborted) return
      const detail = report(error, url)
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json', 'x-deepviewer-error': detail.code }).end(JSON.stringify(detail))
      else response.destroy()
    }
  }
  async function forwardHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const controller = controllerFor(response)
    let url: URL | undefined
    try {
      url = validateTarget(request.url ?? '')
      if (url.protocol !== 'http:') throw new NetworkError('INVALID_TARGET', 'HTTPS requests must use CONNECT.')
      const socket = await open(url, false, controller.signal)
      const agent = new Agent({ keepAlive: false }); agent.createConnection = () => socket
      const headers = { ...request.headers, host: url.host, connection: 'close' }
      for (const key of ['proxy-authorization', 'proxy-connection']) delete (headers as Record<string, unknown>)[key]
      const upstream = httpRequest(url, { method: request.method, headers, agent, signal: controller.signal })
      upstream.once('response', received => {
        response.writeHead(received.statusCode ?? 502, received.headers)
        received.once('error', () => response.destroy()); received.pipe(response)
      })
      upstream.once('error', error => {
        report(error, url)
        if (!response.headersSent) response.writeHead(502).end(); else response.destroy()
      })
      response.once('close', () => { upstream.destroy(); agent.destroy() })
      request.pipe(upstream)
    } catch (error) { report(error, url); if (!response.headersSent) response.writeHead(502).end() }
  }
  server.on('request', (request, response) => {
    if (request.method === 'POST' && request.url === '/web-fetch') { request.resume(); void webFetch(request, response); return }
    if (equal(request.headers['proxy-authorization'] as string | undefined, proxyAuth) && !request.headers.origin && request.url?.startsWith('http://')) {
      void forwardHttp(request, response); return
    }
    response.writeHead(407, { 'proxy-authenticate': 'Basic realm="DeepViewer"' }).end()
  })
  server.on('connect', (request, client, head) => {
    const incomingAuth = request.headers['proxy-authorization'] as string | undefined
    const httpsRoute = equal(incomingAuth, httpsProxyAuth)
    if ((!httpsRoute && !equal(incomingAuth, proxyAuth)) || request.headers.origin !== undefined) {
      client.end('HTTP/1.1 407 Proxy Authentication Required\r\nConnection: close\r\n\r\n'); return
    }
    const controller = controllerFor(client)
    void (async () => {
      let url: URL | undefined
      try {
        if (!request.url || !/^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9._-]+):\d+$/u.test(request.url)) throw new NetworkError('INVALID_TARGET', 'Invalid CONNECT authority.')
        url = validateTarget(`${httpsRoute ? 'https' : 'http'}://${request.url}`)
        const upstream = await open(url, false, controller.signal)
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) upstream.write(head)
        client.pipe(upstream); upstream.pipe(client)
        client.once('close', () => upstream.destroy())
        upstream.once('close', () => client.destroy())
        upstream.once('error', () => client.destroy())
        client.once('error', () => upstream.destroy())
      } catch (error) {
        const detail = report(error, url)
        if (!client.destroyed) client.end(`HTTP/1.1 502 ${detail.code}\r\nConnection: close\r\n\r\n`)
      }
    })()
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Network bridge did not bind a loopback port.')
  return {
    proxyUrl: `http://deepviewer-http:${proxySecret}@127.0.0.1:${address.port}`,
    httpsProxyUrl: `http://deepviewer-https:${proxySecret}@127.0.0.1:${address.port}`,
    webUrl: `http://deepviewer:${webSecret}@127.0.0.1:${address.port}/web-fetch`,
    async close() {
      closing = true
      for (const controller of controllers) controller.abort()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}
