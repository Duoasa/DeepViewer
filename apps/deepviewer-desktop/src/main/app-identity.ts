export const DEEPVIEWER_APP_NAME = 'DeepViewer'

export interface PageTitleUpdateEvent {
  preventDefault(): void
}

export function preserveDeepViewerWindowTitle(
  event: PageTitleUpdateEvent,
  setTitle: (title: string) => void,
): void {
  event.preventDefault()
  setTitle(DEEPVIEWER_APP_NAME)
}
