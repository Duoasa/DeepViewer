/** Renderer event shared by Agent-produced file entry points and the preview plugin. */
export const DEEPVIEWER_PREVIEW_FILE_EVENT = 'deepviewer:preview-file'

/**
 * Prefer DeepViewer's workspace-scoped preview while retaining the Host opener
 * when the preview plugin is unavailable or declines the target.
 *
 * The cancelable event is a synchronous capability handshake: the preview
 * plugin calls preventDefault() only after accepting a non-empty path.
 */
export function openDeepViewerPreviewOrFallback(
  absolutePath: string | undefined,
  fallback: () => void,
): boolean {
  if (typeof window === 'undefined' || absolutePath === undefined || absolutePath.trim() === '') {
    fallback()
    return false
  }

  const event = new CustomEvent<string>(DEEPVIEWER_PREVIEW_FILE_EVENT, {
    detail: absolutePath,
    cancelable: true,
  })
  const previewAccepted = !window.dispatchEvent(event)
  if (!previewAccepted) fallback()
  return previewAccepted
}
