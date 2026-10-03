import { writeFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
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
export const MODEL_CAPABILITIES_PLUGIN_NAME = '@deepviewer/dsh-plugin-model-capabilities'
export const MODEL_CAPABILITIES_PLUGIN_VERSION = '1.0.2'
const DSH_PLUGIN_PEER_VERSION = '0.2.0-rc.2'
const CORDIS_PLUGIN_PEER_VERSION = '4.0.4'
const REQUIRED_SUBSCRIPTIONS_PEERS = [
  '@deepseek-ai/dsh-attachment',
  '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-tools',
] as const
const REQUIRED_PREVIEW_DSH_PEERS = [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-deliverables',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
] as const
const REQUIRED_SUBSCRIPTIONS_CLIENT_INJECTIONS = [
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-locale',
] as const
const REQUIRED_PREVIEW_CLIENT_INJECTIONS = [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-deliverables',
  '@deepseek-ai/dsh-client-ui-layout',
] as const

function compatibleNodeVersion(version: string): boolean {
  const [majorText, minorText] = version.split('.')
  const major = Number(majorText)
  const minor = Number(minorText)
  return major >= 24 || (major === 22 && minor >= 19)
}

export function runtimeEnvironment(
  app: Pick<App, 'getPath'>,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  // Match a direct dsh web launch: tool/provider environment belongs to the
  // host process. DSH remains responsible for tool sandboxing and approvals.
  const env: NodeJS.ProcessEnv = { ...inherited }
  env.ELECTRON_RUN_AS_NODE = '1'
  env.DSH_HOME = join(app.getPath('userData'), 'harness-home')
  env.DEEPVIEWER_PROJECTS_ROOT = join(app.getPath('documents'), 'DeepViewer', 'Projects')
  env.DEEPVIEWER_SESSION_SEARCH = '1'
  // Older Harness snapshots consume these aliases; both point to DeepViewer data.
  env.DEEPVIEWER_PROJECTS_ROOT = env.DEEPVIEWER_PROJECTS_ROOT
  env.DEEPVIEWER_SESSION_SEARCH = env.DEEPVIEWER_SESSION_SEARCH
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

export function buildHarnessWebArgs(
  nodeArgs: readonly string[],
  patches: readonly string[] = [],
): string[] {
  return [
    ...nodeArgs,
    'web',
    ...patches.flatMap(path => ['--patch', path]),
    '--port',
    '0',
    // The Harness web profile opens the system browser by default; the desktop shell owns the UI.
    '--no-open',
  ]
}

function packagePath(root: string, relativePath: string): string | undefined {
  const candidate = resolve(root, relativePath)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return undefined
  return existsSync(candidate) ? candidate : undefined
}

function hasExactPeers(
  peers: Record<string, unknown> | undefined,
  names: readonly string[],
  version: string,
): boolean {
  return peers !== undefined && names.every(name => peers[name] === version)
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
  disabled = (process.env.DEEPVIEWER_DISABLE_SUBSCRIPTIONS ?? process.env.DEEPVIEWER_DISABLE_SUBSCRIPTIONS) === '1',
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
      peerDependencies?: Record<string, unknown>
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
      && hasExactPeers(manifest.peerDependencies, REQUIRED_SUBSCRIPTIONS_PEERS, DSH_PLUGIN_PEER_VERSION)
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

/** @deprecated DVP-0002 is retained as source only; resolveHarnessLaunch uses official DSH preview. */
export function resolvePreviewPlugin(
  harnessRoot: string,
  dshHome: string,
  disabled = (process.env.DEEPVIEWER_DISABLE_PREVIEW ?? process.env.DEEPVIEWER_DISABLE_PREVIEW) === '1',
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
      peerDependencies?: Record<string, unknown>
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
      && manifest.peerDependencies?.['@deepseek-ai/cordis'] === CORDIS_PLUGIN_PEER_VERSION
      && hasExactPeers(manifest.peerDependencies, REQUIRED_PREVIEW_DSH_PEERS, DSH_PLUGIN_PEER_VERSION)
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

export function resolveModelCapabilitiesPlugin(harnessRoot: string, dshHome: string, disabled = (process.env.DEEPVIEWER_DISABLE_MODEL_CAPABILITIES ?? process.env.DEEPVIEWER_DISABLE_REASONING ?? process.env.DEEPVIEWER_DISABLE_REASONING) === '1'): SubscriptionsPluginResolution {
  if (disabled) return { enabled: false, diagnostic: 'MODEL_CAPABILITIES_DISABLED' }
  const name = MODEL_CAPABILITIES_PLUGIN_NAME
  const root = join(harnessRoot, 'node_modules', name)
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const patchPath = join(root, 'cordis.patch.yml')
    if (manifest.name !== name || manifest.version !== MODEL_CAPABILITIES_PLUGIN_VERSION || manifest.license !== 'MIT'
      || manifest.dsh?.bundle?.patch !== './cordis.patch.yml' || manifest.dsh?.client?.platform !== 'web'
      || manifest.peerDependencies?.['@deepseek-ai/cordis'] !== CORDIS_PLUGIN_PEER_VERSION
      || !hasExactPeers(manifest.peerDependencies, ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-credentials', '@deepseek-ai/dsh-home-paths', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-settings-models', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-locale'], DSH_PLUGIN_PEER_VERSION)
      || !Array.isArray(manifest.dsh?.client?.inject)
      || !['@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-settings-models', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-api-remotes'].every(peer => manifest.dsh.client.inject.includes(peer))
      || manifest.main !== './lib/index.js' || manifest.exports?.['./client'] !== './lib/client.js'
      || !['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'LICENSE'].every(file => existsSync(join(root, file)))) {
      return { enabled: false, diagnostic: 'MODEL_CAPABILITIES_UNAVAILABLE reason=manifest-invalid' }
    }
    if (!prepareProfileLink(root, dshHome, name)) return { enabled: false, diagnostic: 'MODEL_CAPABILITIES_UNAVAILABLE reason=profile-link-occupied' }
    for (const legacy of ['@deepviewer/dsh-plugin-reasoning']) {
      const link = join(dshHome, 'profiles', 'node_modules', legacy)
      // Only retire links owned by this runtime. Do not remove user-installed packages or reports.
      try {
        if (lstatSync(link).isSymbolicLink() && resolve(link, '..', readlinkSync(link)) === resolve(harnessRoot, 'node_modules', legacy)) rmSync(link)
      } catch { /* absent or user-managed legacy installation: leave it alone */ }
    }
    return { enabled: true, patchPath, diagnostic: `MODEL_CAPABILITIES_ENABLED version=${MODEL_CAPABILITIES_PLUGIN_VERSION}` }
  } catch { return { enabled: false, diagnostic: 'MODEL_CAPABILITIES_UNAVAILABLE reason=package-missing-or-invalid' } }
}

/** RC2 form writes require a bundle below the writable profile patch layer. */
export function prepareBetterSidebarProfile(dshHome: string): string {
  const dir = join(dshHome, 'profiles', 'web')
  const path = join(dir, 'package.json')
  const manifest = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {
    private: true, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
  }
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles) || !bundles.every((name: unknown) => typeof name === 'string')) {
    throw new Error('Invalid web profile bundle list')
  }
  mkdirSync(dir, { recursive: true })
  if (!bundles.includes('dsh-better-sidebar')) {
    bundles.push('dsh-better-sidebar')
    const temporary = `${path}.deepviewer-${process.pid}.tmp`
    writeFileSync(temporary, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
    renameSync(temporary, path)
  }
  const patchPath = join(dshHome, 'deepviewer-sidebar-enable.patch.yml')
  writeFileSync(patchPath, '- id: better-sidebar\n  disabled: false\n', { mode: 0o600 })
  return patchPath
}

function hasBetterSidebarProfile(dshHome: string): boolean {
  const path = join(dshHome, 'profiles', 'web', 'package.json')
  return existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).dsh?.profile?.bundles?.includes('dsh-better-sidebar') === true
}

export function resolveBetterSidebarPlugin(
  harnessRoot: string,
  dshHome: string,
  disabled = (process.env.DEEPVIEWER_DISABLE_BETTER_SIDEBAR ?? process.env.DEEPVIEWER_DISABLE_BETTER_SIDEBAR) === '1',
): SubscriptionsPluginResolution {
  if (disabled) return { enabled: false, diagnostic: 'BETTER_SIDEBAR_DISABLED' }
  const name = 'dsh-better-sidebar'
  const root = join(harnessRoot, 'node_modules', name)
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    if (manifest.name !== name || manifest.version !== '0.19.1' || manifest.license !== 'MIT'
      || manifest.deepviewerAdapter !== 'deepviewer-dsh017-sidebar-management-v1'
      || manifest.dsh?.bundle?.patch !== './cordis.patch.yml' || manifest.dsh?.client?.platform !== 'web'
      || !manifest.dsh.client.inject?.includes('@deepseek-ai/dsh-client-ui-sidebar-right')
      || !['lib/index.js', 'lib/client.js', 'lib/client-terminal.js', 'lib/client-editor.js', 'lib/client-mermaid.js', 'cordis.patch.yml', 'LICENSE'].every(file => existsSync(join(root, file)))) {
      return { enabled: false, diagnostic: 'BETTER_SIDEBAR_UNAVAILABLE reason=manifest-invalid' }
    }
    if (!prepareProfileLink(root, dshHome, name)) return { enabled: false, diagnostic: 'BETTER_SIDEBAR_UNAVAILABLE reason=profile-link-occupied' }
    return { enabled: true, patchPath: prepareBetterSidebarProfile(dshHome), diagnostic: 'BETTER_SIDEBAR_ENABLED version=0.19.1' }
  } catch { return { enabled: false, diagnostic: 'BETTER_SIDEBAR_UNAVAILABLE reason=package-missing-or-invalid' } }
}

export function resolveHarnessLaunch(app: App): RuntimeLaunchSpec {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error('DeepViewer 仅支持 Apple Silicon（macOS arm64）。')
  }
  if (!compatibleNodeVersion(process.versions.node)) {
    throw new Error(`Electron Node ${process.versions.node} does not satisfy Harness engines.node (^22.19.0 || >=24.0.0)`)
  }

  const harnessRoot = app.isPackaged
    ? join(process.resourcesPath, 'harness')
    : resolve(process.env.DEEPVIEWER_HARNESS_ROOT ?? process.env.DEEPVIEWER_HARNESS_ROOT ?? join(app.getAppPath(), '..', '..', 'upstream', 'deepseek-harness'))
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
  const capabilities = resolveModelCapabilitiesPlugin(harnessRoot, dshHome)
  const sidebar = resolveBetterSidebarPlugin(harnessRoot, dshHome)

  const desktopPatch = join(dshHome, 'deepviewer-desktop.patch.yml')
  mkdirSync(dshHome, { recursive: true })
  writeFileSync(desktopPatch, '- id: ui-sidebar-browser\n  disabled: false\n' +
    (hasBetterSidebarProfile(dshHome) ? '- id: better-sidebar\n  disabled: true\n' : ''))
  const coreArgs = buildHarnessWebArgs(nodeArgs, [desktopPatch])
  const argsWithPatches = (patches: readonly string[]): string[] => (
    buildHarnessWebArgs(nodeArgs, [desktopPatch, ...patches])
  )
  const primaryPatches = [
    ...(capabilities.enabled && capabilities.patchPath ? [capabilities.patchPath] : []),
    ...(subscriptions.enabled && subscriptions.patchPath !== undefined ? [subscriptions.patchPath] : []),
  ]
  const launch: RuntimeLaunchSpec = {
    executable: process.execPath,
    args: primaryPatches.length === 0 ? coreArgs : argsWithPatches(primaryPatches),
    cwd: workspaceRoot,
    env: environment,
    startupDiagnostics: [subscriptions.diagnostic, capabilities.diagnostic, 'PREVIEW_OFFICIAL DSH=0.1.7-rc.2'],
    startTimeoutMs: app.isPackaged ? 120_000 : 60_000,
    stopTimeoutMs: 5_000,
    probeTimeoutMs: 5_000,
  }
  const coreFallback: RuntimeLaunchSpec = {
    ...launch,
    args: coreArgs,
    startupDiagnostics: ['INTEGRATIONS_FALLBACK core-only'],
  }
  if (subscriptions.enabled || capabilities.enabled) {
    launch.integrationName = 'DESKTOP_PLUGINS'
    launch.fallbackDescription = 'core-only'
    launch.fallback = coreFallback
  }
  if (sidebar.enabled && sidebar.patchPath !== undefined) {
    return {
      ...launch,
      args: argsWithPatches([...primaryPatches, sidebar.patchPath]),
      startupDiagnostics: [...(launch.startupDiagnostics ?? []), sidebar.diagnostic],
      integrationName: 'BETTER_SIDEBAR',
      fallbackDescription: 'existing desktop plugins',
      fallback: launch,
    }
  }
  launch.startupDiagnostics?.push(sidebar.diagnostic)
  return launch
}
