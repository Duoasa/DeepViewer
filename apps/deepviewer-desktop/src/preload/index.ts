import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActivityIslandActivity,
  ActivityIslandAnchor,
  ActivityIslandPreferences,
  ActivityIslandPreferencesPatch,
} from '../shared/activity-island.js'
import type {
  DeepViewerDesktopApi,
  NativeThemeSource,
  RuntimeStatusView,
} from '../shared/runtime-status.js'

const api: DeepViewerDesktopApi = {
  getRuntimeStatus: () => ipcRenderer.invoke('runtime:get-status') as Promise<RuntimeStatusView>,
  retryRuntime: () => ipcRenderer.invoke('runtime:retry') as Promise<void>,
  openLogDirectory: () => ipcRenderer.invoke('desktop:open-log-directory') as Promise<void>,
  setNativeThemeSource: (source: NativeThemeSource) => ipcRenderer.send('desktop:set-native-theme', source),
  publishActivityIsland: (activity: ActivityIslandActivity | null) => {
    ipcRenderer.send('activity-island:publish', activity)
  },
  publishActivityIslandAnchor: (anchor: ActivityIslandAnchor) => {
    ipcRenderer.send('activity-island:anchor', anchor)
  },
  getActivityIslandPreferences: () => ipcRenderer.invoke(
    'activity-island:get-preferences',
  ) as Promise<ActivityIslandPreferences>,
  setActivityIslandPreferences: (patch: ActivityIslandPreferencesPatch) => ipcRenderer.invoke(
    'activity-island:set-preferences',
    patch,
  ) as Promise<ActivityIslandPreferences>,
  onActivityIslandPreferences: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      preferences: ActivityIslandPreferences,
    ): void => listener(preferences)
    ipcRenderer.on('activity-island:preferences', wrapped)
    return () => ipcRenderer.off('activity-island:preferences', wrapped)
  },
  onRuntimeStatus: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: RuntimeStatusView): void => listener(status)
    ipcRenderer.on('runtime:status', wrapped)
    return () => ipcRenderer.off('runtime:status', wrapped)
  },
}

contextBridge.exposeInMainWorld('deepviewerDesktop', api)
