/**
 * Scan jobs: one per provider route, persisted so a finished report survives
 * a restart, fenced by a fingerprint of the profile it was taken against.
 *
 * The service knows nothing about Cordis or the RPC transport; `index.ts`
 * adapts it. Everything it needs from the host is injected through the
 * constructor so it can be tested with a fake fetch and in-memory settings.
 *
 * @module dsh-plugin-model-capabilities/host/service
 */
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { loadStore, writeStore } from './store.mjs'
import { PublicError } from './errors.mjs'
import { loadPiAiCatalog } from './catalog.mjs'
import { mergeModels } from './merge.mjs'
import { listModels } from './probe.mjs'
import { DEFAULT_LIMITS, scanModel } from './scanner.mjs'

export const SCAN_VERSION = 6
export const SUPPORTED_PROTOCOLS = Object.freeze(['openai-completions', 'openai-responses'])

const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * @typedef {object} ScanJob
 * @property {number} scanVersion
 * @property {string} route
 * @property {string} id
 * @property {'running' | 'complete' | 'cancelled' | 'failed' | 'interrupted'} status
 * @property {'configured' | 'all'} scope
 * @property {string} snapshot profile fingerprint the scan ran against
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {number} total
 * @property {number} discovered
 * @property {number} progress
 * @property {boolean} truncated
 * @property {import('./scanner.mjs').ModelScanResult[]} results
 * @property {string} [error]
 * @property {string} [appliedAt]
 * @property {string} [appliedFingerprint]
 * @property {object[]} [beforeModels]
 * @property {import('./merge.mjs').ScanOwnership} [beforeOwnership]
 * @property {string[]} [changed]
 */

export class ScanService {
  /**
   * @param {object} deps
   * @param {() => (object | undefined)} deps.readView the llm-pi-ai settings view (`{ revision, value, user, writable }`)
   * @param {(ref: string) => Promise<string | undefined>} deps.resolveKey
   * @param {(ops: object[], revision: number) => Promise<void>} deps.mutate
   * @param {string} [deps.file] persistence path; omit for in-memory
   * @param {string[]} [deps.legacyFiles] legacy stores in the same DSH home
   * @param {typeof fetch} [deps.fetch]
   * @param {Partial<typeof DEFAULT_LIMITS>} [deps.limits]
   * @param {() => Promise<import('./catalog.mjs').CatalogEntry[]>} [deps.loadCatalog]
   * @param {(message: string) => void} [deps.log]
   * @param {() => import('./challenge.mjs').ImageChallenge} [deps.challenge] challenge factory (tests)
   */
  constructor(deps) {
    this.readView = deps.readView
    this.resolveKey = deps.resolveKey
    this.mutate = deps.mutate
    this.file = deps.file
    this.legacyFiles = deps.legacyFiles ?? []
    this.fetch = deps.fetch ?? fetch
    this.limits = { ...DEFAULT_LIMITS, ...deps.limits }
    this.loadCatalog = deps.loadCatalog ?? loadPiAiCatalog
    this.log = deps.log ?? (() => {})
    this.challenge = deps.challenge
    /** @type {Map<string, ScanJob>} */
    this.jobs = new Map()
    /** @type {Map<string, import('./merge.mjs').ScanOwnership>} */
    this.ownership = new Map()
    /** @type {{ route: string; controller: AbortController } | undefined} */
    this.active = undefined
    this.disposed = false
    this.catalogPromise = undefined
    this.load()
  }

  load() {
    const saved = loadStore(this.file, this.legacyFiles)
    for (const job of saved.jobs) {
      if (job.status === 'running') job.status = 'interrupted'
      this.jobs.set(job.route, job)
    }
    for (const [route, ownership] of Object.entries(saved.ownership ?? {})) this.ownership.set(route, ownership)
  }

  save() {
    if (!this.file || this.disposed) return
    writeStore(this.file, { jobs: [...this.jobs.values()], ownership: Object.fromEntries(this.ownership) })
  }

  /** The stored profile for a route, or a thrown, user-facing error. */
  profile(route) {
    if (typeof route !== 'string' || !route || ['__proto__', 'constructor', 'prototype'].includes(route)) throw new PublicError('无效的提供方')
    const view = this.readView()
    const user = view?.user?.providers
    if (!user || !Object.hasOwn(user, route)) throw new PublicError('请先保存此 API 的设置')
    const resolved = view.value?.providers?.[route] ?? user[route]
    if (!SUPPORTED_PROTOCOLS.includes(resolved.api)) throw new PublicError('目前支持 OpenAI Chat Completions / Responses 兼容接口')
    if (!resolved.baseURL || !resolved.apiKeyEnv) throw new PublicError('请先配置 API 地址和密钥')
    return { view, resolved, stored: user[route] }
  }

  status(route) {
    let current
    try {
      current = fingerprint(this.profile(route).resolved)
    } catch {
      // unreadable profile → every job is stale
    }
    const job = this.jobs.get(route)
    if (!job) return { status: 'new', limits: this.limits, scanVersion: SCAN_VERSION }
    const { beforeModels, beforeOwnership, appliedFingerprint, ...view } = job
    return {
      ...view,
      stale: job.scanVersion !== SCAN_VERSION || current !== (appliedFingerprint ?? job.snapshot),
      canRestore: Boolean(beforeModels) && current === appliedFingerprint,
      limits: this.limits,
    }
  }

  async catalog() {
    this.catalogPromise ??= this.loadCatalog().catch(() => [])
    return this.catalogPromise
  }

  /**
   * @param {string} route
   * @param {{ scope?: 'configured' | 'all' }} [options]
   */
  async start(route, options = {}) {
    if (this.active) throw new PublicError('已有扫描正在运行，请等待或先停止')
    const profile = this.profile(route)
    const resolved = structuredClone(profile.resolved), stored = structuredClone(profile.stored)
    const snapshot = fingerprint(resolved)
    const scope = options.scope === 'all' ? 'all' : 'configured'
    if (scope === 'configured' && !stored.models?.length) throw new PublicError('此 API 尚未添加任何模型；请先添加，或选择“扫描接口全部模型”')
    const controller = new AbortController()
    this.active = { route, controller }
    try {
      const key = await this.resolveKey(resolved.apiKeyEnv).catch(() => { throw new PublicError('密钥读取失败，请检查提供方凭据') })
      if (!key) throw new PublicError('此 API 未配置可用密钥')
      if (controller.signal.aborted) throw new PublicError('扫描已停止')
      if (fingerprint(this.profile(route).resolved) !== snapshot) throw new PublicError('提供方配置已变化，请重新扫描')
      /** @type {ScanJob} */
      const job = {
        scanVersion: SCAN_VERSION,
        route,
        id: randomUUID(),
        status: 'running',
        scope,
        snapshot: fingerprint(resolved),
        startedAt: new Date().toISOString(),
        results: [],
        total: 0,
        discovered: 0,
        progress: 0,
        truncated: false,
      }
      this.jobs.set(route, job)
      this.save()
      void this.run(job, structuredClone(resolved), structuredClone(stored), key, controller)
      return this.status(route)
    } catch (error) {
      this.active = undefined
      throw error
    }
  }

  async run(job, resolved, stored, key, controller) {
    const { signal } = controller
    try {
      const listing = await listModels({ baseURL: resolved.baseURL, apiKey: key, headers: resolved.headers, timeoutMs: this.limits.timeoutMs, signal }, this.fetch)
      const listed = new Map(listing.ok ? listing.entries.map((entry) => [entry.id, entry]) : [])
      if (!listing.ok && job.scope === 'all') throw new PublicError(`获取模型列表失败：${listing.reason}`)
      if (!listing.ok) this.log(`route ${job.route}: /models unavailable (${listing.reason}); scanning configured models only`)

      /** @type {import('./scanner.mjs').ScanTarget[]} */
      const targets = []
      for (const model of stored.models ?? []) targets.push({ id: model.id, listing: listed.get(model.id), configured: model })
      if (job.scope === 'all') for (const [id, entry] of listed) if (!targets.some((target) => target.id === id)) targets.push({ id, listing: entry })
      const candidates = targets.slice(0, this.limits.models)
      Object.assign(job, { total: candidates.length, discovered: targets.length, truncated: targets.length > candidates.length })
      this.save()

      const catalog = await this.catalog()
      const route = { baseURL: resolved.baseURL, api: resolved.api, apiKey: key, headers: resolved.headers, compat: resolved.compat }
      let next = 0
      await Promise.allSettled(
        Array.from({ length: Math.max(1, this.limits.concurrency) }, async () => {
          while (next < candidates.length && !signal.aborted) {
            try {
              if (fingerprint(this.profile(job.route).resolved) !== job.snapshot) controller.abort()
            } catch {
              controller.abort()
            }
            if (signal.aborted) return
            const target = candidates[next++]
            let result
            try {
              result = await scanModel(route, target, { catalog, limits: this.limits, signal, fetch: this.fetch, challenge: this.challenge })
            } catch (error) {
              if (signal.aborted) return
              result = { id: target.id, availability: 'uncertain', image: { status: 'uncertain', source: 'none', note: '探测异常' }, reasoning: { status: 'uncertain', levels: [], source: 'none', note: '探测异常' }, requests: 0, note: '探测异常；保留已有配置' }
            }
            if (signal.aborted) return
            job.results.push(result)
            job.progress++
            this.save()
          }
        }),
      )
      job.status = signal.aborted ? 'cancelled' : job.progress === job.total ? 'complete' : 'failed'
    } catch (error) {
      job.status = signal.aborted ? 'cancelled' : 'failed'
      job.error = signal.aborted ? '扫描已停止' : '模型目录或网络检查失败，请检查地址、密钥后重试'
    } finally {
      job.finishedAt = new Date().toISOString()
      this.active = undefined
      this.save()
    }
  }

  stop(route) {
    if (this.active?.route === route) this.active.controller.abort()
    return this.status(route)
  }

  /**
   * Write the merged model list.
   * @param {string} route
   * @param {string} id job id the client saw
   * @param {{ exclude?: boolean; addDiscovered?: boolean }} [options]
   */
  async apply(route, id, options = {}) {
    const job = this.jobs.get(route)
    const { view, resolved, stored } = this.profile(route)
    if (!job || job.id !== id || job.status !== 'complete' || job.appliedFingerprint) throw new PublicError('没有可应用的完整扫描结果')
    if (job.scanVersion !== SCAN_VERSION || fingerprint(resolved) !== job.snapshot) throw new PublicError('扫描规则或提供方配置已变化，请重新扫描')
    if (!view.writable) throw new PublicError('当前设置层不可写')
    const existing = stored.models ?? []
    const { models, ownership, changed } = mergeModels(existing, job.results, { exclude: options.exclude === true, addDiscovered: options.addDiscovered === true && job.scope === 'all', ownership: this.ownership.get(route) })
    job.beforeModels = structuredClone(existing)
    job.beforeOwnership = structuredClone(this.ownership.get(route) ?? { models: {} })
    this.save()
    await this.mutate([{ op: 'set', path: ['providers', route, 'models'], value: models }], view.revision)
    this.ownership.set(route, ownership)
    job.changed = changed
    job.appliedFingerprint = fingerprint(this.profile(route).resolved)
    job.appliedAt = new Date().toISOString()
    this.save()
    return this.status(route)
  }

  async restore(route, id) {
    const job = this.jobs.get(route)
    const { view, resolved } = this.profile(route)
    if (!view.writable) throw new PublicError('当前设置层不可写')
    if (!job || job.id !== id || !job.beforeModels || !job.appliedFingerprint || fingerprint(resolved) !== job.appliedFingerprint) throw new PublicError('配置已变化，不能覆盖恢复')
    await this.mutate([{ op: 'set', path: ['providers', route, 'models'], value: job.beforeModels }], view.revision)
    if (job.beforeOwnership) this.ownership.set(route, job.beforeOwnership)
    delete job.appliedFingerprint
    delete job.appliedAt
    delete job.beforeModels
    delete job.beforeOwnership
    delete job.changed
    this.save()
    return this.status(route)
  }

  /** Manual edits are revision-fenced and explicitly release scan ownership, including no-op saves. */
  async edit(route, id, models, revision) {
    const { view, stored } = this.profile(route)
    if (!view.writable) throw new PublicError('当前设置层不可写')
    if (revision !== view.revision) throw new PublicError('配置已变化，请重新加载')
    const existing = stored.models ?? []
    if (typeof id !== 'string' || !Array.isArray(models) || models.length !== existing.length
      || existing.filter(model => model.id === id).length !== 1) throw new PublicError('无效模型编辑')
    for (let i = 0; i < existing.length; i++) {
      if (existing[i].id !== models[i]?.id) throw new PublicError('模型列表已变化')
      const before = { ...existing[i] }, after = { ...models[i] }
      if (before.id === id) for (const field of ['input', 'reasoningEfforts']) { delete before[field]; delete after[field] }
      // Settings redaction rebuilds objects in schema order; key order is not an edit.
      if (!isDeepStrictEqual(JSON.parse(JSON.stringify(before)), JSON.parse(JSON.stringify(after)))) throw new PublicError('编辑包含不支持的字段')
    }
    await this.mutate([{ op: 'set', path: ['providers', route, 'models'], value: models }], revision)
    const ownership = this.ownership.get(route)
    if (ownership) delete ownership.models[id]
    // A deliberate manual save also fences same-value restoration of an older scan.
    const job = this.jobs.get(route)
    if (job) { delete job.beforeModels; delete job.beforeOwnership; delete job.appliedFingerprint; job.scanVersion = 0 }
    this.save()
    return this.status(route)
  }

  dispose() {
    this.active?.controller.abort()
    for (const job of this.jobs.values()) if (job.status === 'running') job.status = 'interrupted'
    this.save()
    this.disposed = true
  }
}

/**
 * Dispatch one RPC method. Kept separate from the transport so the same
 * table serves tests and any future carrier.
 * @param {ScanService} service
 * @param {string} method
 * @param {unknown} payload
 */
async function dispatchMethod(service, method, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new PublicError('无效扫描请求')
  const { route, id, scope, exclude, addDiscovered, models, revision } = /** @type {Record<string, unknown>} */ (payload)
  switch (method) {
    case 'status':
      return service.status(route)
    case 'start':
      return service.start(route, { scope: scope === 'all' ? 'all' : 'configured' })
    case 'stop':
      return service.stop(route)
    case 'apply':
      return service.apply(route, id, { exclude: exclude === true, addDiscovered: addDiscovered === true })
    case 'restore':
      return service.restore(route, id)
    case 'edit':
      return service.edit(route, id, models, revision)
    default:
      throw new PublicError('未知扫描操作')
  }
}

// Serialize public state-changing operations across routes. Status/stop remain responsive.
export async function dispatch(service, method, payload) {
  if (!['start', 'apply', 'restore', 'edit'].includes(method)) return dispatchMethod(service, method, payload)
  if (service.writing) throw new PublicError('设置操作正在进行，请稍后重试')
  service.writing = true
  try { return await dispatchMethod(service, method, payload) }
  finally { service.writing = false }
}
