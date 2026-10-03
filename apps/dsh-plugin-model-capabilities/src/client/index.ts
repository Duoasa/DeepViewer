/**
 * Client entry for `@deepviewer/dsh-plugin-model-capabilities`.
 *
 * Contributes one keyed entry to the `settings.models.provider-card` slot
 * (one card per pi-ai provider route) that hosts the scan panel and the
 * manual capability editor. All Host access rides two documented faces:
 * `ctx.remote.settings` for reads/writes of the `llm-pi-ai` namespace and
 * the `/dsh-model-capabilities` RPC channel for scan control.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { ProviderScan, type ScanState } from './ProviderScan.tsx'
import { NS, en, zh } from './locale.ts'
import type { modelEdit } from './model-config.ts'

export const name = 'model-capabilities'
export const inject = ['slots', 'locale', 'configForms', 'remote.settings', 'connection']

/** RPC channel registered by the host half. Must match `src/index.mjs`. */
export const RPC_CHANNEL = '/dsh-model-capabilities'
const SETTINGS_NS = 'llm-pi-ai'

type Ctx = ClientContext & {
  slots: any
  locale: any
  configForms: any
  remote: any
  effect: any
  get: any
}

export function apply(ctx: Ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'model-capabilities: locale')

  const mirror = ctx.configForms.describe()
  const connection = ctx.get('connection')
  const t = ctx.locale.bind(NS)

  const write = async (op: ReturnType<typeof modelEdit>, revision: number, modelId: string) => {
    const response = await connection.rpc.call(RPC_CHANNEL, 'edit', { route: op.path[1], id: modelId, models: op.value, revision })
    if (!response.ok) throw new Error(response.error.message)
    const fresh = await ctx.remote.settings.describe()
    if (!fresh.ok) throw new Error(fresh.error.message)
    for (const view of fresh.value.namespaces) if (view.ns === SETTINGS_NS) mirror.acceptView(view)
    return response.value
  }

  const scan = async (method: string, payload: Record<string, unknown>): Promise<ScanState> => {
    const response = await connection.rpc.call(RPC_CHANNEL, method, payload)
    if (!response.ok) throw new Error(response.error.message)
    if (method === 'apply' || method === 'restore') {
      const fresh = await ctx.remote.settings.describe()
      if (fresh.ok) for (const view of fresh.value.namespaces) if (view.ns === SETTINGS_NS) mirror.acceptView(view)
    }
    return response.value as ScanState
  }

  ctx.slots.inject('settings.models.provider-card', () =>
    ctx.slots.register(
      {
        name: 'settings.models.provider-card',
        key: SETTINGS_NS,
        // Keyed-slot cells render their lowest-priority live entry. Registering below the
        // default 0 lets this panel shadow an older scanner (e.g. @deepviewer/dsh-plugin-reasoning)
        // that a host mounts through a launcher patch the profile cannot disable.
        priority: -10,
        inject: () => ({ mirror, write, t, scan }),
      },
      ProviderScan,
    ),
  )
}
