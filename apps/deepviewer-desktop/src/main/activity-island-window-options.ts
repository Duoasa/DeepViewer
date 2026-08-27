import type { BrowserWindowConstructorOptions } from 'electron'
import type {
  ActivityIslandPresentation,
  ActivityIslandState,
} from '../shared/activity-island.js'

export interface ActivityIslandWindowSize {
  readonly width: number
  readonly height: number
}

export const ACTIVITY_ISLAND_WINDOW_SIZE = Object.freeze({ width: 444, height: 152 })
export const ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE = Object.freeze({ width: 270, height: 72 })

const EXPANDED_WINDOW_SIZES: Record<ActivityIslandState, ActivityIslandWindowSize> = {
  standby: { width: 304, height: 112 },
  thinking: ACTIVITY_ISLAND_WINDOW_SIZE,
  working: ACTIVITY_ISLAND_WINDOW_SIZE,
  awaitingConfirmation: ACTIVITY_ISLAND_WINDOW_SIZE,
  completed: { width: 374, height: 132 },
  error: { width: 374, height: 132 },
  unavailable: { width: 390, height: 132 },
}

export function activityIslandWindowSize(
  state: ActivityIslandState,
  presentation: ActivityIslandPresentation,
): ActivityIslandWindowSize {
  return presentation === 'compact'
    ? ACTIVITY_ISLAND_COMPACT_WINDOW_SIZE
    : EXPANDED_WINDOW_SIZES[state]
}

export function createActivityIslandWindowOptions(
  preload: string,
): BrowserWindowConstructorOptions {
  return {
    ...ACTIVITY_ISLAND_WINDOW_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    alwaysOnTop: false,
    hiddenInMissionControl: true,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  }
}
