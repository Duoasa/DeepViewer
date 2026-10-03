import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import { NetworkError } from './policy.js'

export interface Address { address: string; family: 4 | 6 }
export interface LocalTarget { hostname: string; port: number; addresses: readonly string[] }
export type Approval = 'deny' | 'once' | 'run'
export type Resolver = (hostname: string) => Promise<Address[]>
export const resolveAddresses: Resolver = async hostname => {
  const literal = isIP(hostname)
  if (literal) return [{ address: hostname, family: literal as 4 | 6 }]
  return await lookup(hostname, { all: true, order: 'verbatim' }) as Address[]
}
export function isPublic(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address)
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) parsed = (parsed as ipaddr.IPv6).toIPv4Address()
    return parsed.range() === 'unicast'
  } catch { return false }
}
export function isFakeIp(address: string): boolean {
  try { return ipaddr.parse(address).match(ipaddr.parseCIDR('198.18.0.0/15')) } catch { return false }
}
export function validateTarget(input: string): URL {
  let url: URL
  try { url = new URL(input) } catch { throw new NetworkError('INVALID_TARGET', 'Invalid target URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || input.length > 16384) throw new NetworkError('INVALID_TARGET', 'Only anonymous HTTP(S) target URLs are supported.')
  return url
}
export class WebAccess {
  private readonly grants = new Set<string>()
  // Serialize native dialogs; grants are checked again after earlier prompts finish.
  private tail = Promise.resolve()
  constructor(private readonly ask: (target: LocalTarget, signal: AbortSignal) => Promise<Approval>, private readonly resolve: Resolver = resolveAddresses) {}
  // RFC 7050 discovery prevents a custom NAT64 prefix from disguising an internal IPv4 address.
  private async nat64PrivateAddresses(addresses: Address[]): Promise<Set<string>> {
    const denied = new Set<string>()
    if (!addresses.some(a => a.family === 6 && isPublic(a.address))) return denied
    let probes: Address[]
    try { probes = await this.resolve('ipv4only.arpa') } catch { return denied }
    const embedded = (bytes: number[], length: number): string => length === 96
      ? bytes.slice(12).join('.') : [...bytes.slice(length / 8, 8), ...bytes.slice(9, 9 + (length / 8 - 4))].join('.')
    for (const probe of probes.filter(a => a.family === 6)) {
      const prefix = ipaddr.parse(probe.address).toByteArray()
      for (const length of [32, 40, 48, 56, 64, 96]) {
        if (length !== 96 && prefix[8] !== 0) continue
        if (!['192.0.0.170', '192.0.0.171'].includes(embedded(prefix, length))) continue
        for (const address of addresses.filter(a => a.family === 6)) {
          const bytes = ipaddr.parse(address.address).toByteArray()
          if (prefix.slice(0, length / 8).every((b, i) => bytes[i] === b) && !isPublic(embedded(bytes, length))) denied.add(address.address)
        }
      }
    }
    return denied
  }
  async check(url: URL, proxied: boolean, signal: AbortSignal): Promise<Address[] | undefined> {
    const hostname = url.hostname.replace(/^\[|\]$/gu, '')
    let addresses: Address[]
    try { addresses = await this.resolve(hostname) } catch (error) {
      // A proxy can resolve a public name that this network cannot resolve locally.
      if (proxied && !isIP(hostname) && hostname.includes('.') && !hostname.endsWith('.local') && !hostname.endsWith('.localhost')) return undefined
      throw error
    }
    if (addresses.some(a => ![4, 6].includes(a.family) || isIP(a.address) !== a.family)) throw new NetworkError('INVALID_DNS_ADDRESS', 'The resolver returned an invalid address.')
    if (!addresses.length) throw new NetworkError('ENOTFOUND', 'No DNS addresses were returned.')
    const fake = addresses.some(a => isFakeIp(a.address))
    if (fake && !isIP(hostname) && !proxied) throw new NetworkError('FAKE_IP_WITHOUT_PROXY', 'A fake DNS address requires an explicit system proxy route.')
    const translated = await this.nat64PrivateAddresses(addresses)
    const privateAddresses = addresses.filter(a => translated.has(a.address) || (!isPublic(a.address) && !(proxied && !isIP(hostname) && isFakeIp(a.address))))
    const namedLocal = !hostname.includes('.') || hostname.endsWith('.local') || hostname.endsWith('.localhost') || hostname === 'localhost'
    if (privateAddresses.length || namedLocal) {
      const target = { hostname, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)), addresses: addresses.map(a => a.address).sort() }
      const key = JSON.stringify(target)
      const action = this.tail.then(async () => {
        signal.throwIfAborted()
        if (this.grants.has(key)) return
        const decision = await this.ask(target, signal)
        signal.throwIfAborted()
        if (decision === 'deny') throw new NetworkError('LOCAL_ACCESS_DENIED', 'Local/private-network access denied by the user.')
        if (decision === 'run') this.grants.add(key)
      })
      this.tail = action.catch(() => {})
      await action
      // Route approved private destinations directly to the exact inspected addresses.
      // A remote proxy must not reinterpret a local hostname after consent.
      return addresses
    }
    return proxied ? undefined : addresses
  }
}
