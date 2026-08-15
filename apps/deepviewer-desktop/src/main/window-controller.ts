import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import type { RuntimeStatusView } from '../shared/runtime-status.js'

export class WindowController {
  private window: BrowserWindow | undefined
  private runtimeOrigin: string | undefined
  private readonly launchSurfaceUrl = pathToFileURL(join(import.meta.dirname, '../renderer/index.html')).href

  create(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 900,
      minHeight: 640,
      show: false,
      backgroundColor: '#0b0d12',
      title: 'DeepViewer',
      webPreferences: {
        preload: join(import.meta.dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    })

    window.once('ready-to-show', () => window.show())
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, targetUrl) => {
      if (!this.isAllowedNavigation(targetUrl)) event.preventDefault()
    })
    window.on('closed', () => {
      if (this.window === window) this.window = undefined
    })
    this.window = window
    void this.loadLaunchSurface()
    return window
  }

  focus(): void {
    if (this.window === undefined) return
    if (this.window.isMinimized()) this.window.restore()
    this.window.focus()
  }

  async showRuntime(origin: string): Promise<void> {
    this.runtimeOrigin = new URL(origin).origin
    await this.window?.loadURL(origin)
  }

  async showStatus(_status: RuntimeStatusView): Promise<void> {
    if (this.window === undefined || this.window.isDestroyed()) return
    const current = this.window.webContents.getURL()
    if (this.runtimeOrigin !== undefined && current.startsWith(this.runtimeOrigin)) {
      this.runtimeOrigin = undefined
      await this.loadLaunchSurface()
    }
  }

  sendStatus(status: RuntimeStatusView): void {
    if (this.window === undefined || this.window.isDestroyed()) return
    this.window.webContents.send('runtime:status', status)
  }

  isLaunchSurface(url: string): boolean {
    try {
      return new URL(url).href === this.launchSurfaceUrl
    } catch {
      return false
    }
  }

  private async loadLaunchSurface(): Promise<void> {
    if (this.window === undefined || this.window.isDestroyed()) return
    await this.window.loadURL(this.launchSurfaceUrl)
  }

  private isAllowedNavigation(targetUrl: string): boolean {
    if (this.isLaunchSurface(targetUrl)) return true
    if (this.runtimeOrigin === undefined) return false
    try {
      return new URL(targetUrl).origin === this.runtimeOrigin
    } catch {
      return false
    }
  }
}
