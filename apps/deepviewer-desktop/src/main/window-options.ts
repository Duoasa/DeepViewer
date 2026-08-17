import type { BrowserWindowConstructorOptions } from 'electron'
import { DEEPVIEWER_APP_NAME } from './app-identity.js'

export const MACOS_TRAFFIC_LIGHT_POSITION = Object.freeze({ x: 18, y: 18 })

export function createMainWindowOptions(
  preload: string,
  platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
  const macosChrome: Pick<
    BrowserWindowConstructorOptions,
    'titleBarStyle' | 'trafficLightPosition' | 'transparent' | 'vibrancy' | 'visualEffectState'
  > = platform === 'darwin'
    ? {
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: MACOS_TRAFFIC_LIGHT_POSITION,
        transparent: true,
        vibrancy: 'sidebar',
        visualEffectState: 'followWindow',
      }
    : {}

  return {
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: platform === 'darwin' ? '#00000000' : '#0b0d12',
    title: DEEPVIEWER_APP_NAME,
    ...macosChrome,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  }
}
