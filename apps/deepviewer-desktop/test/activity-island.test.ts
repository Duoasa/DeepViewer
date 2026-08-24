import { describe, expect, it } from 'vitest'
import { ActivityIslandCoordinator } from '../src/main/activity-island-coordinator.js'
import type { ActivityIslandScheduler } from '../src/main/activity-island-coordinator.js'
import {
  normalizeActivityIslandPreferences,
  validateActivityIslandActivity,
} from '../src/main/activity-island-validation.js'
import type {
  ActivityIslandActivity,
  ActivityIslandRenderState,
} from '../src/shared/activity-island.js'
import { DEFAULT_ACTIVITY_ISLAND_PREFERENCES } from '../src/shared/activity-island.js'

class ManualScheduler implements ActivityIslandScheduler {
  private now = 0
  private id = 0
  private tasks = new Map<number, { at: number; callback: () => void }>()

  set(delayMilliseconds: number, callback: () => void): unknown {
    const id = ++this.id
    this.tasks.set(id, { at: this.now + delayMilliseconds, callback })
    return id
  }

  clear(handle: unknown): void {
    this.tasks.delete(handle as number)
  }

  advance(milliseconds: number): void {
    const end = this.now + milliseconds
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (next === undefined) break
      this.now = next[1].at
      this.tasks.delete(next[0])
      next[1].callback()
    }
    this.now = end
  }
}

function activity(
  state: ActivityIslandActivity['state'],
  sequence = 1,
): ActivityIslandActivity {
  return {
    schemaVersion: 1,
    sequence,
    sessionId: 'session-1',
    state,
    title: 'Build the workspace',
    occurredAt: 1,
  }
}

describe('activity island validation', () => {
  it('normalizes QuotaView-compatible preferences to their ranges and steps', () => {
    expect(normalizeActivityIslandPreferences({
      enabled: false,
      orbAnimation: 'rippleGlow',
      compactDelaySeconds: 63,
      hideDelaySeconds: 2,
    })).toEqual({
      enabled: false,
      orbAnimation: 'rippleGlow',
      compactDelaySeconds: 60,
      hideDelaySeconds: 5,
    })
    expect(normalizeActivityIslandPreferences(undefined)).toEqual(DEFAULT_ACTIVITY_ISLAND_PREFERENCES)
  })

  it('accepts only the bounded activity projection', () => {
    const accepted = validateActivityIslandActivity({
      ...activity('working'),
      title: `  ${'a'.repeat(130)}\u0000  `,
    })
    expect(accepted?.title).toHaveLength(120)
    expect(validateActivityIslandActivity({ ...activity('working'), state: 'secret' })).toBeNull()
    expect(validateActivityIslandActivity({ ...activity('working'), sessionId: '' })).toBeNull()
  })
})

describe('single-task activity island coordinator', () => {
  it('compacts and then hides terminal activity with independent delays', () => {
    const scheduler = new ManualScheduler()
    const states: ActivityIslandRenderState[] = []
    const coordinator = new ActivityIslandCoordinator(
      DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
      state => states.push(state),
      scheduler,
    )

    coordinator.updateActivity(activity('completed'))
    expect(states.at(-1)?.presentation).toBe('expanded')
    scheduler.advance(19_999)
    expect(states.at(-1)?.presentation).toBe('expanded')
    scheduler.advance(1)
    expect(states.at(-1)?.presentation).toBe('compact')
    scheduler.advance(100_000)
    expect(states.at(-1)?.presentation).toBe('hidden')
  })

  it('cancels terminal timers when newer active work arrives', () => {
    const scheduler = new ManualScheduler()
    const states: ActivityIslandRenderState[] = []
    const coordinator = new ActivityIslandCoordinator(
      DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
      state => states.push(state),
      scheduler,
    )

    coordinator.updateActivity(activity('completed'))
    scheduler.advance(10_000)
    coordinator.updateActivity(activity('thinking', 2))
    scheduler.advance(200_000)
    expect(states.at(-1)?.presentation).toBe('expanded')
    expect(states.at(-1)?.activity?.state).toBe('thinking')
  })

  it('keeps confirmation expanded and rejects stale sequence numbers', () => {
    const scheduler = new ManualScheduler()
    const states: ActivityIslandRenderState[] = []
    const coordinator = new ActivityIslandCoordinator(
      DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
      state => states.push(state),
      scheduler,
    )

    expect(coordinator.updateActivity(activity('awaitingConfirmation', 4))).toBe(true)
    expect(coordinator.updateActivity(activity('working', 3))).toBe(false)
    scheduler.advance(300_000)
    expect(states.at(-1)?.presentation).toBe('expanded')
    expect(states.at(-1)?.activity?.state).toBe('awaitingConfirmation')
  })

  it('hides immediately when disabled and restores the latest activity when enabled', () => {
    const states: ActivityIslandRenderState[] = []
    const coordinator = new ActivityIslandCoordinator(
      DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
      state => states.push(state),
    )
    coordinator.updateActivity(activity('working'))
    coordinator.updatePreferences({ ...DEFAULT_ACTIVITY_ISLAND_PREFERENCES, enabled: false })
    expect(states.at(-1)?.presentation).toBe('hidden')
    coordinator.updatePreferences({ ...DEFAULT_ACTIVITY_ISLAND_PREFERENCES, enabled: true })
    expect(states.at(-1)?.presentation).toBe('expanded')
  })
})
