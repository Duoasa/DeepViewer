import type { ChildProcess } from 'node:child_process'

export interface RuntimeSpawnSpec {
  executable: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

export interface RuntimeProcess {
  child: ChildProcess
  pid: number
}

export interface PlatformProcessAdapter {
  spawnRuntime(spec: RuntimeSpawnSpec): RuntimeProcess
  terminateTree(process: RuntimeProcess, deadlineMs: number): Promise<void>
  isAlive(process: RuntimeProcess): boolean
}
