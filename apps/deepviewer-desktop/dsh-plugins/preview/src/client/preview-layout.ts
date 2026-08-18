export const PREVIEW_SECTION_MIN_HEIGHT = 144
export const PREVIEW_PANEL_DEFAULT_RATIO = 1 / 3

/** Size a freshly opened preview against the current app viewport. */
export function defaultPreviewPanelWidth(viewportWidth: number): number {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0
  return Math.round(width * PREVIEW_PANEL_DEFAULT_RATIO)
}

/** Keep both workspace files and preview content usable while the divider moves. */
export function clampPreviewTreeHeight(height: number, availableHeight: number): number {
  const available = Number.isFinite(availableHeight) ? Math.max(0, availableHeight) : 0
  const minimum = Math.min(PREVIEW_SECTION_MIN_HEIGHT, available / 2)
  const maximum = Math.max(minimum, available - minimum)
  const candidate = Number.isFinite(height) ? height : minimum
  return Math.min(maximum, Math.max(minimum, candidate))
}
