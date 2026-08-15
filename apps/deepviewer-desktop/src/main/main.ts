import { join } from 'node:path'
import { app, ipcMain, nativeImage, shell } from 'electron'
import {
  DEEPVIEWER_APP_NAME,
  resolveDeepViewerIconPath,
  shouldSetDevelopmentDockIcon,
} from './app-identity.js'
import { FileLogger } from './logger.js'
import { DarwinProcessAdapter } from './platform/darwin.js'
import { resolveHarnessLaunch } from './resource-locator.js'
import { RuntimeManager, RuntimeLaunchError } from './runtime-manager.js'
import { WindowController } from './window-controller.js'

app.setName(DEEPVIEWER_APP_NAME)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let quitting = false
let launchSpec: ReturnType<typeof resolveHarnessLaunch> | undefined
let logger: FileLogger
let runtime: RuntimeManager
const windows = new WindowController()

function assertLaunchSurface(event: Electron.IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url
  if (frameUrl === undefined) throw new Error('IPC sender frame is unavailable')
  if (!windows.isLaunchSurface(frameUrl)) throw new Error('IPC is only available to the DeepViewer launch surface')
}

async function startRuntime(): Promise<void> {
  try {
    launchSpec ??= resolveHarnessLaunch(app)
    const origin = await runtime.start(launchSpec)
    if (quitting) return
    await windows.showRuntime(origin)
  } catch (error) {
    if (quitting) return
    const code = error instanceof RuntimeLaunchError ? error.code : 'RUNTIME_CONFIGURATION_FAILED'
    const message = error instanceof Error ? error.message : String(error)
    logger.error('desktop', `${code}: ${message}`)
    if (!(error instanceof RuntimeLaunchError)) {
      windows.sendStatus({
        phase: 'failed',
        attempt: runtime.getStatus().attempt,
        changedAt: new Date().toISOString(),
        errorCode: code,
        userMessage: message,
      })
    }
  }
}

if (gotLock) {
  app.on('second-instance', () => windows.focus())

  void app.whenReady().then(() => {
    if (shouldSetDevelopmentDockIcon(process.platform, app.isPackaged)) {
      const dockIcon = nativeImage.createFromPath(resolveDeepViewerIconPath(app.getAppPath()))
      if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon)
    }
    logger = new FileLogger(join(app.getPath('userData'), 'logs', 'deepviewer.log'))
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
      return runtime.getStatus()
    })
    ipcMain.handle('runtime:retry', async (event) => {
      assertLaunchSurface(event)
      await runtime.stop()
      await startRuntime()
    })
    ipcMain.handle('desktop:open-log-directory', async (event) => {
      assertLaunchSurface(event)
      const error = await shell.openPath(join(app.getPath('userData'), 'logs'))
      if (error !== '') throw new Error(error)
    })

    windows.create()
    void startRuntime()
  })

  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (quitting || runtime === undefined) return
    event.preventDefault()
    quitting = true
    void runtime.stop().finally(() => app.exit(0))
  })
}
