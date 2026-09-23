import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { proxyEnvironment, explicitRoutes, parseSystemRoutes, safeErrorCode } from '../src/main/network/policy.js'

const roots: string[] = []
afterEach(() => { for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }) })
describe('desktop network policy', () => {
  it('uses inherited proxy over home dotenv and leaves the environment unchanged', () => {
    const root = mkdtempSync(join(tmpdir(), 'dv-proxy-')); roots.push(root)
    const home = join(root, 'home'), project = join(root, 'project'); mkdirSync(home); mkdirSync(project)
    writeFileSync(join(home, '.env'), 'HTTPS_PROXY=http://home:1000\nNO_PROXY=private.test\nOTHER_SECRET=not-retained\n')
    const inherited = { HTTPS_PROXY: 'http://launch:2000' }
    expect(proxyEnvironment(inherited, project, home)).toEqual({ HTTPS_PROXY: 'http://launch:2000', NO_PROXY: 'private.test' })
    expect(inherited).toEqual({ HTTPS_PROXY: 'http://launch:2000' })
    writeFileSync(join(project, '.env'), 'HTTP_PROXY=http://repo:3000\n')
    expect(() => proxyEnvironment(inherited, project, home)).toThrow('not a project .env')
  })
  it('keeps explicit protocol fallback and NO_PROXY semantics', () => {
    expect(explicitRoutes(new URL('https://example.com'), { HTTP_PROXY: 'http://proxy:1234' })).toEqual([{ kind: 'http', host: 'proxy', port: 1234 }])
    expect(explicitRoutes(new URL('https://private.test'), { ALL_PROXY: 'http://proxy:1234', no_proxy: '*.private.test' })).toEqual([{ kind: 'direct' }])
    expect(explicitRoutes(new URL('http://localhost:99'), { ALL_PROXY: 'http://proxy:1234' })).toEqual([{ kind: 'direct' }])
    expect(explicitRoutes(new URL('https://example.com'), {})).toBeUndefined()
    expect(() => explicitRoutes(new URL('https://example.com'), { HTTPS_PROXY: 'file:///secret' })).toThrow('invalid or unsupported')
  })
  it('preserves PAC route order and never silently adds DIRECT', () => {
    expect(parseSystemRoutes('PROXY localhost:6152; HTTPS proxy.test:443; SOCKS5 [::1]:1080; DIRECT')).toEqual([
      { kind: 'http', host: 'localhost', port: 6152 }, { kind: 'https', host: 'proxy.test', port: 443 },
      { kind: 'socks5', host: '::1', port: 1080 }, { kind: 'direct' },
    ])
    expect(parseSystemRoutes('PROXY localhost:6152')).toHaveLength(1)
    expect(() => parseSystemRoutes('BROKEN')).toThrow('unsupported')
  })
  it('never logs free-form error text or credentials as a code', () => {
    expect(safeErrorCode(new Error('http://secret:password@proxy'))).toBe('NETWORK_CONNECTION_FAILED')
    expect(safeErrorCode({ code: 'ECONNRESET' })).toBe('ECONNRESET')
    expect(safeErrorCode({ code: 'credential=secret' })).toBe('NETWORK_CONNECTION_FAILED')
  })
})
