import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, screen } from 'electron'
import type { Display } from 'electron'
import type { ActivityIslandRenderState } from '../shared/activity-island.js'
import type { AppLogger } from './logger.js'
import {
  ACTIVITY_ISLAND_WINDOW_SIZE,
  activityIslandWindowSize,
  createActivityIslandWindowOptions,
} from './activity-island-window-options.js'
import type { ActivityIslandWindowSize } from './activity-island-window-options.js'

const TOP_INSET = 6

export function activityIslandBoundsForDisplay(
  display: Pick<Display, 'workArea'>,
  size: ActivityIslandWindowSize = ACTIVITY_ISLAND_WINDOW_SIZE,
): Electron.Rectangle {
  return {
    x: Math.round(display.workArea.x + (display.workArea.width - size.width) / 2),
    y: display.workArea.y + TOP_INSET,
    ...size,
  }
}

export class ActivityIslandWindowController {
  private window: BrowserWindow | undefined
  private mainWindow: BrowserWindow | undefined
  private lastState: ActivityIslandRenderState | undefined
  private loaded = false
  private readonly handleGeometryChange = (): void => this.reposition()

  constructor(private readonly logger: AppLogger) {}

  attachMainWindow(window: BrowserWindow): void {
    if (this.mainWindow !== undefined && !this.mainWindow.isDestroyed()) {
      this.mainWindow.off('move', this.handleGeometryChange)
      this.mainWindow.off('resize', this.handleGeometryChange)
    }
    this.mainWindow = window
    window.on('move', this.handleGeometryChange)
    window.on('resize', this.handleGeometryChange)
    window.on('closed', () => {
      if (this.mainWindow === window) this.mainWindow = undefined
    })
    screen.off('display-metrics-changed', this.handleGeometryChange)
    screen.off('display-added', this.handleGeometryChange)
    screen.off('display-removed', this.handleGeometryChange)
    screen.on('display-metrics-changed', this.handleGeometryChange)
    screen.on('display-added', this.handleGeometryChange)
    screen.on('display-removed', this.handleGeometryChange)
  }

  render(state: ActivityIslandRenderState): void {
    this.lastState = state
    if (process.platform !== 'darwin' || state.presentation === 'hidden') {
      this.window?.hide()
      return
    }
    const window = this.ensureWindow()
    this.reposition(true)
    if (this.loaded) {
      window.webContents.send('activity-island:render', state)
      window.showInactive()
    }
  }

  dispose(): void {
    if (this.mainWindow !== undefined && !this.mainWindow.isDestroyed()) {
      this.mainWindow.off('move', this.handleGeometryChange)
      this.mainWindow.off('resize', this.handleGeometryChange)
    }
    screen.off('display-metrics-changed', this.handleGeometryChange)
    screen.off('display-added', this.handleGeometryChange)
    screen.off('display-removed', this.handleGeometryChange)
    if (this.window !== undefined && !this.window.isDestroyed()) this.window.destroy()
    this.window = undefined
    this.mainWindow = undefined
  }

  private ensureWindow(): BrowserWindow {
    if (this.window !== undefined && !this.window.isDestroyed()) return this.window
    const window = new BrowserWindow(createActivityIslandWindowOptions(
      join(import.meta.dirname, 'island-preload.cjs'),
    ))
    window.setIgnoreMouseEvents(true)
    window.setAlwaysOnTop(true, 'status')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, targetUrl) => {
      if (targetUrl !== pathToFileURL(join(import.meta.dirname, '../renderer/island.html')).href) {
        event.preventDefault()
      }
    })
    window.webContents.once('did-finish-load', () => {
      this.loaded = true
      if (this.lastState !== undefined) {
        this.reposition(false)
        window.webContents.send('activity-island:render', this.lastState)
        if (this.lastState.presentation !== 'hidden') window.showInactive()
      }
    })
    window.webContents.on('did-fail-load', (_event, errorCode) => {
      this.logger.error('activity-island', `renderer load failed (${String(errorCode)})`)
    })
    window.on('closed', () => {
      if (this.window === window) {
        this.window = undefined
        this.loaded = false
      }
    })
    this.window = window
    void window.loadURL(pathToFileURL(join(import.meta.dirname, '../renderer/island.html')).href)
    return window
  }

  private reposition(animated = false): void {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return
    const display = this.mainWindow === undefined || this.mainWindow.isDestroyed()
      ? screen.getPrimaryDisplay()
      : screen.getDisplayMatching(this.mainWindow.getBounds())
    const activity = this.lastState?.activity
    const size = activity === null || activity === undefined
      ? ACTIVITY_ISLAND_WINDOW_SIZE
      : activityIslandWindowSize(activity.state, this.lastState?.presentation ?? 'expanded')
    window.setBounds(activityIslandBoundsForDisplay(display, size), animated && window.isVisible())
  }
}
