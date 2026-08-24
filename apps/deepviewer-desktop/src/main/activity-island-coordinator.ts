import type {
  ActivityIslandActivity,
  ActivityIslandPreferences,
  ActivityIslandRenderState,
} from '../shared/activity-island.js'

export interface ActivityIslandScheduler {
  set(delayMilliseconds: number, callback: () => void): unknown
  clear(handle: unknown): void
}

const defaultScheduler: ActivityIslandScheduler = {
  set: (delay, callback) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

function shouldAutoCompact(activity: ActivityIslandActivity): boolean {
  return activity.state === 'standby'
    || activity.state === 'completed'
    || activity.state === 'error'
    || activity.state === 'unavailable'
}

export class ActivityIslandCoordinator {
  private activity: ActivityIslandActivity | null = null
  private presentation: ActivityIslandRenderState['presentation'] = 'hidden'
  private compactTimer: unknown | undefined
  private hideTimer: unknown | undefined
  private lastSequenceBySession = new Map<string, number>()

  constructor(
    private preferences: ActivityIslandPreferences,
    private readonly render: (state: ActivityIslandRenderState) => void,
    private readonly scheduler: ActivityIslandScheduler = defaultScheduler,
  ) {
    this.publish()
  }

  updatePreferences(preferences: ActivityIslandPreferences): void {
    this.preferences = { ...preferences }
    this.reconcile(true)
  }

  updateActivity(activity: ActivityIslandActivity | null): boolean {
    if (activity === null) {
      this.activity = null
      this.cancelTimers()
      this.presentation = 'hidden'
      this.publish()
      return true
    }

    const lastSequence = this.lastSequenceBySession.get(activity.sessionId)
    if (lastSequence !== undefined && activity.sequence <= lastSequence) return false
    this.lastSequenceBySession.set(activity.sessionId, activity.sequence)
    this.activity = activity
    this.reconcile(true)
    return true
  }

  dispose(): void {
    this.cancelTimers()
  }

  private reconcile(restartTimers: boolean): void {
    if (restartTimers) this.cancelTimers()
    if (!this.preferences.enabled || this.activity === null) {
      this.presentation = 'hidden'
      this.publish()
      return
    }

    this.presentation = 'expanded'
    this.publish()
    if (!shouldAutoCompact(this.activity)) return

    this.compactTimer = this.scheduler.set(
      this.preferences.compactDelaySeconds * 1_000,
      () => {
        this.compactTimer = undefined
        if (!this.preferences.enabled || this.activity === null) return
        this.presentation = 'compact'
        this.publish()
        this.hideTimer = this.scheduler.set(
          this.preferences.hideDelaySeconds * 1_000,
          () => {
            this.hideTimer = undefined
            this.presentation = 'hidden'
            this.publish()
          },
        )
      },
    )
  }

  private cancelTimers(): void {
    if (this.compactTimer !== undefined) this.scheduler.clear(this.compactTimer)
    if (this.hideTimer !== undefined) this.scheduler.clear(this.hideTimer)
    this.compactTimer = undefined
    this.hideTimer = undefined
  }

  private publish(): void {
    this.render({
      activity: this.activity === null ? null : { ...this.activity },
      preferences: { ...this.preferences },
      presentation: this.presentation,
    })
  }
}
