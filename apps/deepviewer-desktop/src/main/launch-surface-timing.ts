export const MINIMUM_LAUNCH_SURFACE_VISIBLE_MS = 2_000

export const WAIT_FOR_LAUNCH_SURFACE_PAINT_SCRIPT = `
new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
})
`

export function remainingLaunchSurfaceVisibilityMs(
  visibleAt: number,
  now: number,
): number {
  return Math.max(0, MINIMUM_LAUNCH_SURFACE_VISIBLE_MS - (now - visibleAt))
}
