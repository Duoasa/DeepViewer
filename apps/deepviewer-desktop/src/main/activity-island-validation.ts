import {
  ACTIVITY_ISLAND_STATES,
  DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
} from '../shared/activity-island.js'
import type {
  ActivityIslandActivity,
  ActivityIslandPreferences,
  ActivityIslandPreferencesPatch,
} from '../shared/activity-island.js'

const ACTIVITY_STATES = new Set<string>(ACTIVITY_ISLAND_STATES)
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/gu

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedStep(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  step: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const clamped = Math.min(maximum, Math.max(minimum, value))
  return Math.round(clamped / step) * step
}

export function normalizeActivityIslandPreferences(
  value: unknown,
  base: ActivityIslandPreferences = DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
): ActivityIslandPreferences {
  if (!isRecord(value)) return { ...base }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : base.enabled,
    orbAnimation: value.orbAnimation === 'particleOrb' || value.orbAnimation === 'rippleGlow'
      ? value.orbAnimation
      : base.orbAnimation,
    compactDelaySeconds: normalizedStep(
      value.compactDelaySeconds,
      base.compactDelaySeconds,
      5,
      60,
      5,
    ),
    hideDelaySeconds: normalizedStep(
      value.hideDelaySeconds,
      base.hideDelaySeconds,
      5,
      120,
      5,
    ),
  }
}

export function normalizeActivityIslandPreferencesPatch(
  value: unknown,
  base: ActivityIslandPreferences,
): ActivityIslandPreferences {
  if (!isRecord(value)) return { ...base }
  const allowed: ActivityIslandPreferencesPatch = {}
  if ('enabled' in value) allowed.enabled = value.enabled as boolean
  if ('orbAnimation' in value) allowed.orbAnimation = value.orbAnimation as ActivityIslandPreferences['orbAnimation']
  if ('compactDelaySeconds' in value) allowed.compactDelaySeconds = value.compactDelaySeconds as number
  if ('hideDelaySeconds' in value) allowed.hideDelaySeconds = value.hideDelaySeconds as number
  return normalizeActivityIslandPreferences(allowed, base)
}

function safeText(value: unknown, maximumCodePoints: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const sanitized = value.replace(CONTROL_CHARACTERS, ' ').trim()
  if (sanitized.length === 0) return undefined
  return [...sanitized].slice(0, maximumCodePoints).join('')
}

export function validateActivityIslandActivity(value: unknown): ActivityIslandActivity | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null
  if (!Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0) return null
  if (!Number.isFinite(value.occurredAt) || (value.occurredAt as number) < 0) return null
  if (typeof value.state !== 'string' || !ACTIVITY_STATES.has(value.state)) return null
  const sessionId = safeText(value.sessionId, 128)
  const title = safeText(value.title, 120)
  if (sessionId === undefined || title === undefined) return null
  return {
    schemaVersion: 1,
    sequence: value.sequence as number,
    sessionId,
    state: value.state as ActivityIslandActivity['state'],
    title,
    occurredAt: value.occurredAt as number,
  }
}
