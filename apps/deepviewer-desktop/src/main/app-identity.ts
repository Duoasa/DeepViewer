import { join } from 'node:path'

export const DEEPVIEWER_APP_NAME = 'DeepViewer'
export const DEEPVIEWER_APP_ICON_PNG = 'deepviewer-icon-macos26-1024.png'
export const DEEPVIEWER_APP_ICON_ICNS = 'DeepViewer.icns'

export interface PageTitleUpdateEvent {
  preventDefault(): void
}

export function resolveDeepViewerIconPath(appPath: string): string {
  return join(appPath, 'assets', DEEPVIEWER_APP_ICON_ICNS)
}

export function shouldSetDevelopmentDockIcon(
  platform: NodeJS.Platform,
  isPackaged: boolean,
): boolean {
  return platform === 'darwin' && !isPackaged
}

export function preserveDeepViewerWindowTitle(
  event: PageTitleUpdateEvent,
  setTitle: (title: string) => void,
): void {
  event.preventDefault()
  setTitle(DEEPVIEWER_APP_NAME)
}
