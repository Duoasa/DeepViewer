// Isolated, hidden renderer startup check; no user profile or UI interactions.
const { app, BrowserWindow, session } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { dirname, join } = require('node:path')
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'))
app.setPath('userData', join(dirname(process.argv[2]), 'renderer-data'))
let window
const errors = []
const timer = setTimeout(() => { console.error('Sidebar renderer startup timed out'); app.exit(1) }, 30000)
app.whenReady().then(async () => {
  for (const pair of config.cookie.split('; ')) {
    const i = pair.indexOf('=')
    await session.defaultSession.cookies.set({ url: config.origin, name: pair.slice(0, i), value: pair.slice(i + 1), httpOnly: true, sameSite: 'lax' })
  }
  window = new BrowserWindow({ show: false, width: 1440, height: 920, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message) })
  await window.loadURL(config.origin)
  for (let i = 0; i < 100; i++) {
    const mounted = await window.webContents.executeJavaScript("document.querySelector('[data-dsh-better-sidebar]') !== null")
    if (mounted) {
      await new Promise(r => setTimeout(r, 500))
      if (errors.length) throw new Error(errors.join('\n'))
      const imageReady = await window.webContents.executeJavaScript(`new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth === 1 && image.naturalHeight === 1);
        image.onerror = () => resolve(false);
        image.src = ${JSON.stringify(config.imageUrl)};
        setTimeout(() => resolve(false), 5000);
      })`)
      if (!imageReady) throw new Error('Card image URL could not be decoded in renderer')
      const previewReady = await window.webContents.executeJavaScript(`new Promise(resolve => {
        const frame = document.createElement('iframe');
        frame.onload = () => {
          try { resolve({ ready: frame.contentDocument.body.dataset.ready, storage: frame.contentWindow.localStorage.getItem('sidebar-smoke'), body: frame.contentDocument.body.textContent.slice(0, 180) }) }
          catch { resolve(false) }
        };
        frame.src = ${JSON.stringify(config.previewUrl)};
        document.body.append(frame);
        setTimeout(() => resolve(false), 5000);
      })`)
      if (previewReady?.ready !== 'yes' || previewReady?.storage !== 'ok') throw new Error('HTML preview failed: ' + JSON.stringify(previewReady) + ' ' + errors.join('; '))
      const settingsOpened = await window.webContents.executeJavaScript(`(() => {
        const button = [...document.querySelectorAll('button')].find(b => ['设置', 'Settings'].includes(b.getAttribute('aria-label')));
        button?.click(); return !!button;
      })()`)
      if (!settingsOpened) throw new Error('Settings trigger missing')
      await new Promise(r => setTimeout(r, 300))
      const navOpened = await window.webContents.executeJavaScript(`(() => {
        const button = [...document.querySelectorAll('nav button')].find(b => ['侧栏管理', 'Sidebar Management'].includes(b.textContent.trim()));
        button?.click(); return !!button;
      })()`)
      if (!navOpened) throw new Error('Sidebar management navigation missing')
      await new Promise(r => setTimeout(r, 300))
      for (const expected of [false, true]) {
        await window.webContents.executeJavaScript(`document.querySelector('button._2vuxea_cardMain[title="git"]').click()`)
        await new Promise(r => setTimeout(r, 500))
        const state = await window.webContents.executeJavaScript(`(() => {
          const card = document.querySelector('button._2vuxea_cardMain[title="git"]');
          const track = card.querySelector('._2vuxea_cardSwitchTrack');
          return { enabled: card.getAttribute('aria-pressed') === 'true', visible: !!track && track.getBoundingClientRect().width > 0 };
        })()`)
        if (state.enabled !== expected || !state.visible) throw new Error('Sidebar toggle disappeared or failed: ' + JSON.stringify(state))
      }
      const sidechatRemoved = await window.webContents.executeJavaScript(`!document.querySelector('button._2vuxea_cardMain[title="sidechat"]')`)
      if (!sidechatRemoved) throw new Error('Side conversation still registered in settings')
      const chromeRemoved = await window.webContents.executeJavaScript(`!document.querySelector('._2vuxea_versionBadge') && !document.querySelector('._2vuxea_section').textContent.includes('位置兼容模式')`)
      if (!chromeRemoved) throw new Error('Obsolete settings controls remain')
      writeFileSync('/private/tmp/deepviewer-sidebar-management.png', (await window.webContents.capturePage()).toPNG())
      clearTimeout(timer)
      console.log('SIDEBAR_RENDERER_MOUNTED')
      app.exit(0)
      return
    }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('Sidebar client did not mount: ' + errors.join('\n'))
}).catch(error => { clearTimeout(timer); console.error(error.message); app.exit(1) })
