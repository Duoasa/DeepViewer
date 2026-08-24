import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsKey } from './locales.ts'
import css from './ActivityIslandSection.module.css'

type OrbAnimation = 'particleOrb' | 'rippleGlow'

interface Preferences {
  enabled: boolean
  orbAnimation: OrbAnimation
  compactDelaySeconds: number
  hideDelaySeconds: number
}

interface DesktopSettingsBridge {
  getActivityIslandPreferences(): Promise<Preferences>
  setActivityIslandPreferences(patch: Partial<Preferences>): Promise<Preferences>
  onActivityIslandPreferences(listener: (preferences: Preferences) => void): () => void
}

const DEFAULTS: Preferences = {
  enabled: true,
  orbAnimation: 'particleOrb',
  compactDelaySeconds: 20,
  hideDelaySeconds: 100,
}

function bridge(): DesktopSettingsBridge | undefined {
  return (window as unknown as { deepviewerDesktop?: DesktopSettingsBridge }).deepviewerDesktop
}

type Props = PropsRuntime<'settings.section'> & PropsLocale<'settings'>

export function ActivityIslandSection({ t }: Props) {
  const desktop = bridge()
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS)
  const [available, setAvailable] = useState(desktop !== undefined)

  useEffect(() => {
    if (desktop === undefined) return
    let live = true
    const unsubscribe = desktop.onActivityIslandPreferences((next) => {
      if (live) setPreferences(next)
    })
    void desktop.getActivityIslandPreferences().then((next) => {
      if (live) setPreferences(next)
    }).catch(() => {
      if (live) setAvailable(false)
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [desktop])

  const update = (patch: Partial<Preferences>): void => {
    if (desktop === undefined) return
    setPreferences(current => ({ ...current, ...patch }))
    void desktop.setActivityIslandPreferences(patch).then(setPreferences).catch(() => {
      setAvailable(false)
    })
  }

  if (!available) {
    return <div className={css.unavailable}>{t('island.unavailable' as SettingsKey)}</div>
  }

  return (
    <div className={css.section}>
      <div className={css.heading}>
        <div>
          <h2>{t('island.title' as SettingsKey)}</h2>
          <p>{t('island.description' as SettingsKey)}</p>
        </div>
        <label className={css.switch}>
          <input
            type="checkbox"
            checked={preferences.enabled}
            onChange={event => { update({ enabled: event.currentTarget.checked }) }}
          />
          <span aria-hidden="true" />
          <span className={css.switchLabel}>{preferences.enabled
            ? t('island.enabled' as SettingsKey)
            : t('island.disabled' as SettingsKey)}</span>
        </label>
      </div>

      <fieldset className={css.group} disabled={!preferences.enabled}>
        <legend>{t('island.animation.title' as SettingsKey)}</legend>
        <p>{t('island.animation.description' as SettingsKey)}</p>
        <div className={css.animationGrid}>
          {(['particleOrb', 'rippleGlow'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              className={preferences.orbAnimation === mode ? css.selected : undefined}
              aria-pressed={preferences.orbAnimation === mode}
              onClick={() => { update({ orbAnimation: mode }) }}
            >
              <span className={mode === 'particleOrb' ? css.particlePreview : css.ripplePreview} aria-hidden="true" />
              <span>
                <strong>{t(`island.animation.${mode}` as SettingsKey)}</strong>
                <small>{t(`island.animation.${mode}.description` as SettingsKey)}</small>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={css.group} disabled={!preferences.enabled}>
        <legend>{t('island.timing.title' as SettingsKey)}</legend>
        <div className={css.rangeRow}>
          <label htmlFor="activity-island-compact-delay">
            <span>{t('island.compactDelay' as SettingsKey)}</span>
            <small>{t('island.compactDelay.description' as SettingsKey)}</small>
          </label>
          <output htmlFor="activity-island-compact-delay">{preferences.compactDelaySeconds} {t('island.seconds' as SettingsKey)}</output>
          <input
            id="activity-island-compact-delay"
            type="range"
            min="5"
            max="60"
            step="5"
            value={preferences.compactDelaySeconds}
            aria-valuetext={`${preferences.compactDelaySeconds} ${t('island.seconds' as SettingsKey)}`}
            onChange={event => { update({ compactDelaySeconds: Number(event.currentTarget.value) }) }}
          />
        </div>
        <div className={css.rangeRow}>
          <label htmlFor="activity-island-hide-delay">
            <span>{t('island.hideDelay' as SettingsKey)}</span>
            <small>{t('island.hideDelay.description' as SettingsKey)}</small>
          </label>
          <output htmlFor="activity-island-hide-delay">{preferences.hideDelaySeconds} {t('island.seconds' as SettingsKey)}</output>
          <input
            id="activity-island-hide-delay"
            type="range"
            min="5"
            max="120"
            step="5"
            value={preferences.hideDelaySeconds}
            aria-valuetext={`${preferences.hideDelaySeconds} ${t('island.seconds' as SettingsKey)}`}
            onChange={event => { update({ hideDelaySeconds: Number(event.currentTarget.value) }) }}
          />
        </div>
      </fieldset>
    </div>
  )
}
