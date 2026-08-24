export const ACTIVITY_ISLAND_STATES = [
  'standby',
  'thinking',
  'working',
  'awaitingConfirmation',
  'completed',
  'error',
  'unavailable',
] as const

export type ActivityIslandState = typeof ACTIVITY_ISLAND_STATES[number]
export type ActivityIslandPresentation = 'expanded' | 'compact' | 'hidden'
export type ActivityIslandOrbAnimation = 'particleOrb' | 'rippleGlow'

export interface ActivityIslandActivity {
  schemaVersion: 1
  sequence: number
  sessionId: string
  state: ActivityIslandState
  title: string
  occurredAt: number
}

export interface ActivityIslandPreferences {
  enabled: boolean
  orbAnimation: ActivityIslandOrbAnimation
  compactDelaySeconds: number
  hideDelaySeconds: number
}

export type ActivityIslandPreferencesPatch = Partial<ActivityIslandPreferences>

export interface ActivityIslandRenderState {
  activity: ActivityIslandActivity | null
  preferences: ActivityIslandPreferences
  presentation: ActivityIslandPresentation
}

export interface ActivityIslandDesktopApi {
  publishActivityIsland(activity: ActivityIslandActivity | null): void
  getActivityIslandPreferences(): Promise<ActivityIslandPreferences>
  setActivityIslandPreferences(
    patch: ActivityIslandPreferencesPatch,
  ): Promise<ActivityIslandPreferences>
  onActivityIslandPreferences(
    listener: (preferences: ActivityIslandPreferences) => void,
  ): () => void
}

export interface ActivityIslandRendererApi {
  onRenderState(listener: (state: ActivityIslandRenderState) => void): () => void
}

export const DEFAULT_ACTIVITY_ISLAND_PREFERENCES: Readonly<ActivityIslandPreferences> = Object.freeze({
  enabled: true,
  orbAnimation: 'particleOrb',
  compactDelaySeconds: 20,
  hideDelaySeconds: 100,
})
