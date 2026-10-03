import { createConnection, isIP, type Socket } from 'node:net'
import { connect as tlsConnect, checkServerIdentity } from 'node:tls'
import * as http from 'node:http'
import * as https from 'node:https'
import { SocksClient } from 'socks'
import type { Address } from './access.js'
import { NetworkError, type Route } from './policy.js'

const authority = (url: URL) => `${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`
export async function connectRoute(url: URL, route: Route, addresses: Address[] | undefined, signal: AbortSignal): Promise<Socket> {
  signal.throwIfAborted()
  const host = url.hostname.replace(/^\[|\]$/gu, '')
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
  if (route.kind === 'direct') {
    // The web gate supplies an immutable answer set; Node never resolves it again.
    const targets = addresses?.map(a => a.address) ?? [host]
    let last: unknown
    for (const target of targets) {
      try {
        return await new Promise<Socket>((resolve, reject) => {
          const socket = createConnection({ host: target, port, signal })
          socket.setTimeout(10000, () => socket.destroy(new NetworkError('CONNECT_TIMEOUT', 'Connection timed out.')))
          socket.once('connect', () => { socket.setTimeout(0); resolve(socket) })
          socket.once('error', reject)
        })
      } catch (error) { last = error; signal.throwIfAborted() }
    }
    throw last
  }
  if (route.kind === 'socks4' || route.kind === 'socks5') {
    const { socket } = await SocksClient.createConnection({
      command: 'connect', destination: { host, port }, timeout: 15000,
      proxy: { host: route.host, port: route.port, type: route.kind === 'socks4' ? 4 : 5,
        ...(route.username === undefined ? {} : { userId: route.username, password: route.password ?? '' }) },
    })
    if (signal.aborted) { socket.destroy(); signal.throwIfAborted() }
    return socket
  }
  return new Promise<Socket>((resolve, reject) => {
    const request = (route.kind === 'https' ? https : http).request({
      hostname: route.host, port: route.port, method: 'CONNECT', path: authority(url), agent: false, signal,
      headers: { host: authority(url), ...(route.username === undefined ? {} : {
        'proxy-authorization': `Basic ${Buffer.from(`${route.username}:${route.password ?? ''}`).toString('base64')}`,
      }) },
    })
    request.setTimeout(15000, () => request.destroy(new NetworkError('PROXY_CONNECT_TIMEOUT', 'Proxy connection timed out.')))
    request.once('connect', (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy()
        reject(new NetworkError(`PROXY_HTTP_${String(response.statusCode)}`, 'The proxy rejected the connection.'))
      } else { if (head.length) socket.unshift(head); socket.setTimeout(0); resolve(socket) }
    })
    request.once('error', reject)
    request.end()
  })
}

export async function secureSocket(socket: Socket, url: URL, signal: AbortSignal): Promise<Socket> {
  if (url.protocol !== 'https:') return socket
  const hostname = url.hostname.replace(/^\[|\]$/gu, '')
  return new Promise<Socket>((resolve, reject) => {
    const secure = tlsConnect({ socket, host: hostname, ...(isIP(hostname) ? {} : { servername: hostname }),
      rejectUnauthorized: true, checkServerIdentity: (_name, cert) => checkServerIdentity(hostname, cert) })
    const abort = () => secure.destroy(new NetworkError('REQUEST_ABORTED', 'Request cancelled.'))
    signal.addEventListener('abort', abort, { once: true })
    secure.once('close', () => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
    secure.setTimeout(15000, () => secure.destroy(new NetworkError('TLS_TIMEOUT', 'TLS negotiation timed out.')))
    secure.once('secureConnect', () => { secure.setTimeout(0); resolve(secure) })
    secure.once('error', reject)
  })
}

/** Anonymous web requests never inherit browser cookies or proxy credentials. Redirects stay manual. */
export function forwardGet(url: URL, socket: Socket, accept: string, userAgent: string, signal: AbortSignal): Promise<http.IncomingMessage> {
  const secure = url.protocol === 'https:'
  const agent = secure ? new https.Agent({ keepAlive: false }) : new http.Agent({ keepAlive: false })
  agent.createConnection = () => socket
  return new Promise((resolve, reject) => {
    const request = (secure ? https : http).request(url, {
      method: 'GET', agent, signal,
      headers: { accept, 'user-agent': userAgent, 'accept-encoding': 'identity', connection: 'close' },
    })
    request.once('response', response => {
      response.once('close', () => agent.destroy())
      resolve(response)
    })
    request.once('error', error => { agent.destroy(); reject(error) })
    request.end()
  })
}
