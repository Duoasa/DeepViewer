export const brandingContracts = [
  {
    "id": "desktop-copy-33",
    "file": "apps/desktop/src/locale.ts",
    "before": "  aboutMenu: 'About DeepSeek Harness',",
    "after": "  aboutMenu: 'About DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-34",
    "file": "apps/desktop/src/locale.ts",
    "before": "  aboutProduct: 'DeepSeek Harness',",
    "after": "  aboutProduct: 'DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged.",
    "count": 2
  },
  {
    "id": "desktop-copy-36",
    "file": "apps/desktop/src/locale.ts",
    "before": "  hideApplication: 'Hide DeepSeek Harness',",
    "after": "  hideApplication: 'Hide DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-39",
    "file": "apps/desktop/src/locale.ts",
    "before": "  quitApplication: 'Quit DeepSeek Harness',",
    "after": "  quitApplication: 'Quit DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-40",
    "file": "apps/desktop/src/locale.ts",
    "before": "  openApplication: 'Open DeepSeek Harness',",
    "after": "  openApplication: 'Open DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-43",
    "file": "apps/desktop/src/locale.ts",
    "before": "  quitTitle: 'Quit DeepSeek Harness?',",
    "after": "  quitTitle: 'Quit DeepViewer?',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-58",
    "file": "apps/desktop/src/locale.ts",
    "before": "  startupFailed: 'DeepSeek Harness is unavailable',",
    "after": "  startupFailed: 'DeepViewer is unavailable',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-68",
    "file": "apps/desktop/src/locale.ts",
    "before": "  welcomeTitle: 'DeepSeek Harness',",
    "after": "  welcomeTitle: 'DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged.",
    "count": 2
  },
  {
    "id": "desktop-copy-69",
    "file": "apps/desktop/src/locale.ts",
    "before": "  welcomeBrand: 'DeepSeek Harness',",
    "after": "  welcomeBrand: 'DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged.",
    "count": 2
  },
  {
    "id": "desktop-copy-71",
    "file": "apps/desktop/src/locale.ts",
    "before": "  welcomeTaglineBrand: 'DeepSeek Harness',",
    "after": "  welcomeTaglineBrand: 'DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged.",
    "count": 2
  },
  {
    "id": "desktop-copy-132",
    "file": "apps/desktop/src/locale.ts",
    "before": "  updateTitle: 'DeepSeek Harness Update',",
    "after": "  updateTitle: 'DeepViewer Update',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-204",
    "file": "apps/desktop/src/locale.ts",
    "before": "  aboutMenu: '关于 DeepSeek Harness',",
    "after": "  aboutMenu: '关于 DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-207",
    "file": "apps/desktop/src/locale.ts",
    "before": "  hideApplication: '隐藏 DeepSeek Harness',",
    "after": "  hideApplication: '隐藏 DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-210",
    "file": "apps/desktop/src/locale.ts",
    "before": "  quitApplication: '退出 DeepSeek Harness',",
    "after": "  quitApplication: '退出 DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-211",
    "file": "apps/desktop/src/locale.ts",
    "before": "  openApplication: '打开 DeepSeek Harness',",
    "after": "  openApplication: '打开 DeepViewer',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-214",
    "file": "apps/desktop/src/locale.ts",
    "before": "  quitTitle: '退出 DeepSeek Harness？',",
    "after": "  quitTitle: '退出 DeepViewer？',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-229",
    "file": "apps/desktop/src/locale.ts",
    "before": "  startupFailed: 'DeepSeek Harness 无法使用',",
    "after": "  startupFailed: 'DeepViewer 无法使用',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "desktop-copy-303",
    "file": "apps/desktop/src/locale.ts",
    "before": "  updateTitle: 'DeepSeek Harness 更新',",
    "after": "  updateTitle: 'DeepViewer 更新',",
    "reason": "Desktop product copy; provider names and attribution remain unchanged."
  },
  {
    "id": "boot-wordmark",
    "file": "packages/client/web/src/boot-page.ts",
    "before": "this.wordmark = div(css.wordmark, 'HARNESS')",
    "after": "this.wordmark = div(css.wordmark, 'DeepViewer')\n    const icon = document.createElement('img')\n    icon.src = '/assets/deepviewer/icon-light.png'\n    icon.alt = ''\n    icon.width = 72; icon.height = 72\n    icon.style.cssText = 'display:block;margin:0 auto 14px'\n    this.wordmark.prepend(icon)",
    "reason": "Framework-free DeepViewer startup screen retains the native failure report."
  },
  {
    "id": "boot-no-slogan",
    "file": "packages/client/web/src/boot-page.ts",
    "before": "this.hint = div(css.hint, 'Loading plugins…')",
    "after": "this.hint = div(css.hint)",
    "reason": "Product startup has no slogan."
  },
  {
    "id": "web-title",
    "file": "apps/web/index.html",
    "before": "<title>DSH Local Build</title>",
    "after": "<title>DeepViewer</title>",
    "reason": "Product window title."
  },
  {
    "id": "desktop-startup-ready",
    "file": "apps/desktop/src/main.ts",
    "before": "async function main(): Promise<void> {",
    "after": "async function main(): Promise<void> {\n  await (globalThis as typeof globalThis & { __DEEPVIEWER_HOST_ENVIRONMENT__?: Promise<NodeJS.ProcessEnv> }).__DEEPVIEWER_HOST_ENVIRONMENT__",
    "reason": "Complete allowlisted frontend migration and PAC initialization before rendering any window."
  },
  {
    "id": "desktop-build-number",
    "file": "apps/desktop/src/main.ts",
    "before": "    version: '',",
    "after": "    version: process.env.DEEPVIEWER_BUILD_NUMBER ?? '',",
    "reason": "DeepViewer has a monotonic build number independent of the kernel version."
  },
  {
    "id": "desktop-icon",
    "file": "apps/desktop/src/main.ts",
    "before": "const applicationIconPath = development ? join(app.getAppPath(), 'resources', 'icon-windows.png')",
    "previousAfter": "const applicationIconPath = development ? join(app.getAppPath(), '.desktop', 'native-icon', 'DeepViewerDockThemes', 'light.png')",
    "after": "const applicationIconPath = development ? join(app.getAppPath(), '.desktop', 'native-icon', 'icon.png')",
    "reason": "Use Apple's compiled legacy rendition for the native About panel without overriding the Dock catalog."
  },
  {
    "id": "isolated-command-management",
    "file": "apps/desktop/src/main.ts",
    "before": "    ...process.platform === 'darwin' || process.platform === 'win32'\n      ? [{ label: currentDesktopLocale().messages.cliCommandMenu, click: () => { void commandManager.show() } }] : [],",
    "after": "    ...(process.env.DEEPVIEWER_DESKTOP !== '1' && (process.platform === 'darwin' || process.platform === 'win32'))\n      ? [{ label: currentDesktopLocale().messages.cliCommandMenu, click: () => { void commandManager.show() } }] : [],",
    "reason": "DeepViewer does not replace the independent official DSH command registration."
  }
]
