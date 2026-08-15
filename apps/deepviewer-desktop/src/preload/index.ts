import { contextBridge, ipcRenderer } from 'electron'
import type { DeepViewerDesktopApi, RuntimeStatusView } from '../shared/runtime-status.js'

const api: DeepViewerDesktopApi = {
  getRuntimeStatus: () => ipcRenderer.invoke('runtime:get-status') as Promise<RuntimeStatusView>,
  retryRuntime: () => ipcRenderer.invoke('runtime:retry') as Promise<void>,
  openLogDirectory: () => ipcRenderer.invoke('desktop:open-log-directory') as Promise<void>,
  onRuntimeStatus: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: RuntimeStatusView): void => listener(status)
    ipcRenderer.on('runtime:status', wrapped)
    return () => ipcRenderer.off('runtime:status', wrapped)
  },
}

contextBridge.exposeInMainWorld('deepviewerDesktop', api)
