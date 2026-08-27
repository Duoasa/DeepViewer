import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import type {
  ActivityIslandAnchor,
  ActivityIslandRenderState,
} from '../shared/activity-island.js'
import type { AppLogger } from './logger.js'
import {
  ACTIVITY_ISLAND_WINDOW_SIZE,
  activityIslandWindowSize,
  createActivityIslandWindowOptions,
} from './activity-island-window-options.js'
import type { ActivityIslandWindowSize } from './activity-island-window-options.js'

const SURFACE_INSET = 10

export function activityIslandBoundsForAnchor(
  contentBounds: Electron.Rectangle,
  anchor: ActivityIslandAnchor,
  size: ActivityIslandWindowSize = ACTIVITY_ISLAND_WINDOW_SIZE,
  referenceSize: ActivityIslandWindowSize = size,
): Electron.Rectangle {
  return {
    x: Math.round(contentBounds.x + anchor.x + (anchor.width - size.width) / 2),
    y: Math.round(
      contentBounds.y
      + anchor.y
      - SURFACE_INSET
      + (referenceSize.height - size.height) / 2,
    ),
    ...size,
  }
}

export class ActivityIslandWindowController {
  private window: BrowserWindow | undefined
  private mainWindow: BrowserWindow | undefined
  private anchor: ActivityIslandAnchor | undefined
  private lastState: ActivityIslandRenderState | undefined
  private loaded = false
  private readonly handleGeometryChange = (): void => this.reposition()
  private readonly handleVisibilityChange = (): void => this.syncVisibility()

  constructor(private readonly logger: AppLogger) {}

  attachMainWindow(window: BrowserWindow): void {
    if (this.mainWindow !== undefined && !this.mainWindow.isDestroyed()) {
      this.detachMainWindowListeners(this.mainWindow)
    }
    this.mainWindow = window
    window.on('move', this.handleGeometryChange)
    window.on('resize', this.handleGeometryChange)
    window.on('show', this.handleVisibilityChange)
    window.on('restore', this.handleVisibilityChange)
    window.on('focus', this.handleVisibilityChange)
    window.on('blur', this.handleVisibilityChange)
    window.on('hide', this.handleVisibilityChange)
    window.on('minimize', this.handleVisibilityChange)
    window.on('closed', () => {
      if (this.mainWindow === window) {
        this.window?.hide()
        this.mainWindow = undefined
      }
    })
  }

  updateAnchor(anchor: ActivityIslandAnchor): void {
    this.anchor = anchor
    this.reposition()
    this.syncVisibility()
  }

  render(state: ActivityIslandRenderState): void {
    this.lastState = state
    if (process.platform !== 'darwin' || !this.shouldShow()) {
      this.window?.hide()
      return
    }
    const window = this.ensureWindow()
    this.reposition(true)
    if (this.loaded) {
      window.webContents.send('activity-island:render', state)
      this.syncVisibility()
    }
  }

  dispose(): void {
    if (this.mainWindow !== undefined && !this.mainWindow.isDestroyed()) {
      this.detachMainWindowListeners(this.mainWindow)
    }
    if (this.window !== undefined && !this.window.isDestroyed()) this.window.destroy()
    this.window = undefined
    this.mainWindow = undefined
  }

  private ensureWindow(): BrowserWindow {
    if (this.window !== undefined && !this.window.isDestroyed()) return this.window
    const parent = this.mainWindow
    if (parent === undefined || parent.isDestroyed()) {
      throw new Error('Activity island requires an attached main window')
    }
    const window = new BrowserWindow({
      ...createActivityIslandWindowOptions(join(import.meta.dirname, 'island-preload.cjs')),
      parent,
    })
    window.setIgnoreMouseEvents(true)
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
        this.syncVisibility()
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
    const mainWindow = this.mainWindow
    const anchor = this.anchor
    if (window === undefined || window.isDestroyed()
      || mainWindow === undefined || mainWindow.isDestroyed()
      || anchor === undefined) return
    const activity = this.lastState?.activity
    const size = activity === null || activity === undefined
      ? ACTIVITY_ISLAND_WINDOW_SIZE
      : activityIslandWindowSize(activity.state, this.lastState?.presentation ?? 'expanded')
    const expandedSize = activity === null || activity === undefined
      ? ACTIVITY_ISLAND_WINDOW_SIZE
      : activityIslandWindowSize(activity.state, 'expanded')
    window.setBounds(
      activityIslandBoundsForAnchor(
        mainWindow.getContentBounds(),
        anchor,
        size,
        expandedSize,
      ),
      animated && window.isVisible(),
    )
  }

  private shouldShow(): boolean {
    const mainWindow = this.mainWindow
    return this.lastState?.presentation !== 'hidden'
      && this.anchor !== undefined
      && mainWindow !== undefined
      && !mainWindow.isDestroyed()
      && mainWindow.isVisible()
      && mainWindow.isFocused()
      && !mainWindow.isMinimized()
  }

  private syncVisibility(): void {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return
    if (!this.shouldShow() || !this.loaded) {
      window.hide()
      return
    }
    this.reposition()
    if (!window.isVisible()) window.showInactive()
  }

  private detachMainWindowListeners(window: BrowserWindow): void {
    window.off('move', this.handleGeometryChange)
    window.off('resize', this.handleGeometryChange)
    window.off('show', this.handleVisibilityChange)
    window.off('restore', this.handleVisibilityChange)
    window.off('focus', this.handleVisibilityChange)
    window.off('blur', this.handleVisibilityChange)
    window.off('hide', this.handleVisibilityChange)
    window.off('minimize', this.handleVisibilityChange)
  }
}
