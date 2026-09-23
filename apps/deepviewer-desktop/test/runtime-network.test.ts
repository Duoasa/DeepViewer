import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { configureRuntimeNetwork } from '../src/main/network/runtime-network.js'
import type { RuntimeLaunchSpec } from '../src/main/runtime-manager.js'

describe('network launch wiring', () => {
  it('keeps user proxy policy in the bridge, credentials out of logs, and patches fallbacks consistently', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dv-network-'))
    writeFileSync(join(home, '.env'), 'HTTPS_PROXY=http://home-proxy:6152\n')
    const env = { DSH_HOME: home, HTTPS_PROXY: 'http://user:password@explicit-proxy:6152' }
    const fallback: RuntimeLaunchSpec = { executable: 'node', args: [], cwd: home, env }
    const spec = { ...fallback, fallback }
    const logs: string[] = []
    const b = await configureRuntimeNetwork(spec, { resolveProxy: async () => 'DIRECT', ask: async () => 'deny', log: m => logs.push(m) })
    try {
      expect(env.HTTPS_PROXY).toBe('http://user:password@explicit-proxy:6152')
      expect(spec.env.HTTPS_PROXY).toBe(b.httpsProxyUrl)
      expect(spec.fallback?.env.HTTPS_PROXY).toBe(b.httpsProxyUrl)
      expect(spec.env.DEEPVIEWER_WEB_BRIDGE).toBe(b.webUrl)
      expect(logs.join('\n')).toContain('source=explicit')
      expect(logs.join('\n')).not.toContain('password')
      expect(logs.join('\n')).not.toContain(new URL(b.webUrl).password)
    } finally { await b.close(); rmSync(home, { recursive: true, force: true }) }
  })
})
