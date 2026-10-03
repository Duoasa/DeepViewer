/**
 * Host entry for `@deepviewer/dsh-plugin-model-capabilities`.
 *
 * Registers one RPC channel (`/dsh-model-capabilities`) that lets the
 * Settings → Models provider card start, stop, inspect, apply and roll back a
 * capability scan of an OpenAI-compatible provider route configured under the
 * `llm-pi-ai` settings namespace.
 *
 * Everything host-specific is declared here and nowhere else: the injected
 * services (`connection`, `settings`, `credentials`), the settings namespace
 * the plugin reads and writes, and the plugin's own `Config` schema.
 *
 * @module dsh-plugin-model-capabilities
 */
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import z from '@deepseek-ai/schemastery'
import { join } from 'node:path'
import { DEFAULT_LIMITS } from './host/scanner.mjs'
import { publicMessage } from './host/errors.mjs'
import { ScanService, dispatch } from './host/service.mjs'

export const name = 'model-capabilities'
export const inject = ['connection', 'webServer', 'settings', 'credentials']

/** RPC channel the client half calls. */
export const RPC_CHANNEL = '/dsh-model-capabilities'
/** Settings namespace whose provider routes the scanner reads and writes. */
export const LLM_SETTINGS_NS = 'llm-pi-ai'

export const Config = z.object({
  settingsNamespace: z.string().default(LLM_SETTINGS_NS).description('Settings namespace holding the pi-ai provider routes to scan.'),
  storeFile: z.string().description('Absolute path of the scan report store. Defaults to <DSH home>/deepviewer-model-capability-scans.json.'),
  limits: z
    .object({
      models: z.number().step(1).min(1).max(1000).default(DEFAULT_LIMITS.models).description('Maximum models scanned per run.'),
      concurrency: z.number().step(1).min(1).max(8).default(DEFAULT_LIMITS.concurrency).description('Concurrent model scans.'),
      timeoutMs: z.number().step(1).min(1000).max(120_000).default(DEFAULT_LIMITS.timeoutMs).description('Per-request timeout in milliseconds for text probes.'),
      imageTimeoutMs: z.number().step(1).min(1000).max(300_000).default(DEFAULT_LIMITS.imageTimeoutMs).description('Per-request timeout in milliseconds for image probes (vision models are slower).'),
      requestsPerModel: z.number().step(1).min(2).max(20).default(DEFAULT_LIMITS.requestsPerModel).description('Request budget per model.'),
      textRetryOutputTokens: z.number().step(1).min(16).max(8192).default(DEFAULT_LIMITS.textRetryOutputTokens).description('Text retry budget when reasoning exhausts the initial output budget.'),
      textOutputTokens: z.number().step(1).min(1).max(64).default(DEFAULT_LIMITS.textOutputTokens).description('Output budget for text-only probes.'),
      imageOutputTokens: z.number().step(1).min(16).max(1024).default(DEFAULT_LIMITS.imageOutputTokens).description('Output budget for the first image probe.'),
      imageRetryOutputTokens: z.number().step(1).min(64).max(8192).default(DEFAULT_LIMITS.imageRetryOutputTokens).description('Output budget for the image retry given to reasoning models.'),
      probeEfforts: z.boolean().default(DEFAULT_LIMITS.probeEfforts).description('Probe reasoning_effort levels as well as image input.'),
    })
    .default({}),
})

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {ReturnType<typeof Config>} config
 */
export function apply(ctx, config) {
  const ns = config.settingsNamespace || LLM_SETTINGS_NS
  const service = new ScanService({
    // `writable` is a property of the settings service (the active profile), not of
    // a namespace descriptor; surface it on the view the scanner consumes.
    readView: () => {
      const view = ctx.settings.describe().find((entry) => entry.ns === ns)
      return view && { ...view, writable: ctx.settings.writable !== false }
    },
    resolveKey: async (ref) => (await ctx.credentials.resolve(credentialRef(ref)))?.value,
    mutate: (ops, revision) => ctx.settings.mutate(ns, ops, revision),
    file: config.storeFile || join(resolveDshHome(), 'deepviewer-model-capability-scans.json'),
    legacyFiles: config.storeFile ? [] : ['deepviewer-model-scans.json', 'model-capability-scans.json'].map(file => join(resolveDshHome(), file)),
    limits: config.limits,
    log: (message) => ctx.logger?.info?.(`model-capabilities: ${message}`),
  })
  ctx.effect(() => () => service.dispose(), 'model-capabilities: cancel scans on unload')
  ctx.inject(['connection', 'webServer'], (rpcCtx) => {
      rpcCtx.connection.rpc.handle(RPC_CHANNEL, async (method, payload) => {
        try {
          return { ok: true, value: await dispatch(service, method, payload) }
        } catch (error) {
          return { ok: false, error: { code: 'model-capabilities/failed', message: publicMessage(error), details: {} } }
        }
      }, rpcCtx)
  })
}
