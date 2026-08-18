import { EventEmitter } from 'node:events'
import type { Readable } from 'node:stream'
import type { AppLogger } from './logger.js'
import type { PlatformProcessAdapter, RuntimeProcess, RuntimeSpawnSpec } from './platform/process-adapter.js'
import type { RuntimePhase, RuntimeStatusView } from '../shared/runtime-status.js'

export interface RuntimeLaunchSpec extends RuntimeSpawnSpec {
  fallback?: RuntimeLaunchSpec
  integrationName?: string
  fallbackDescription?: string
  readinessPattern?: RegExp
  startupDiagnostics?: string[]
  startTimeoutMs?: number
  stopTimeoutMs?: number
  probeTimeoutMs?: number
}

export class RuntimeLaunchError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RuntimeLaunchError'
    this.code = code
  }
}

type StatusListener = (status: RuntimeStatusView) => void

const DEFAULT_READY_PATTERN = /^dsh web: (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/mu
const LOG_SECRET_PATTERNS = [
  /(\bBearer\s+)[A-Za-z0-9._~+/=-]+/giu,
  /([?&](?:code|token|access_token|refresh_token|id_token)=)[^&\s]+/giu,
  /((?:access_token|refresh_token|id_token|authorization|oauth_code)\s*[:=]\s*)[^\s,}]+/giu,
] as const

function redactRuntimeLog(value: string): string {
  return LOG_SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '$1[REDACTED]'),
    value,
  )
}

export class RuntimeManager {
  private readonly events = new EventEmitter()
  private readonly adapter: PlatformProcessAdapter
  private readonly logger: AppLogger
  private runtime: RuntimeProcess | undefined
  private startPromise: Promise<string> | undefined
  private stopPromise: Promise<void> | undefined
  private status: RuntimeStatusView = {
    phase: 'stopped',
    attempt: 0,
    changedAt: new Date().toISOString(),
  }
  private origin: string | undefined

  constructor(adapter: PlatformProcessAdapter, logger: AppLogger) {
    this.adapter = adapter
    this.logger = logger
  }

  getStatus(): RuntimeStatusView {
    return { ...this.status }
  }

  getOrigin(): string | undefined {
    return this.origin
  }

  onStatus(listener: StatusListener): () => void {
    this.events.on('status', listener)
    return () => this.events.off('status', listener)
  }

  async start(spec: RuntimeLaunchSpec): Promise<string> {
    if (this.status.phase === 'ready' && this.origin !== undefined) return this.origin
    if (this.startPromise !== undefined) return this.startPromise
    if (this.stopPromise !== undefined) await this.stopPromise

    this.startPromise = this.launchWithFallback(spec).finally(() => {
      this.startPromise = undefined
    })
    return this.startPromise
  }

  async stop(deadlineMs = 5_000): Promise<void> {
    if (this.stopPromise !== undefined) return this.stopPromise
    this.stopPromise = this.shutdown(deadlineMs).finally(() => {
      this.stopPromise = undefined
    })
    return this.stopPromise
  }

  private async launchWithFallback(spec: RuntimeLaunchSpec): Promise<string> {
    const fallback = spec.fallback
    try {
      return await this.launch(spec, fallback !== undefined)
    } catch (error) {
      if (fallback === undefined) throw error
      const code = error instanceof RuntimeLaunchError ? error.code : 'RUNTIME_START_FAILED'
      const integration = spec.integrationName ?? 'SUBSCRIPTIONS'
      const target = spec.fallbackDescription ?? 'core-only'
      this.logger.error('runtime:integration', `${integration}_START_FAILED code=${code}; retrying ${target}`)
      return this.launchWithFallback(fallback)
    }
  }

  private async launch(spec: RuntimeLaunchSpec, deferFailure = false): Promise<string> {
    const startTimeoutMs = spec.startTimeoutMs ?? 30_000
    const stopTimeoutMs = spec.stopTimeoutMs ?? 5_000
    const probeTimeoutMs = spec.probeTimeoutMs ?? 3_000
    const readinessPattern = spec.readinessPattern ?? DEFAULT_READY_PATTERN
    this.origin = undefined
    this.transition('starting', { attempt: this.status.attempt + 1 })
    for (const diagnostic of spec.startupDiagnostics ?? []) {
      this.logger.info('runtime:integration', diagnostic)
    }
    this.logger.info('runtime', `starting attempt=${String(this.status.attempt)}`)

    let runtime: RuntimeProcess
    try {
      runtime = this.adapter.spawnRuntime(spec)
      this.runtime = runtime
      this.logger.info('runtime', `spawned pid=${String(runtime.pid)}`)
    } catch (error) {
      const launchError = new RuntimeLaunchError('RUNTIME_SPAWN_FAILED', '无法启动本地 Harness。', { cause: error })
      if (!deferFailure) this.fail(launchError)
      throw launchError
    }

    try {
      const origin = await this.waitUntilReady(runtime, readinessPattern, startTimeoutMs, probeTimeoutMs)
      if (this.runtime !== runtime) throw new RuntimeLaunchError('RUNTIME_REPLACED', 'Harness 启动已被新的生命周期替代。')
      this.origin = origin
      this.transition('ready')
      this.logger.info('runtime', `ready origin=${origin}`)
      return origin
    } catch (error) {
      const launchError = error instanceof RuntimeLaunchError
        ? error
        : new RuntimeLaunchError('RUNTIME_START_FAILED', 'Harness 启动失败。', { cause: error })
      await this.adapter.terminateTree(runtime, stopTimeoutMs).catch(terminateError => {
        this.logger.error('runtime', `cleanup failed: ${String(terminateError)}`)
      })
      if (this.runtime === runtime) this.runtime = undefined
      if (!deferFailure) this.fail(launchError)
      throw launchError
    }
  }

  private waitUntilReady(
    runtime: RuntimeProcess,
    readinessPattern: RegExp,
    startTimeoutMs: number,
    probeTimeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false
      let stdoutBuffer = ''

      const finish = (error?: RuntimeLaunchError, origin?: string): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error !== undefined) reject(error)
        else if (origin !== undefined) resolve(origin)
      }

      const inspectStdout = (chunk: Buffer | string): void => {
        const text = chunk.toString()
        this.logRuntimeChunk('stdout', text)
        stdoutBuffer = `${stdoutBuffer}${text}`.slice(-8_192)
        const match = readinessPattern.exec(stdoutBuffer)
        if (match?.[1] === undefined) return
        const candidate = match[1]
        void this.probe(candidate, probeTimeoutMs).then(
          () => finish(undefined, candidate),
          error => finish(new RuntimeLaunchError('RUNTIME_PROBE_FAILED', 'Harness 已启动，但本地页面健康检查失败。', { cause: error })),
        )
      }

      const inspectStderr = (chunk: Buffer | string): void => {
        this.logRuntimeChunk('stderr', chunk.toString())
      }

      runtime.child.stdout?.on('data', inspectStdout)
      runtime.child.stderr?.on('data', inspectStderr)
      runtime.child.once('error', error => {
        finish(new RuntimeLaunchError('RUNTIME_PROCESS_ERROR', 'Harness 进程启动失败。', { cause: error }))
      })
      runtime.child.once('exit', (code, signal) => {
        if (!settled) {
          finish(new RuntimeLaunchError(
            'RUNTIME_EXITED_EARLY',
            `Harness 在就绪前退出（code=${String(code)}, signal=${String(signal)}）。`,
          ))
          return
        }
        if (this.runtime === runtime && this.status.phase === 'ready') {
          this.runtime = undefined
          this.origin = undefined
          const error = new RuntimeLaunchError(
            'RUNTIME_EXITED',
            `Harness 意外退出（code=${String(code)}, signal=${String(signal)}）。`,
          )
          this.fail(error)
        }
      })

      const timer = setTimeout(() => {
        finish(new RuntimeLaunchError('RUNTIME_START_TIMEOUT', `Harness 未能在 ${String(startTimeoutMs)}ms 内就绪。`))
      }, startTimeoutMs)
    })
  }

  private async probe(origin: string, timeoutMs: number): Promise<void> {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') {
      throw new Error(`refusing non-loopback runtime origin: ${origin}`)
    }
    const response = await fetch(parsed, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`runtime probe returned HTTP ${String(response.status)}`)
  }

  private async shutdown(deadlineMs: number): Promise<void> {
    const runtime = this.runtime
    this.origin = undefined
    if (runtime === undefined) {
      this.transition('stopped')
      return
    }

    this.transition('stopping')
    this.logger.info('runtime', `stopping pid=${String(runtime.pid)}`)
    try {
      await this.adapter.terminateTree(runtime, deadlineMs)
      this.logger.info('runtime', `stopped pid=${String(runtime.pid)}`)
    } catch (error) {
      this.logger.error('runtime', `stop failed: ${String(error)}`)
      throw error
    } finally {
      if (this.runtime === runtime) this.runtime = undefined
      this.transition('stopped')
    }
  }

  private fail(error: RuntimeLaunchError): void {
    const cause = error.cause === undefined ? '' : ` cause=${String(error.cause)}`
    this.logger.error('runtime', redactRuntimeLog(`${error.code}: ${error.message}${cause}`))
    this.transition('failed', { errorCode: error.code, userMessage: error.message })
  }

  private transition(
    phase: RuntimePhase,
    update: Partial<Pick<RuntimeStatusView, 'attempt' | 'errorCode' | 'userMessage'>> = {},
  ): void {
    const next: RuntimeStatusView = {
      phase,
      attempt: update.attempt ?? this.status.attempt,
      changedAt: new Date().toISOString(),
      ...(update.errorCode === undefined ? {} : { errorCode: update.errorCode }),
      ...(update.userMessage === undefined ? {} : { userMessage: update.userMessage }),
    }
    this.status = next
    this.events.emit('status', { ...next })
  }

  private logRuntimeChunk(stream: 'stdout' | 'stderr', text: string): void {
    for (const line of text.split(/\r?\n/u)) {
      if (line !== '') this.logger.info(`harness:${stream}`, redactRuntimeLog(line))
    }
  }
}
