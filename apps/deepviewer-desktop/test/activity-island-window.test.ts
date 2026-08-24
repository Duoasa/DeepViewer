import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE,
  ACTIVITY_ISLAND_WINDOW_SIZE,
  activityIslandWindowSize,
  createActivityIslandWindowOptions,
} from '../src/main/activity-island-window-options.js'
import { activityIslandBoundsForDisplay } from '../src/main/activity-island-window-controller.js'

describe('activity island window', () => {
  it('uses a passive, transparent, sandboxed macOS panel', () => {
    const options = createActivityIslandWindowOptions('/tmp/island-preload.cjs')
    expect(options).toMatchObject({
      ...ACTIVITY_ISLAND_WINDOW_SIZE,
      type: 'panel',
      frame: false,
      transparent: true,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hiddenInMissionControl: true,
    })
    expect(options.webPreferences).toMatchObject({
      preload: '/tmp/island-preload.cjs',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    })
  })

  it('centers below the visible top of the selected display', () => {
    expect(activityIslandBoundsForDisplay({
      workArea: { x: 1440, y: 25, width: 1920, height: 1055 },
    } as never)).toEqual({
      x: 2178,
      y: 31,
      width: 444,
      height: 152,
    })
  })

  it('uses the QuotaView window sizes for expanded and compact presentations', () => {
    expect(activityIslandWindowSize('standby', 'expanded')).toEqual({ width: 304, height: 112 })
    expect(activityIslandWindowSize('completed', 'expanded')).toEqual({ width: 374, height: 132 })
    expect(activityIslandWindowSize('unavailable', 'expanded')).toEqual({ width: 390, height: 132 })
    expect(activityIslandWindowSize('working', 'expanded')).toEqual(ACTIVITY_ISLAND_WINDOW_SIZE)
    expect(activityIslandWindowSize('working', 'compact')).toEqual(ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE)
  })
})
