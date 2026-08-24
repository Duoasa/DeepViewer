import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActivityIslandRendererApi,
  ActivityIslandRenderState,
} from '../shared/activity-island.js'

const api: ActivityIslandRendererApi = {
  onRenderState: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      state: ActivityIslandRenderState,
    ): void => listener(state)
    ipcRenderer.on('activity-island:render', wrapped)
    return () => ipcRenderer.off('activity-island:render', wrapped)
  },
}

contextBridge.exposeInMainWorld('deepviewerIsland', api)
