import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { AppLogger } from './logger.js'
import type {
  ActivityIslandPreferences,
  ActivityIslandPreferencesPatch,
} from '../shared/activity-island.js'
import {
  DEFAULT_ACTIVITY_ISLAND_PREFERENCES,
} from '../shared/activity-island.js'
import {
  normalizeActivityIslandPreferences,
  normalizeActivityIslandPreferencesPatch,
} from './activity-island-validation.js'

export class ActivityIslandPreferencesStore {
  private preferences: ActivityIslandPreferences

  constructor(
    private readonly filePath: string,
    private readonly logger: AppLogger,
  ) {
    this.preferences = this.read()
  }

  get(): ActivityIslandPreferences {
    return { ...this.preferences }
  }

  update(patch: ActivityIslandPreferencesPatch): ActivityIslandPreferences {
    const next = normalizeActivityIslandPreferencesPatch(patch, this.preferences)
    this.preferences = next
    this.write(next)
    return this.get()
  }

  private read(): ActivityIslandPreferences {
    try {
      return normalizeActivityIslandPreferences(JSON.parse(readFileSync(this.filePath, 'utf8')))
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'invalid'
      if (code !== 'ENOENT') this.logger.error('activity-island', `preferences read failed (${code})`)
      return { ...DEFAULT_ACTIVITY_ISLAND_PREFERENCES }
    }
  }

  private write(preferences: ActivityIslandPreferences): void {
    const temporaryPath = `${this.filePath}.tmp`
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, { encoding: 'utf8' })
      renameSync(temporaryPath, this.filePath)
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown'
      this.logger.error('activity-island', `preferences write failed (${code})`)
    }
  }
}
