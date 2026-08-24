import { join } from 'node:path'
import { app, ipcMain, nativeImage, nativeTheme, shell } from 'electron'
import type { ActivityIslandPreferencesPatch } from '../shared/activity-island.js'
import { ActivityIslandCoordinator } from './activity-island-coordinator.js'
import { ActivityIslandPreferencesStore } from './activity-island-preferences-store.js'
import { validateActivityIslandActivity } from './activity-island-validation.js'
import { ActivityIslandWindowController } from './activity-island-window-controller.js'
import {
  DEEPVIEWER_APP_NAME,
  resolveDeepViewerIconPath,
  shouldSetDevelopmentDockIcon,
} from './app-identity.js'
import { shouldQuitWhenAllWindowsClosed } from './app-lifecycle.js'
import { configureDevelopmentProfile } from './development-profile.js'
import { FileLogger } from './logger.js'
import { DarwinProcessAdapter } from './platform/darwin.js'
import { resolveHarnessLaunch } from './resource-locator.js'
import { RuntimeManager, RuntimeLaunchError } from './runtime-manager.js'
import { WindowController } from './window-controller.js'

configureDevelopmentProfile(app)
app.setName(DEEPVIEWER_APP_NAME)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let quitting = false
let launchSpec: ReturnType<typeof resolveHarnessLaunch> | undefined
let logger: FileLogger
let runtime: RuntimeManager
let activityIsland: ActivityIslandWindowController
let activityIslandCoordinator: ActivityIslandCoordinator
let activityIslandPreferences: ActivityIslandPreferencesStore
let runtimeActivitySequence = 0
const windows = new WindowController()

function assertLaunchSurface(event: Electron.IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url
  if (frameUrl === undefined) throw new Error('IPC sender frame is unavailable')
  if (!windows.isLaunchSurface(frameUrl)) throw new Error('IPC is only available to the DeepViewer launch surface')
}

function assertRuntimeSurface(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url
  if (frameUrl === undefined) throw new Error('IPC sender frame is unavailable')
  if (!windows.isRuntimeSurface(frameUrl)) throw new Error('IPC is only available to the Harness runtime surface')
}

function unavailableRuntimeActivity() {
  runtimeActivitySequence += 1
  return {
    schemaVersion: 1 as const,
    sequence: Date.now() * 1_000 + runtimeActivitySequence % 1_000,
    sessionId: 'deepviewer-runtime',
    state: 'unavailable' as const,
    title: 'DeepViewer Runtime',
    occurredAt: Date.now(),
  }
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
    activityIslandPreferences = new ActivityIslandPreferencesStore(
      join(app.getPath('userData'), 'activity-island.json'),
      logger,
    )
    activityIsland = new ActivityIslandWindowController(logger)
    activityIslandCoordinator = new ActivityIslandCoordinator(
      activityIslandPreferences.get(),
      state => activityIsland.render(state),
    )
    runtime.onStatus(status => {
      windows.sendStatus(status)
      if (status.phase === 'failed') {
        activityIslandCoordinator.updateActivity(unavailableRuntimeActivity())
        void windows.showStatus(status)
      } else if (status.phase === 'starting' || status.phase === 'ready') {
        activityIslandCoordinator.updateActivity(null)
      }
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
      const error = await shell.openPath(logDirectory)
      if (error !== '') throw new Error(error)
    })
    ipcMain.on('desktop:set-native-theme', (event, source: unknown) => {
      assertRuntimeSurface(event)
      if (source !== 'light' && source !== 'dark') return
      nativeTheme.themeSource = source
    })
    ipcMain.on('activity-island:publish', (event, value: unknown) => {
      assertRuntimeSurface(event)
      if (value === null) {
        activityIslandCoordinator.updateActivity(null)
        return
      }
      const activity = validateActivityIslandActivity(value)
      if (activity === null) {
        logger.error('activity-island', 'rejected invalid Runtime activity projection')
        return
      }
      activityIslandCoordinator.updateActivity(activity)
    })
    ipcMain.handle('activity-island:get-preferences', (event) => {
      assertRuntimeSurface(event)
      return activityIslandPreferences.get()
    })
    ipcMain.handle('activity-island:set-preferences', (event, patch: unknown) => {
      assertRuntimeSurface(event)
      const preferences = activityIslandPreferences.update(
        patch as ActivityIslandPreferencesPatch,
      )
      activityIslandCoordinator.updatePreferences(preferences)
      windows.sendActivityIslandPreferences(preferences)
      return preferences
    })

    const mainWindow = windows.create({
      logDirectory,
      locale: app.getLocale(),
    })
    activityIsland.attachMainWindow(mainWindow)
    void startRuntime()
  })

  app.on('window-all-closed', () => {
    if (shouldQuitWhenAllWindowsClosed(process.platform)) app.quit()
  })
  app.on('before-quit', (event) => {
    if (quitting || runtime === undefined) return
    event.preventDefault()
    quitting = true
    activityIslandCoordinator?.dispose()
    activityIsland?.dispose()
    void runtime.stop().finally(() => app.exit(0))
  })
}
