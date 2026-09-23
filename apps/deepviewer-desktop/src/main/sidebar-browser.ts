import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

export const BROWSER_PARTITION = 'persist:deepviewer-browser'
export function isBrowserUrl(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

/** Only the trusted application can embed guests; guests never receive the desktop preload. */
export function installSidebarBrowser(window: BrowserWindow, isRuntime: (url: string) => boolean): void {
  window.webContents.on('will-attach-webview', (event, preferences, params) => {
    if (!isRuntime(window.webContents.getURL()) || !isBrowserUrl(params.src ?? '') || params.partition !== BROWSER_PARTITION) {
      event.preventDefault()
      return
    }
    delete preferences.preload
    Object.assign(preferences, {
      nodeIntegration: false, nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false,
      contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false,
      allowRunningInsecureContent: false,
    })
  })
  window.webContents.on('did-attach-webview', (_event, guest) => {
    guest.setWindowOpenHandler(({ url }) => {
      if (isBrowserUrl(url) && !window.isDestroyed()) window.webContents.send('browser:open-url', url)
      return { action: 'deny' }
    })
    guest.on('context-menu', (_event, params) => {
      const items: MenuItemConstructorOptions[] = [
        { label: '后退', enabled: guest.navigationHistory.canGoBack(), click: () => guest.navigationHistory.goBack() },
        { label: '前进', enabled: guest.navigationHistory.canGoForward(), click: () => guest.navigationHistory.goForward() },
        { label: '刷新', click: () => guest.reload() },
      ]
      if (isBrowserUrl(params.linkURL)) items.push(
        { type: 'separator' },
        { label: '在新标签页打开链接', click: () => window.webContents.send('browser:open-url', params.linkURL) },
        { label: '下载链接', click: () => guest.downloadURL(params.linkURL) },
      )
      items.push({ type: 'separator' }, { role: 'copy' }, { role: 'paste', enabled: params.isEditable }, { role: 'selectAll' })
      Menu.buildFromTemplate(items).popup({ window })
    })
    guest.on('will-navigate', (event, url) => {
      if (!isBrowserUrl(url)) event.preventDefault()
    })
  })
}
