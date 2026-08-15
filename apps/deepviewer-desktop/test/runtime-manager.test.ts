import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { AppLogger } from '../src/main/logger.js'
import { DarwinProcessAdapter } from '../src/main/platform/darwin.js'
import { RuntimeLaunchError, RuntimeManager } from '../src/main/runtime-manager.js'

const fixture = fileURLToPath(new URL('./fixtures/fake-harness.mjs', import.meta.url))

class MemoryLogger implements AppLogger {
  readonly filePath = '/tmp/deepviewer-test.log'
  readonly messages: string[] = []

  info(component: string, message: string): void {
    this.messages.push(`INFO ${component} ${message}`)
  }

  error(component: string, message: string): void {
    this.messages.push(`ERROR ${component} ${message}`)
  }
}

function spec(mode = 'ready') {
  return {
    executable: process.execPath,
    args: [fixture, mode],
    cwd: process.cwd(),
    env: { ...process.env },
    startTimeoutMs: 5_000,
    stopTimeoutMs: 2_000,
    probeTimeoutMs: 2_000,
  }
}

describe('RuntimeManager', () => {
  it('moves from starting to ready and releases the port on stop', async () => {
    const logger = new MemoryLogger()
    const manager = new RuntimeManager(new DarwinProcessAdapter(), logger)
    const phases: string[] = []
    manager.onStatus(status => phases.push(status.phase))

    const origin = await manager.start(spec())
    expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u)
    expect(manager.getStatus().phase).toBe('ready')
    expect(await fetch(origin).then(response => response.text())).toContain('READY')

    await manager.stop()
    expect(manager.getStatus().phase).toBe('stopped')
    expect(phases).toEqual(['starting', 'ready', 'stopping', 'stopped'])
    await expect(fetch(origin)).rejects.toThrow()
  })

  it('reports a stable error when the runtime exits before readiness', async () => {
    const manager = new RuntimeManager(new DarwinProcessAdapter(), new MemoryLogger())

    await expect(manager.start(spec('exit'))).rejects.toMatchObject({
      code: 'RUNTIME_EXITED_EARLY',
    } satisfies Partial<RuntimeLaunchError>)
    expect(manager.getStatus()).toMatchObject({
      phase: 'failed',
      errorCode: 'RUNTIME_EXITED_EARLY',
    })
  })

  it('stops a runtime process group that owns a descendant', async () => {
    const manager = new RuntimeManager(new DarwinProcessAdapter(), new MemoryLogger())
    const origin = await manager.start(spec('child'))

    await manager.stop()

    expect(manager.getStatus().phase).toBe('stopped')
    await expect(fetch(origin)).rejects.toThrow()
  })
})
