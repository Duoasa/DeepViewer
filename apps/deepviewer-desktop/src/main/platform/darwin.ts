import { spawn } from 'node:child_process'
import { once } from 'node:events'
import type { PlatformProcessAdapter, RuntimeProcess, RuntimeSpawnSpec } from './process-adapter.js'

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export class DarwinProcessAdapter implements PlatformProcessAdapter {
  spawnRuntime(spec: RuntimeSpawnSpec): RuntimeProcess {
    const child = spawn(spec.executable, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (child.pid === undefined) throw new Error('runtime spawn returned no pid')
    return { child, pid: child.pid }
  }

  isAlive(runtime: RuntimeProcess): boolean {
    try {
      process.kill(runtime.pid, 0)
      return true
    } catch {
      return false
    }
  }

  async terminateTree(runtime: RuntimeProcess, deadlineMs: number): Promise<void> {
    if (!this.isAlive(runtime)) return
    this.signalGroup(runtime.pid, 'SIGTERM')

    const exited = once(runtime.child, 'exit').then(() => true)
    const graceful = await Promise.race([exited, delay(deadlineMs).then(() => false)])
    if (graceful || !this.isAlive(runtime)) return

    this.signalGroup(runtime.pid, 'SIGKILL')
    await Promise.race([exited, delay(Math.min(deadlineMs, 1_000))])
  }

  private signalGroup(pid: number, signal: NodeJS.Signals): void {
    try {
      process.kill(-pid, signal)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ESRCH') throw error
    }
  }
}
