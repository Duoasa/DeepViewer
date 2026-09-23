import { join } from 'node:path'
import { app, ipcMain, nativeImage, nativeTheme, shell, session, dialog } from 'electron'
import {
  DEEPVIEWER_APP_NAME,
  resolveDeepViewerIconPath,
  shouldSetDevelopmentDockIcon,
} from './app-identity.js'
import { shouldQuitWhenAllWindowsClosed } from './app-lifecycle.js'
import { configureDevelopmentProfile, resolveInstalledUserDataPath } from './development-profile.js'
import { prepareUserData } from './user-data-migration.js'
import { FileLogger } from './logger.js'
import { DarwinProcessAdapter } from './platform/darwin.js'
import { resolveHarnessLaunch } from './resource-locator.js'
import { RuntimeManager, RuntimeLaunchError } from './runtime-manager.js'
import { configureRuntimeNetwork } from './network/runtime-network.js'
import type { NetworkBridge } from './network/bridge.js'
import { WindowController } from './window-controller.js'
import type { RuntimeStatusView } from '../shared/runtime-status.js'

const developmentProfile = configureDevelopmentProfile(app, app.isPackaged ? process.env : { ...process.env, DEEPVIEWER_PROFILE: 'development' })
if (!developmentProfile) app.setPath('userData', resolveInstalledUserDataPath(app.getPath('appData')))
app.setName(DEEPVIEWER_APP_NAME)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let quitting = false
let launchSpec: ReturnType<typeof resolveHarnessLaunch> | undefined
let logger: FileLogger
let runtime: RuntimeManager
let network: NetworkBridge | undefined
let networkStarting: Promise<NetworkBridge> | undefined
let startupFailure: RuntimeStatusView | undefined
const windows = new WindowController()

function assertLaunchSurface(event: Electron.IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url
  if (frameUrl === undefined) throw new Error('IPC sender frame is unavailable')
  if (!windows.isLaunchSurface(frameUrl)) throw new Error('IPC is only available to the DeepViewer launch surface')
}

function assertRuntimeSurface(event: Electron.IpcMainEvent): void {
  const frameUrl = event.senderFrame?.url
  if (frameUrl === undefined) throw new Error('IPC sender frame is unavailable')
  if (!windows.isRuntimeSurface(frameUrl)) throw new Error('IPC is only available to the Harness runtime surface')
}

async function startRuntime(): Promise<void> {
  startupFailure = undefined
  try {
    const data = prepareUserData({
      userData: app.getPath('userData'),
      appData: app.getPath('appData'),
      development: developmentProfile,
      explicitDirectory: developmentProfile && process.env.DEEPVIEWER_DEV_USER_DATA !== undefined,
    })
    logger.info('data', `layout=1 imported=${data.migrated} sources=${data.sourceCount} conflicts=${data.conflictCount}${data.backupDirectory ? ` backup=${data.backupDirectory}` : ''}`)
    launchSpec ??= resolveHarnessLaunch(app)
    network ??= await (networkStarting ??= configureRuntimeNetwork(launchSpec, {
      appVersion: app.getVersion(),
      resolveProxy: url => session.defaultSession.resolveProxy(url),
      log: message => logger.info('network', message),
      ask: async (target, signal) => {
        if (quitting || signal.aborted) return 'deny'
        const zh = app.getLocale().toLowerCase().startsWith('zh')
        const answer = await dialog.showMessageBox({
          type: 'question', defaultId: 0, cancelId: 0, noLink: true, signal,
          title: zh ? '允许内网访问？' : 'Allow local network access?',
          message: `${target.hostname}:${target.port}`,
          detail: zh
            ? `网页抓取工具请求直接连接以下本机或内网地址：\n${target.addresses.join('\n')}\n\n仅在你希望访问此服务时允许。本次运行内的授权只适用于此主机、端口及这些地址；退出应用后失效。`
            : `The web fetch tool requests a direct connection to these local/private addresses:\n${target.addresses.join('\n')}\n\nAllow only if you intend to access this service. A grant for this run covers only this host, port and these addresses, and expires when the app exits.`,
          buttons: zh ? ['拒绝', '允许本次', '本次运行内允许此地址'] : ['Deny', 'Allow once', 'Allow this address for this run'],
        })
        return answer.response === 2 ? 'run' : answer.response === 1 ? 'once' : 'deny'
      },
    }).catch(error => { networkStarting = undefined; throw error }))
    const origin = await runtime.start(launchSpec)
    if (quitting) return
    await windows.showRuntime(origin)
  } catch (error) {
    if (quitting) return
    const code = error instanceof RuntimeLaunchError ? error.code : 'RUNTIME_CONFIGURATION_FAILED'
    const message = error instanceof Error ? error.message : String(error)
    logger.error('desktop', `${code}: ${message}`)
    if (!(error instanceof RuntimeLaunchError)) {
      startupFailure = {
        phase: 'failed',
        attempt: runtime.getStatus().attempt,
        changedAt: new Date().toISOString(),
        errorCode: code,
        userMessage: message,
      }
      windows.sendStatus(startupFailure)
      await windows.showStatus(startupFailure)
    }
  }
}

if (gotLock) {
  app.on('second-instance', () => windows.focus())
  app.on('activate', () => windows.focus())

  void app.whenReady().then(() => {
    if (shouldSetDevelopmentDockIcon(process.platform, app.isPackaged)) {
      const dockIcon = nativeImage.createFromPath(resolveDeepViewerIconPath(app.getAppPath()))
      if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon)
    }
    const logDirectory = join(app.getPath('userData'), 'logs')
    logger = new FileLogger(join(logDirectory, 'deepviewer.log'))
    if (process.platform !== 'darwin') {
      logger.error('desktop', `unsupported platform in DV-0003: ${process.platform}`)
    }
    runtime = new RuntimeManager(new DarwinProcessAdapter(), logger)
    runtime.onStatus(status => {
      windows.sendStatus(status)
      if (status.phase === 'failed') void windows.showStatus(status)
    })

    ipcMain.handle('runtime:get-status', (event) => {
      assertLaunchSurface(event)
      return startupFailure ?? runtime.getStatus()
    })
    ipcMain.handle('runtime:retry', async (event) => {
      assertLaunchSurface(event)
      await runtime.stop()
      await startRuntime()
    })
    ipcMain.handle('desktop:open-log-directory', async (event) => {
      assertLaunchSurface(event)
      const error = await shell.openPath(logDirectory)
      if (error !== '') throw new Error(error)
    })
    ipcMain.on('desktop:set-native-theme', (event, source: unknown) => {
      assertRuntimeSurface(event)
      if (source !== 'light' && source !== 'dark' && source !== 'system') return
      nativeTheme.themeSource = source
    })

    windows.create({
      logDirectory,
      locale: app.getLocale(),
    })
    void startRuntime()
  })

  app.on('window-all-closed', () => {
    if (shouldQuitWhenAllWindowsClosed(process.platform)) app.quit()
  })
  app.on('before-quit', (event) => {
    if (quitting || runtime === undefined) return
    event.preventDefault()
    quitting = true
    void runtime.stop().finally(async () => { await network?.close(); app.exit(0) })
  })
}
