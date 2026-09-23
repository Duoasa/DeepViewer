import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { SettingsPathOp } from '@deepseek-ai/dsh-settings'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { join } from 'node:path'
import { ScanService } from './scan-service.mjs'
export const inject = ['connection', 'settings', 'credentials']
export function apply(ctx: Context): void {
  const scanner = new ScanService({
    read: () => ctx.settings.describe().find(view => view.ns === 'llm-pi-ai'),
    resolveKey: async (ref: string) => (await ctx.credentials.resolve(credentialRef(ref)))?.value,
    mutate: (ops: SettingsPathOp[], revision: number) => ctx.settings.mutate('llm-pi-ai', ops, revision),
    file: join(resolveDshHome(), 'deepviewer-model-scans.json'),
  })
  ctx.effect(() => () => scanner.dispose(), 'reasoning: cancel scans on unload')
  ctx.connection.rpc.handle('/deepviewer-model-scans', async (method, payload) => {
    try {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('无效扫描请求')
      const { route, id, exclude } = payload as { route: string; id?: string; exclude?: boolean }
      let value
      if (method === 'status') value = scanner.status(route)
      else if (method === 'start') value = await scanner.start(route)
      else if (method === 'stop') value = scanner.stop(route)
      else if (method === 'apply') value = await scanner.apply(route, id, exclude === true)
      else if (method === 'restore') value = await scanner.restore(route, id)
      else throw Error('未知扫描操作')
      return { ok: true, value }
    } catch (error) {
      // Scanner messages are locally generated; never return provider request bodies.
      return { ok: false, error: { code: 'scan/failed', message: error instanceof Error ? error.message : '扫描操作失败', details: {} } }
    }
  })
}
