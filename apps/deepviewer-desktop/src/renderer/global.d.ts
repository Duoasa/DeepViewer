import type { DeepViewerDesktopApi } from '../shared/runtime-status.js'
import type { ActivityIslandRendererApi } from '../shared/activity-island.js'

declare global {
  interface Window {
    deepviewerDesktop: DeepViewerDesktopApi
    deepviewerIsland: ActivityIslandRendererApi
  }
}

export {}
