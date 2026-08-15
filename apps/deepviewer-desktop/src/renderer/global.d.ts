import type { DeepViewerDesktopApi } from '../shared/runtime-status.js'

declare global {
  interface Window {
    deepviewerDesktop: DeepViewerDesktopApi
  }
}

export {}
