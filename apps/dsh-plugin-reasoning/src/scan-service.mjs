import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import { discover, scanModel, mergedModels, LIMITS, SCAN_VERSION } from './scanner.mjs'
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export class ScanService {
  constructor({ read, resolveKey, mutate, file, request = fetch }) {
    Object.assign(this, { read, resolveKey, mutate, file, request }); this.jobs = new Map(); this.modelRecords = new Map(); this.active = undefined
    if (file && existsSync(file)) { try { const saved = JSON.parse(readFileSync(file, 'utf8')); for (const job of saved.jobs ?? []) { if (job.status === 'running') job.status = 'interrupted'; this.jobs.set(job.route, job) } for (const [key, record] of Object.entries(saved.models ?? {})) this.modelRecords.set(key, record) } catch {} }
  }
  save() {
    if (!this.file || this.disposed) return
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file + '.tmp', JSON.stringify({ version: 2, jobs: [...this.jobs.values()], models: Object.fromEntries(this.modelRecords) }), { mode: 0o600 })
    renameSync(this.file + '.tmp', this.file)
  }
  profile(route) {
    if (typeof route !== 'string' || !route || ['__proto__','constructor','prototype'].includes(route)) throw Error('无效提供方')
    const descriptor = this.read(), user = descriptor?.value?.providers ?? descriptor?.user?.providers
    if (!user || !Object.hasOwn(user, route)) throw Error('请先保存此 API 的设置')
    const profile = descriptor.value?.providers?.[route] ?? user[route]
    if (!['openai-completions', 'openai-responses'].includes(profile.api)) throw Error('目前支持 OpenAI Chat Completions / Responses 兼容 API')
    if (!profile.baseURL || !profile.apiKeyEnv) throw Error('请先配置 API 地址和密钥')
    return { descriptor, profile }
  }
  status(route) {
    let current; try { current = fingerprint(this.profile(route).profile) } catch {}
    const job = this.jobs.get(route)
    if (!job) return { status: 'new', limits: LIMITS }
    const { controller, snapshot, beforeModels, appliedFingerprint, ...view } = job
    return { ...view, stale: job.scanVersion !== SCAN_VERSION || current !== (appliedFingerprint ?? snapshot), canRestore: !!beforeModels && current === appliedFingerprint, limits: LIMITS }
  }
  async start(route) {
    if (this.active) throw Error('已有扫描正在运行，请等待或先停止')
    const { profile } = this.profile(route)
    // Reserve the slot before resolving the credential (two callers may race).
    const controller = new AbortController(); this.active = { route, controller }
    try {
      const key = await this.resolveKey(profile.apiKeyEnv)
      if (!key) throw Error('此 API 未配置可用密钥')
      if (controller.signal.aborted) throw Error('扫描已停止')
      if (fingerprint(this.profile(route).profile) !== fingerprint(profile)) throw Error('配置已变化，请重新扫描')
      const job = { scanVersion: SCAN_VERSION, route, id: randomUUID(), status: 'running', startedAt: new Date().toISOString(), snapshot: fingerprint(profile), results: [], total: 0, discovered: 0, progress: 0 }
      this.jobs.set(route, job); this.save()
      void this.run(job, structuredClone(profile), key, controller)
      return this.status(route)
    } catch (error) { this.active = undefined; throw error }
  }
  async run(job, profile, key, controller) {
    try {
      const all = await discover(profile, key, controller.signal, this.request), candidates = all.slice(0, LIMITS.models)
      Object.assign(job, { total: candidates.length, discovered: all.length, truncated: all.length > candidates.length }); this.save()
      let next = 0
      await Promise.allSettled(Array.from({ length: LIMITS.concurrency }, async () => {
        while (next < candidates.length && !controller.signal.aborted) {
          try { if (fingerprint(this.profile(job.route).profile) !== job.snapshot) controller.abort() } catch { controller.abort() }
          if (controller.signal.aborted) return
          const model = candidates[next++]
          const result = await scanModel(profile, key, model, controller.signal, this.request)
          const recordKey = `${job.route}:${model.id}`
          const previous = this.modelRecords.get(recordKey)
          if (result.availability === 'model_not_found') {
            const confirmations = (previous?.listing?.state === 'pending_removal' ? previous.listing.consecutiveConfirmations ?? 1 : 0) + 1
            result.listing = confirmations >= 2 ? { state: 'delisted', reason: 'model_not_found', consecutiveConfirmations: confirmations } : { state: 'pending_removal', reason: 'model_not_found', consecutiveConfirmations: confirmations }
          } else if (result.availability === 'permission_denied') {
            result.listing = { state: previous?.listing?.state === 'delisted' ? 'delisted' : 'listed' }
          }
          this.modelRecords.set(recordKey, { listing: result.listing ?? { state: 'listed' }, availability: { outcome: result.availability, at: new Date().toISOString(), httpStatus: result.http } })
          if (controller.signal.aborted) return
          job.results.push(result); job.progress++; this.save()
        }
      }))
      job.status = controller.signal.aborted ? 'cancelled' : job.progress === job.total ? 'complete' : 'failed'
    } catch (error) {
      job.status = controller.signal.aborted ? 'cancelled' : 'failed'
      // Never expose exception text containing upstream credentials or raw responses.
      job.error = controller.signal.aborted ? '扫描已停止' : '模型目录或网络检查失败，请检查地址、密钥后重试'
    } finally { job.finishedAt = new Date().toISOString(); this.active = undefined; this.save() }
  }
  stop(route) { if (this.active?.route === route) this.active.controller.abort(); return this.status(route) }
  async apply(route, id, exclude = false) {
    const job = this.jobs.get(route), { descriptor, profile } = this.profile(route)
    if (!job || job.id !== id || job.status !== 'complete' || job.appliedFingerprint) throw Error('没有可应用的完整扫描结果')
    if (job.scanVersion !== SCAN_VERSION || fingerprint(profile) !== job.snapshot) throw Error('扫描规则或提供方配置已变化，请重新扫描')
    const existing = profile.models ?? []
    const value = mergedModels(existing, job.results, exclude)
    job.beforeModels = structuredClone(existing); this.save()
    await this.mutate([{ op: 'set', path: ['providers', route, 'models'], value }], descriptor.revision)
    job.appliedFingerprint = fingerprint(this.profile(route).profile); job.appliedAt = new Date().toISOString(); this.save()
    return this.status(route)
  }
  async restore(route, id) {
    const job = this.jobs.get(route), { descriptor, profile } = this.profile(route)
    if (!job || job.id !== id || !job.beforeModels || !job.appliedFingerprint || fingerprint(profile) !== job.appliedFingerprint) throw Error('配置已变化，不能覆盖恢复')
    await this.mutate([{ op: 'set', path: ['providers', route, 'models'], value: job.beforeModels }], descriptor.revision)
    delete job.appliedFingerprint; delete job.appliedAt; delete job.beforeModels; this.save(); return this.status(route)
  }
  dispose() {
    this.active?.controller.abort()
    for (const job of this.jobs.values()) if (job.status === 'running') job.status = 'interrupted'
    this.save(); this.disposed = true
  }
}
