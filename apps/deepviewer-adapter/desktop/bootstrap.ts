import { configureRuntimeNetwork } from './network/runtime-network.ts'
import { app, session, dialog } from 'electron'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { configureDevelopmentProfile, resolveInstalledUserDataPath, developmentUserDataOverride } from './profile/development-profile.js'
import { migrateDeepViewerProfile, migrateDeepViewerFileNames } from './profile/profile-migration.js'
import { prepareUserData } from './profile/user-data-migration.js'
import { prepareDesktopProfile } from '../migrations/desktop-profile.ts'
import { prepareWebState } from '../migrations/web-state.ts'
import { prepareKernelSnapshot } from '../migrations/kernel-snapshot.ts'

export function initializeDeepViewer(): boolean {
  const appRoot = app.getAppPath()
  const product = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
  const development = configureDevelopmentProfile(app, app.isPackaged && !product.deepviewerLocalPreview ? process.env : { ...process.env, DEEPVIEWER_PROFILE: 'development' })
  if (!development) app.setPath('userData', resolveInstalledUserDataPath(app.getPath('appData')))
  app.setName(development ? 'DeepViewer Dev' : 'DeepViewer')
  if (!app.requestSingleInstanceLock()) { app.quit(); return false }
  // Migration briefly owns hidden windows before the official shell installs its lifecycle handler.
  app.on('window-all-closed', () => {})
  const explicitDirectory = development && developmentUserDataOverride(process.env) !== undefined
  migrateDeepViewerProfile({ appData: app.getPath('appData'), development, explicitDirectory })
  migrateDeepViewerFileNames(app.getPath('userData'))
  prepareUserData({ userData: app.getPath('userData'), appData: app.getPath('appData'), development, explicitDirectory })
  const runtime = app.isPackaged ? join(appRoot, 'dsh') : join(appRoot, '.desktop', 'native-runtime')
  process.env.DSH_HOME = join(app.getPath('userData'), 'harness-home')
  prepareKernelSnapshot(process.env.DSH_HOME)
  process.env.DSH_TELEMETRY_MODE = 'DISABLED'
  process.env.DEEPVIEWER_DESKTOP = '1'
  process.env.DSH_DESKTOP_OPEN_DEVTOOLS ??= '0'
  process.env.DEEPVIEWER_HOST_PORT = '0'
  process.env.DEEPVIEWER_BUILD_NUMBER = String(product.buildNumber)
  process.env.DEEPVIEWER_PROJECTS_ROOT = join(app.getPath('documents'), 'DeepViewer', 'Projects')
  process.env.DEEPVIEWER_UPDATE_CHANNEL ??= product.deepviewerUpdateChannel ?? (development ? 'preview' : 'latest')
  if (!app.isPackaged) {
    process.env.DSH_DESKTOP_DSH_DIR = runtime
    process.env.DSH_DESKTOP_PNPM_ENTRY = join(appRoot, 'node_modules', 'pnpm', 'bin', 'pnpm.mjs')
    process.env.DSH_DESKTOP_PRIMARY_RUNTIME_DIR ??= join(appRoot, '.desktop', 'runtime', 'primary-runtime')
  }
  const disabledIntegrations = []
  if (['DEEPVIEWER_DISABLE_SUBSCRIPTIONS_PLUGIN', 'DEEPVIEWER_DISABLE_SUBSCRIPTIONS', 'DEEPVIEWER_DISABLE_SUBSCRIPTIONS'].some(key => process.env[key] === '1')) disabledIntegrations.push('dsh-plugin-subscriptions')
  if (['DEEPVIEWER_DISABLE_MODEL_CAPABILITIES_PLUGIN', 'DEEPVIEWER_DISABLE_MODEL_CAPABILITIES', 'DEEPVIEWER_DISABLE_REASONING', 'DEEPVIEWER_DISABLE_REASONING'].some(key => process.env[key] === '1')) disabledIntegrations.push('@deepviewer/dsh-plugin-model-capabilities')
  prepareDesktopProfile(process.env.DSH_HOME, runtime, [
    { name: '@deepviewer/adapter', version: product.version, directory: join(runtime, 'node_modules', '@deepviewer', 'adapter') },
    { name: 'dsh-plugin-subscriptions', version: '0.3.1', directory: join(runtime, 'node_modules', 'dsh-plugin-subscriptions') },
    { name: '@deepviewer/dsh-plugin-model-capabilities', version: '1.0.2', directory: join(runtime, 'node_modules', '@deepviewer', 'dsh-plugin-model-capabilities') },
  ], disabledIntegrations)
  const hostEnvironment = app.whenReady().then(async () => {
    await prepareWebState(app.getPath('userData'))
    const spec = { cwd: process.env.DSH_HOME!, env: { ...process.env } }
    const bridge = await configureRuntimeNetwork(spec, {
      appVersion: app.getVersion(), resolveProxy: url => session.defaultSession.resolveProxy(url),
      log: message => console.info('[DeepViewer network]', message),
      ask: async (target, signal) => {
        if (signal.aborted) return 'deny'
        const answer = await dialog.showMessageBox({ type: 'question', title: '允许内网访问？', message: `${target.hostname}:${target.port}`, detail: `网页工具请求连接以下本机或内网地址：\n${target.addresses.join('\n')}\n授权仅限此主机、端口和地址，退出应用后失效。`, buttons: ['拒绝', '允许本次', '本次运行内允许'], defaultId: 0, cancelId: 0, noLink: true, signal })
        return answer.response === 2 ? 'run' : answer.response === 1 ? 'once' : 'deny'
      },
    })
    app.once('will-quit', () => { void bridge.close().catch(error => console.error('[DeepViewer network]', error)) })
    return Object.fromEntries(Object.entries(spec.env).filter(([key]) => key.startsWith('DEEPVIEWER_') || ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].includes(key)))
  })
  ;(globalThis as typeof globalThis & { __DEEPVIEWER_HOST_ENVIRONMENT__?: Promise<NodeJS.ProcessEnv> }).__DEEPVIEWER_HOST_ENVIRONMENT__ = hostEnvironment
  // macOS selects the compiled bundle icon and its system appearance. A
  // runtime PNG override would replace that catalog with full-bleed artwork.
  return true
}
