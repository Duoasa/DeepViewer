import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE,
  ACTIVITY_ISLAND_WINDOW_SIZE,
  activityIslandWindowSize,
  createActivityIslandWindowOptions,
} from '../src/main/activity-island-window-options.js'
import { activityIslandBoundsForAnchor } from '../src/main/activity-island-window-controller.js'

const controllerSource = readFileSync(
  resolve(import.meta.dirname, '../src/main/activity-island-window-controller.ts'),
  'utf8',
)

describe('activity island window', () => {
  it('uses a passive, transparent, sandboxed child window without native panel elevation', () => {
    const options = createActivityIslandWindowOptions('/tmp/island-preload.cjs')
    expect(options).toMatchObject({
      ...ACTIVITY_ISLAND_WINDOW_SIZE,
      frame: false,
      transparent: true,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: false,
      hiddenInMissionControl: true,
    })
    expect(options).not.toHaveProperty('type')
    expect(options.webPreferences).toMatchObject({
      preload: '/tmp/island-preload.cjs',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    })
  })

  it('centers on the main-column titlebar anchor inside the parent window', () => {
    expect(activityIslandBoundsForAnchor(
      { x: 100, y: 200, width: 1400, height: 900 },
      { x: 300, y: 0, width: 800, height: 48 },
    )).toEqual({
      x: 578,
      y: 190,
      width: 444,
      height: 152,
    })
  })

  it('shrinks a compact presentation around the expanded vertical center', () => {
    const expanded = activityIslandBoundsForAnchor(
      { x: 100, y: 200, width: 1400, height: 900 },
      { x: 300, y: 0, width: 800, height: 48 },
      ACTIVITY_ISLAND_WINDOW_SIZE,
      ACTIVITY_ISLAND_WINDOW_SIZE,
    )
    const compact = activityIslandBoundsForAnchor(
      { x: 100, y: 200, width: 1400, height: 900 },
      { x: 300, y: 0, width: 800, height: 48 },
      ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE,
      ACTIVITY_ISLAND_WINDOW_SIZE,
    )

    expect(compact).toEqual({ x: 665, y: 230, width: 270, height: 72 })
    expect(compact.x + compact.width / 2).toBe(expanded.x + expanded.width / 2)
    expect(compact.y + compact.height / 2).toBe(expanded.y + expanded.height / 2)
  })

  it('attaches to the main window lifecycle instead of floating across applications', () => {
    expect(controllerSource).toContain('parent,')
    expect(controllerSource).toContain("window.on('show', this.handleVisibilityChange)")
    expect(controllerSource).toContain("window.on('restore', this.handleVisibilityChange)")
    expect(controllerSource).toContain("window.on('focus', this.handleVisibilityChange)")
    expect(controllerSource).toContain("window.on('blur', this.handleVisibilityChange)")
    expect(controllerSource).toContain("window.on('hide', this.handleVisibilityChange)")
    expect(controllerSource).toContain("window.on('minimize', this.handleVisibilityChange)")
    expect(controllerSource).toContain('&& mainWindow.isFocused()')
    expect(controllerSource).toContain('if (!window.isVisible()) window.showInactive()')
    expect(controllerSource).not.toContain("this.reposition()\n    window.showInactive()")
    expect(controllerSource).not.toContain('setAlwaysOnTop')
    expect(controllerSource).not.toContain('setVisibleOnAllWorkspaces')
  })

  it('uses the QuotaView window sizes for expanded and compact presentations', () => {
    expect(activityIslandWindowSize('standby', 'expanded')).toEqual({ width: 304, height: 112 })
    expect(activityIslandWindowSize('completed', 'expanded')).toEqual({ width: 374, height: 132 })
    expect(activityIslandWindowSize('unavailable', 'expanded')).toEqual({ width: 390, height: 132 })
    expect(activityIslandWindowSize('working', 'expanded')).toEqual(ACTIVITY_ISLAND_WINDOW_SIZE)
    expect(activityIslandWindowSize('working', 'compact')).toEqual(ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE)
  })
})
