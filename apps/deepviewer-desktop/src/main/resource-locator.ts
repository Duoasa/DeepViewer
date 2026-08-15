import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { App } from 'electron'
import type { RuntimeLaunchSpec } from './runtime-manager.js'

const PASSTHROUGH_ENV = [
  'HOME',
  'USER',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_SEARCH_BASE_URL',
] as const

function compatibleNodeVersion(version: string): boolean {
  const [majorText, minorText] = version.split('.')
  const major = Number(majorText)
  const minor = Number(minorText)
  return major >= 24 || (major === 22 && minor >= 19)
}

function runtimeEnvironment(app: App): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const name of PASSTHROUGH_ENV) {
    const value = process.env[name]
    if (value !== undefined) env[name] = value
  }
  env.ELECTRON_RUN_AS_NODE = '1'
  env.DSH_HOME = join(app.getPath('userData'), 'harness-home')
  env.DSH_TELEMETRY_DISABLED = '1'
  env.FORCE_COLOR = '0'
  return env
}

export function resolveHarnessLaunch(app: App): RuntimeLaunchSpec {
  if (!compatibleNodeVersion(process.versions.node)) {
    throw new Error(`Electron Node ${process.versions.node} does not satisfy Harness engines.node (^22.19.0 || >=24.0.0)`)
  }

  const harnessRoot = app.isPackaged
    ? join(process.resourcesPath, 'harness')
    : resolve(process.env.DEEPVIEWER_HARNESS_ROOT ?? join(app.getAppPath(), '..', '..', 'upstream', 'deepseek-harness'))
  const builtEntry = app.isPackaged
    ? join(harnessRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    : join(harnessRoot, 'apps', 'cli', 'lib', 'bin.js')
  const sourceEntry = join(harnessRoot, 'apps', 'cli', 'src', 'bin.ts')
  const workspaceRoot = join(app.getPath('userData'), 'workspace')
  mkdirSync(workspaceRoot, { recursive: true })

  let args: string[]
  if (existsSync(builtEntry)) {
    args = ['--expose-internals', builtEntry, 'web', '--port', '0']
  } else if (!app.isPackaged && existsSync(sourceEntry)) {
    const tsxLoader = join(harnessRoot, 'node_modules', 'tsx')
    if (!existsSync(tsxLoader)) {
      throw new Error(`Harness dependencies are missing at ${harnessRoot}; run pnpm install and pnpm run build in the pinned upstream checkout`)
    }
    args = ['--expose-internals', '--import', 'tsx/esm', sourceEntry, 'web', '--port', '0']
  } else {
    throw new Error(`Harness runtime entry is missing at ${harnessRoot}`)
  }

  return {
    executable: process.execPath,
    args,
    cwd: workspaceRoot,
    env: runtimeEnvironment(app),
    startTimeoutMs: app.isPackaged ? 120_000 : 60_000,
    stopTimeoutMs: 5_000,
    probeTimeoutMs: 5_000,
  }
}
