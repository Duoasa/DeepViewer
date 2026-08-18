import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { join, resolve, sep } from 'node:path'
import type { App } from 'electron'
import type { RuntimeLaunchSpec } from './runtime-manager.js'

export const SUBSCRIPTIONS_PLUGIN_NAME = 'dsh-plugin-subscriptions'
export const SUBSCRIPTIONS_PLUGIN_VERSION = '0.3.1'
export const PREVIEW_PLUGIN_NAME = '@deepviewer/dsh-plugin-preview'
export const PREVIEW_PLUGIN_VERSION = '0.1.0'
const REQUIRED_SUBSCRIPTIONS_CLIENT_INJECTIONS = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-locale',
] as const
const REQUIRED_PREVIEW_CLIENT_INJECTIONS = [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-deliverables',
  '@deepseek-ai/dsh-client-ui-layout',
] as const

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

export interface SubscriptionsPluginResolution {
  enabled: boolean
  diagnostic: string
  patchPath?: string
}

export type PreviewPluginResolution = SubscriptionsPluginResolution

function packagePath(root: string, relativePath: string): string | undefined {
  const candidate = resolve(root, relativePath)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return undefined
  return existsSync(candidate) ? candidate : undefined
}

function prepareProfileLink(pluginRoot: string, dshHome: string, pluginName: string): boolean {
  const modulesRoot = join(dshHome, 'profiles', 'node_modules')
  const link = join(modulesRoot, ...pluginName.split('/'))
  mkdirSync(resolve(link, '..'), { recursive: true })
  try {
    const current = lstatSync(link)
    if (!current.isSymbolicLink()) return false
    try {
      if (realpathSync(link) === realpathSync(pluginRoot)) return true
    } catch {
      // A stale DeepViewer-managed link is replaced below.
    }
    rmSync(link, { force: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false
  }
  try {
    symlinkSync(pluginRoot, link, process.platform === 'win32' ? 'junction' : 'dir')
    return true
  } catch {
    return false
  }
}

export function resolveSubscriptionsPlugin(
  harnessRoot: string,
  dshHome: string,
  disabled = process.env.DEEPVIEWER_DISABLE_SUBSCRIPTIONS === '1',
): SubscriptionsPluginResolution {
  if (disabled) {
    return { enabled: false, diagnostic: 'SUBSCRIPTIONS_DISABLED' }
  }

  const pluginRoot = join(harnessRoot, 'node_modules', SUBSCRIPTIONS_PLUGIN_NAME)
  const manifestPath = join(pluginRoot, 'package.json')
  if (!existsSync(manifestPath)) {
    return { enabled: false, diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=package-missing' }
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: unknown
      version?: unknown
      license?: unknown
      main?: unknown
      exports?: Record<string, unknown>
      dsh?: {
        bundle?: { patch?: unknown }
        client?: { platform?: unknown; inject?: unknown }
      }
    }
    const clientExport = manifest.exports?.['./client']
    const clientPath = typeof clientExport === 'string'
      ? clientExport
      : clientExport !== null && typeof clientExport === 'object'
        ? (clientExport as { default?: unknown }).default
        : undefined
    const injections = manifest.dsh?.client?.inject
    const patchRelative = manifest.dsh?.bundle?.patch
    const patchPath = typeof patchRelative === 'string' ? packagePath(pluginRoot, patchRelative) : undefined
    const valid = manifest.name === SUBSCRIPTIONS_PLUGIN_NAME
      && manifest.version === SUBSCRIPTIONS_PLUGIN_VERSION
      && manifest.license === 'MIT'
      && typeof manifest.main === 'string'
      && packagePath(pluginRoot, manifest.main) !== undefined
      && typeof clientPath === 'string'
      && packagePath(pluginRoot, clientPath) !== undefined
      && manifest.dsh?.client?.platform === 'web'
      && Array.isArray(injections)
      && REQUIRED_SUBSCRIPTIONS_CLIENT_INJECTIONS.every(name => injections.includes(name))
      && patchPath !== undefined
    if (!valid || patchPath === undefined) {
      return { enabled: false, diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=manifest-invalid' }
    }
    if (!prepareProfileLink(pluginRoot, dshHome, SUBSCRIPTIONS_PLUGIN_NAME)) {
      return { enabled: false, diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=profile-link-occupied' }
    }
    return {
      enabled: true,
      patchPath,
      diagnostic: `SUBSCRIPTIONS_ENABLED version=${SUBSCRIPTIONS_PLUGIN_VERSION}`,
    }
  } catch {
    return { enabled: false, diagnostic: 'SUBSCRIPTIONS_UNAVAILABLE reason=manifest-invalid' }
  }
}

export function resolvePreviewPlugin(
  harnessRoot: string,
  dshHome: string,
  disabled = process.env.DEEPVIEWER_DISABLE_PREVIEW === '1',
): PreviewPluginResolution {
  if (disabled) return { enabled: false, diagnostic: 'PREVIEW_DISABLED' }

  const pluginRoot = join(harnessRoot, 'node_modules', ...PREVIEW_PLUGIN_NAME.split('/'))
  const manifestPath = join(pluginRoot, 'package.json')
  if (!existsSync(manifestPath)) {
    return { enabled: false, diagnostic: 'PREVIEW_UNAVAILABLE reason=package-missing' }
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: unknown
      version?: unknown
      license?: unknown
      main?: unknown
      exports?: Record<string, unknown>
      dsh?: { bundle?: { patch?: unknown }; client?: { platform?: unknown; inject?: unknown } }
    }
    const clientExport = manifest.exports?.['./client']
    const clientPath = typeof clientExport === 'string'
      ? clientExport
      : clientExport !== null && typeof clientExport === 'object'
        ? (clientExport as { default?: unknown }).default
        : undefined
    const injections = manifest.dsh?.client?.inject
    const patchRelative = manifest.dsh?.bundle?.patch
    const patchPath = typeof patchRelative === 'string' ? packagePath(pluginRoot, patchRelative) : undefined
    const valid = manifest.name === PREVIEW_PLUGIN_NAME
      && manifest.version === PREVIEW_PLUGIN_VERSION
      && manifest.license === 'MIT'
      && typeof manifest.main === 'string'
      && packagePath(pluginRoot, manifest.main) !== undefined
      && typeof clientPath === 'string'
      && packagePath(pluginRoot, clientPath) !== undefined
      && manifest.dsh?.client?.platform === 'web'
      && Array.isArray(injections)
      && REQUIRED_PREVIEW_CLIENT_INJECTIONS.every(name => injections.includes(name))
      && patchPath !== undefined
    if (!valid || patchPath === undefined) {
      return { enabled: false, diagnostic: 'PREVIEW_UNAVAILABLE reason=manifest-invalid' }
    }
    if (!prepareProfileLink(pluginRoot, dshHome, PREVIEW_PLUGIN_NAME)) {
      return { enabled: false, diagnostic: 'PREVIEW_UNAVAILABLE reason=profile-link-occupied' }
    }
    return {
      enabled: true,
      patchPath,
      diagnostic: `PREVIEW_ENABLED version=${PREVIEW_PLUGIN_VERSION}`,
    }
  } catch {
    return { enabled: false, diagnostic: 'PREVIEW_UNAVAILABLE reason=manifest-invalid' }
  }
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
  const environment = runtimeEnvironment(app)
  const dshHome = environment.DSH_HOME
  if (dshHome === undefined) throw new Error('DeepViewer Harness home is unavailable')
  mkdirSync(workspaceRoot, { recursive: true })

  let nodeArgs: string[]
  if (existsSync(builtEntry)) {
    nodeArgs = ['--expose-internals', builtEntry]
  } else if (!app.isPackaged && existsSync(sourceEntry)) {
    const tsxLoader = join(harnessRoot, 'node_modules', 'tsx')
    if (!existsSync(tsxLoader)) {
      throw new Error(`Harness dependencies are missing at ${harnessRoot}; run pnpm install and pnpm run build in the pinned upstream checkout`)
    }
    nodeArgs = ['--expose-internals', '--import', 'tsx/esm', sourceEntry]
  } else {
    throw new Error(`Harness runtime entry is missing at ${harnessRoot}`)
  }

  const subscriptions = resolveSubscriptionsPlugin(harnessRoot, dshHome)
  const preview = resolvePreviewPlugin(harnessRoot, dshHome)
  const coreArgs = [...nodeArgs, 'web', '--port', '0']
  const argsWithPatches = (patches: readonly string[]): string[] => [
    ...nodeArgs,
    'web',
    ...patches.flatMap(path => ['--patch', path]),
    '--port',
    '0',
  ]
  const subscriptionArgs = subscriptions.enabled && subscriptions.patchPath !== undefined
    ? argsWithPatches([subscriptions.patchPath])
    : coreArgs
  const primaryPatches = [
    ...(subscriptions.enabled && subscriptions.patchPath !== undefined ? [subscriptions.patchPath] : []),
    ...(preview.enabled && preview.patchPath !== undefined ? [preview.patchPath] : []),
  ]
  const launch: RuntimeLaunchSpec = {
    executable: process.execPath,
    args: primaryPatches.length === 0 ? coreArgs : argsWithPatches(primaryPatches),
    cwd: workspaceRoot,
    env: environment,
    startupDiagnostics: [subscriptions.diagnostic, preview.diagnostic],
    startTimeoutMs: app.isPackaged ? 120_000 : 60_000,
    stopTimeoutMs: 5_000,
    probeTimeoutMs: 5_000,
  }
  const coreFallback: RuntimeLaunchSpec = {
    ...launch,
    args: coreArgs,
    startupDiagnostics: ['SUBSCRIPTIONS_FALLBACK core-only'],
  }
  if (preview.enabled) {
    launch.fallback = {
      ...launch,
      args: subscriptionArgs,
      startupDiagnostics: [subscriptions.enabled
        ? 'PREVIEW_FALLBACK subscriptions-only'
        : 'PREVIEW_FALLBACK core-only'],
      ...(subscriptions.enabled
        ? { integrationName: 'SUBSCRIPTIONS', fallbackDescription: 'core-only', fallback: coreFallback }
        : {}),
    }
    launch.integrationName = 'PREVIEW'
    launch.fallbackDescription = subscriptions.enabled ? 'subscriptions-only' : 'core-only'
  } else if (subscriptions.enabled) {
    launch.integrationName = 'SUBSCRIPTIONS'
    launch.fallbackDescription = 'core-only'
    launch.fallback = coreFallback
  }
  return launch
}
