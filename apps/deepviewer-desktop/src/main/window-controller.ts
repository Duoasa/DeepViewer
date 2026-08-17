import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, clipboard, Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { RuntimeStatusView } from '../shared/runtime-status.js'
import {
  DEEPVIEWER_APP_NAME,
  preserveDeepViewerWindowTitle,
} from './app-identity.js'
import { shouldHideWindowOnClose } from './app-lifecycle.js'
import {
  createMacosFocusStateScript,
  createMacosFullscreenStateScript,
  MACOS_FULLSCREEN_EVENT_STATE,
  MACOS_WINDOW_CHROME_CSS,
  MACOS_WINDOW_CHROME_SCRIPT,
} from './macos-window-chrome.js'
import {
  createMainWindowOptions,
} from './window-options.js'
import {
  HARNESS_LOADING_BRAND_CSS,
  HARNESS_LOADING_BRAND_SCRIPT,
} from './harness-loading-brand.js'
import {
  remainingLaunchSurfaceVisibilityMs,
  WAIT_FOR_LAUNCH_SURFACE_PAINT_SCRIPT,
} from './launch-surface-timing.js'
import { openExternalWebUrl } from './external-navigation.js'
import {
  getContextLinkTarget,
  getDesktopContextMenuLabels,
} from './desktop-context-menu.js'
import type { DesktopContextMenuOptions } from './desktop-context-menu.js'

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export class WindowController {
  private window: BrowserWindow | undefined
  private runtimeOrigin: string | undefined
  private launchSurfaceVisibleAt: number | undefined
  private resolveInitialLaunchSurfaceVisible: (() => void) | undefined
  private readonly initialLaunchSurfaceVisible = new Promise<void>(resolve => {
    this.resolveInitialLaunchSurfaceVisible = resolve
  })
  private readonly launchSurfaceUrl = pathToFileURL(join(import.meta.dirname, '../renderer/index.html')).href

  create(contextMenuOptions: DesktopContextMenuOptions): BrowserWindow {
    const window = new BrowserWindow(createMainWindowOptions(join(import.meta.dirname, 'preload.cjs')))

    window.once('ready-to-show', () => window.show())
    window.once('show', () => {
      void window.webContents.executeJavaScript(WAIT_FOR_LAUNCH_SURFACE_PAINT_SCRIPT)
        .catch(() => undefined)
        .then(() => this.markLaunchSurfaceVisible())
    })
    window.on('page-title-updated', event => {
      preserveDeepViewerWindowTitle(event, title => window.setTitle(title))
    })
    window.on('close', event => {
      if (!shouldHideWindowOnClose(process.platform)) return
      event.preventDefault()
      window.hide()
    })
    window.setTitle(DEEPVIEWER_APP_NAME)
    if (process.platform === 'darwin') {
      const setFocusedChrome = (focused: boolean): void => {
        if (window.isDestroyed()) return
        void window.webContents.executeJavaScript(
          createMacosFocusStateScript(focused),
        )
      }
      const setFullscreenChrome = (fullscreen: boolean): void => {
        if (window.isDestroyed()) return
        void window.webContents.executeJavaScript(
          createMacosFullscreenStateScript(fullscreen),
        )
      }
      window.webContents.on('dom-ready', () => {
        void window.webContents.insertCSS(MACOS_WINDOW_CHROME_CSS)
        void window.webContents.executeJavaScript(MACOS_WINDOW_CHROME_SCRIPT)
        setFocusedChrome(window.isFocused())
        setFullscreenChrome(window.isFullScreen())
      })
      window.on('focus', () => {
        setFocusedChrome(true)
      })
      window.on('blur', () => {
        setFocusedChrome(false)
      })
      window.on('enter-full-screen', () => {
        setFullscreenChrome(MACOS_FULLSCREEN_EVENT_STATE['enter-full-screen'])
      })
      window.on('leave-full-screen', () => {
        setFullscreenChrome(MACOS_FULLSCREEN_EVENT_STATE['leave-full-screen'])
      })
    }
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (!this.isAllowedNavigation(url)) this.openExternalNavigation(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, targetUrl) => {
      if (this.isAllowedNavigation(targetUrl)) return
      event.preventDefault()
      this.openExternalNavigation(targetUrl)
    })
    this.installContextMenu(window, contextMenuOptions)
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
    if (!this.window.isVisible()) this.window.show()
    this.window.focus()
  }

  async showRuntime(origin: string): Promise<void> {
    this.runtimeOrigin = new URL(origin).origin
    await this.initialLaunchSurfaceVisible
    if (this.launchSurfaceVisibleAt !== undefined) {
      await delay(remainingLaunchSurfaceVisibilityMs(this.launchSurfaceVisibleAt, Date.now()))
    }
    if (this.window === undefined || this.window.isDestroyed()) return
    await this.window.loadURL(origin)
    await this.installHarnessLoadingBrand(this.window)
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
    if (this.resolveInitialLaunchSurfaceVisible === undefined && this.window.isVisible()) {
      this.markLaunchSurfaceVisible()
    }
  }

  private markLaunchSurfaceVisible(): void {
    this.launchSurfaceVisibleAt = Date.now()
    this.resolveInitialLaunchSurfaceVisible?.()
    this.resolveInitialLaunchSurfaceVisible = undefined
  }

  private async installHarnessLoadingBrand(window: BrowserWindow): Promise<void> {
    if (window.isDestroyed() || !this.isRuntimeSurface(window.webContents.getURL())) return
    try {
      await window.webContents.insertCSS(HARNESS_LOADING_BRAND_CSS)
      await window.webContents.executeJavaScript(HARNESS_LOADING_BRAND_SCRIPT)
    } catch (error) {
      console.error('DeepViewer failed to install the Harness loading brand', error)
    }
  }

  isRuntimeSurface(url: string): boolean {
    if (this.runtimeOrigin === undefined) return false
    try {
      return new URL(url).origin === this.runtimeOrigin
    } catch {
      return false
    }
  }

  private isAllowedNavigation(targetUrl: string): boolean {
    if (this.isLaunchSurface(targetUrl)) return true
    return this.isRuntimeSurface(targetUrl)
  }

  private openExternalNavigation(targetUrl: string): void {
    void openExternalWebUrl(targetUrl, url => shell.openExternal(url)).catch(() => {
      console.error('DeepViewer failed to open an external web link')
    })
  }

  private installContextMenu(
    window: BrowserWindow,
    options: DesktopContextMenuOptions,
  ): void {
    const labels = getDesktopContextMenuLabels(options.locale)
    window.webContents.on('context-menu', (event, params) => {
      event.preventDefault()
      const template: MenuItemConstructorOptions[] = []
      const target = getContextLinkTarget(params.linkURL, params.titleText)
      if (target?.kind === 'web') {
        template.push(
          {
            label: labels.openWebLink,
            click: () => this.openExternalNavigation(target.url),
          },
          {
            label: labels.copyLinkAddress,
            click: () => clipboard.writeText(target.url),
          },
          { type: 'separator' },
        )
      } else if (target?.kind === 'file') {
        template.push(
          {
            label: labels.revealFile,
            click: () => shell.showItemInFolder(target.path),
          },
          {
            label: labels.copyFilePath,
            click: () => clipboard.writeText(target.path),
          },
          { type: 'separator' },
        )
      }

      template.push(
        {
          label: labels.openLogs,
          click: () => this.openDirectory(options.logDirectory),
        },
        { type: 'separator' },
      )

      if (params.isEditable) {
        template.push({ role: 'cut', enabled: params.editFlags.canCut })
      }
      template.push({ role: 'copy', enabled: params.editFlags.canCopy })
      if (params.isEditable) {
        template.push({ role: 'paste', enabled: params.editFlags.canPaste })
      }
      template.push({ role: 'selectAll', enabled: params.editFlags.canSelectAll })

      Menu.buildFromTemplate(template).popup({ window })
    })
  }

  private openDirectory(directory: string): void {
    void shell.openPath(directory).then(error => {
      if (error !== '') console.error('DeepViewer failed to open a support directory')
    }).catch(() => {
      console.error('DeepViewer failed to open a support directory')
    })
  }
}
