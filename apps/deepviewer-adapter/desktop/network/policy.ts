import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseEnv } from 'node:util'

const PROXY_KEYS = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY'] as const
export type Route = { kind: 'direct' } | { kind: 'http' | 'https' | 'socks4' | 'socks5'; host: string; port: number; username?: string; password?: string }
export class NetworkError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'NetworkError' }
}

/** Match Harness policy: inherited > DSH_HOME .env; project proxy settings are rejected. */
export function proxyEnvironment(inherited: NodeJS.ProcessEnv, cwd: string, home: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {}
  for (const directory of [home, cwd]) {
    try {
      const values = parseEnv(readFileSync(join(directory, '.env'), 'utf8'))
      for (const key of PROXY_KEYS) if (values[key] !== undefined) {
        if (resolve(directory) !== resolve(home)) throw new NetworkError('PROJECT_PROXY_NOT_ALLOWED', 'Proxy settings belong in the launch environment or DSH home .env, not a project .env.')
        result[key] = values[key]
      }
    } catch (error) {
      if (error instanceof NetworkError) throw error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new NetworkError('PROXY_CONFIG_UNREADABLE', 'Cannot read the Harness proxy configuration.')
    }
  }
  for (const key of PROXY_KEYS) if (inherited[key] !== undefined) result[key] = inherited[key]
  return result
}
const valueOf = (env: NodeJS.ProcessEnv, name: string): string | undefined => env[name]?.trim() || env[name.toUpperCase()]?.trim() || undefined
export const hasExplicitProxy = (env: NodeJS.ProcessEnv): boolean => ['http_proxy', 'https_proxy', 'all_proxy'].some(k => valueOf(env, k) !== undefined)

export function bypassesProxy(url: URL, list: string): boolean {
  const host = url.hostname.replace(/^\[|\]$/gu, '').replace(/\.$/u, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./u.test(host)) return true
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  return list.split(/[,\s]+/u).filter(Boolean).some(entry => {
    if (entry === '*') return true
    const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/u.exec(entry)
    const target = (match?.[1] ?? entry).replace(/^\[|\]$/gu, '').replace(/^\*?\./u, '').toLowerCase()
    return (match?.[2] === undefined || match[2] === port) && (host === target || host.endsWith(`.${target}`))
  })
}
function fromProxyUrl(value: string): Route {
  try {
    const url = new URL(value)
    const kind = { 'http:': 'http', 'https:': 'https', 'socks:': 'socks5', 'socks5:': 'socks5', 'socks5h:': 'socks5', 'socks4:': 'socks4', 'socks4a:': 'socks4' }[url.protocol] as Exclude<Route['kind'], 'direct'> | undefined
    const port = Number(url.port || (kind === 'https' ? 443 : kind === 'http' ? 80 : 1080))
    if (!kind || !url.hostname || !Number.isInteger(port) || port < 1 || port > 65535 || !['', '/'].includes(url.pathname) || url.search || url.hash) throw new Error()
    return { kind, host: url.hostname.replace(/^\[|\]$/gu, ''), port, ...(url.username ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } : {}) }
  } catch { throw new NetworkError('PROXY_CONFIG_INVALID', 'The configured proxy URL is invalid or unsupported.') }
}
export function explicitRoutes(url: URL, env: NodeJS.ProcessEnv): Route[] | undefined {
  const bypass = valueOf(env, 'no_proxy')
  if (bypass && bypassesProxy(url, bypass)) return [{ kind: 'direct' }]
  if (!hasExplicitProxy(env)) return undefined
  if (bypassesProxy(url, valueOf(env, 'no_proxy') ?? '')) return [{ kind: 'direct' }]
  const http = valueOf(env, 'http_proxy')
  const proxy = url.protocol === 'https:' ? valueOf(env, 'https_proxy') ?? valueOf(env, 'all_proxy') ?? http : http ?? valueOf(env, 'all_proxy')
  return proxy === undefined ? [{ kind: 'direct' }] : [fromProxyUrl(proxy)]
}
/** Chromium resolves current OS/PAC settings per destination; DIRECT is never invented as a fallback. */
export function parseSystemRoutes(value: string): Route[] {
  const routes = value.split(';').map(part => {
    const [type, address] = part.trim().split(/\s+/u)
    if (type === 'DIRECT') return { kind: 'direct' } as Route
    const scheme = { PROXY: 'http', HTTPS: 'https', SOCKS: 'socks4', SOCKS4: 'socks4', SOCKS5: 'socks5' }[type ?? '']
    if (!scheme || !address) throw new NetworkError('SYSTEM_PROXY_UNSUPPORTED', 'The system returned an unsupported proxy route.')
    return fromProxyUrl(`${scheme}://${address}`)
  })
  if (!routes.length) throw new NetworkError('SYSTEM_PROXY_UNAVAILABLE', 'The system returned no network route.')
  return routes
}
export function safeErrorCode(error: unknown): string {
  if (error instanceof NetworkError) return error.code
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code && /^(E[A-Z0-9_]+|ERR_[A-Z0-9_]+|CERT_[A-Z0-9_]+|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_[A-Z_]+)$/u.test(code)) return code
  return 'NETWORK_CONNECTION_FAILED'
}
export function errorDescription(code: string): string {
  if (code === 'LOCAL_ACCESS_DENIED') return 'Local/private-network access was declined. / 已拒绝本机或内网访问。'
  if (code === 'FAKE_IP_WITHOUT_PROXY') return 'DNS returned a virtual proxy IP, but the system selected DIRECT. Enable the system proxy in your network app. / DNS 返回了代理虚拟地址，但系统未配置代理路由。'
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS resolution failed. / 域名解析失败。'
  if (code.includes('TIMEOUT') || code === 'ETIMEDOUT') return 'The network connection timed out. / 网络连接超时。'
  if (code.includes('CERT') || code.includes('TLS') || code.includes('SSL')) return 'TLS or certificate validation failed. / TLS 或证书验证失败。'
  if (code === 'ECONNREFUSED') return 'The target or configured proxy refused the connection. / 目标或代理拒绝连接，请检查代理是否运行。'
  if (code === 'ECONNRESET') return 'The target or proxy reset the connection. / 目标或代理中断了连接。'
  return 'The configured network route failed. / 当前网络路由连接失败。'
}
