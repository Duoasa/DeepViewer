/**
 * DeepViewer settings shell override.
 *
 * Keeps the Harness settings section/slot contracts intact while presenting
 * settings as a full-window application page instead of a centered modal.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ConnectionIndicator, IconAgentPresetOutline16, IconChevronLeftOutline14, IconDataOutline16,
  IconPersonalizationOutline16, IconQuestionOutline14, IconSettingsOutline16, Portal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionIndicatorState } from '@deepseek-ai/dsh-client-ui-primitives'
const RECOVERY_CONFIRMATION_MS = 2_000

import type { SettingsRootComponentProps, SettingsSectionRow } from './shell-contract.ts'
import css from './SettingsRoot.module.css'

/** Nav glyph by section id; unknown ids fall back to the settings gear. */
function navIcon(id: string) {
  if (id === 'models') return <IconDataOutline16 className={css.navIcon} size={16} />
  if (id === 'agent-presets') return <IconAgentPresetOutline16 className={css.navIcon} size={16} />
  if (id === 'plugins') return <IconPersonalizationOutline16 className={css.navIcon} size={16} />
  if (id === 'about') return <IconQuestionOutline14 className={css.navIcon} size={16} />
  return <IconSettingsOutline16 className={css.navIcon} size={16} />
}

type PanelProps = {
  rows: readonly SettingsSectionRow[]
  renderSlot: SettingsRootComponentProps['renderSlot']
  activeId: string | undefined
  onSelect: (id: string) => void
  onClose: () => void
}

/** Render one settings navigation entry. */
function NavCell({
  row,
  active,
  onSelect,
}: {
  row: SettingsSectionRow
  active: string | undefined
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      className={clsx(css.navCell, row.id === active && css.active)}
      aria-current={row.id === active ? 'true' : undefined}
      onClick={() => { onSelect(row.id) }}
    >
      {navIcon(row.id)}
      <span className={css.navLabel}>{row.label}</span>
    </button>
  )
}

/**
 * Full-window settings surface. The invisible mask is retained only as the
 * legacy click-close contract for upstream component tests; it paints nothing.
 */
function SettingsPanel({ rows, renderSlot, activeId, onSelect, onClose }: PanelProps) {
  const subscriptionsRow = rows.find(row => row.id === 'subscriptions')
  const integratesSubscriptions = subscriptionsRow !== undefined && rows.some(row => row.id === 'models')
  const visibleRows = integratesSubscriptions ? rows.filter(row => row.id !== 'subscriptions') : rows
  const activeRow = visibleRows.find(row => row.id === activeId) ?? visibleRows[0]
  const active = activeRow?.id
  const mainRows = visibleRows.filter(row => row.id !== 'about')
  const footerRows = visibleRows.filter(row => row.id === 'about')
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  const backButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { backButton.current?.focus() }, [])

  return (
    <Portal>
      <div className={css.overlay} role="presentation">
        <div className={css.mask} aria-hidden="true" onClick={onClose} />
        <div className={css.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <nav className={css.nav} aria-labelledby={titleId}>
            <button ref={backButton} type="button" className={css.back} onClick={onClose}>
              <IconChevronLeftOutline14 className={css.backIcon} size={16} />
              <span>{renderSlot('settings.close', {})}</span>
            </button>
            <div className={css.navTitle} id={titleId}>{renderSlot('settings.header', {})}</div>
            <div className={css.navList}>
              <div className={css.navMain}>
                {mainRows.map(row => (
                  <NavCell key={row.id} row={row} active={active} onSelect={onSelect} />
                ))}
              </div>
              {footerRows.length > 0 && (
                <div className={css.navFooter}>
                  {footerRows.map(row => (
                    <NavCell key={row.id} row={row} active={active} onSelect={onSelect} />
                  ))}
                </div>
              )}
            </div>
          </nav>
          <section className={css.content} aria-labelledby={`${titleId}-page`}>
            <div className={css.dragBar} aria-hidden="true" />
            <div className={css.contentScroll}>
              <div className={css.contentInner}>
                <div className={css.header}>
                  <h1 className={css.pageTitle} id={`${titleId}-page`}>{activeRow?.label ?? ''}</h1>
                  <div className={css.actions}>{renderSlot('settings.action', {})}</div>
                </div>
                <div className={css.options}>
                  {active !== undefined && (
                    <>
                      {renderSlot('settings.section', { close: onClose }, { only: active })}
                      {active === 'models' && subscriptionsRow !== undefined && (
                        <section
                          className={css.integratedSection}
                          aria-labelledby={`${titleId}-subscriptions`}
                        >
                          <h2 className={css.integratedTitle} id={`${titleId}-subscriptions`}>
                            {subscriptionsRow.label}
                          </h2>
                          {renderSlot('settings.section', { close: onClose }, { only: 'subscriptions' })}
                        </section>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Portal>
  )
}

/** Render the settings trigger and full-window page. */
export function SettingsRoot(props: SettingsRootComponentProps) {
  const {
    wide, reconnect, useConnectionState, useSections, useOnboardingSteps, useSessions, renderSlot, t,
  } = props
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [completedOnboarding, setCompletedOnboarding] = useState<ReadonlySet<string>>(() => new Set())
  const [showRecovery, setShowRecovery] = useState(false)
  const triggerButton = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(open)
  const close = useCallback(() => {
    setOpen(false)
    setActiveId(undefined)
  }, [])
  // Restore after the close commit, when the dialog can no longer own focus.
  useEffect(() => {
    if (wasOpen.current && !open) triggerButton.current?.focus()
    wasOpen.current = open
  }, [open])
  const openSection = useCallback((id: string) => {
    setActiveId(id)
    setOpen(true)
  }, [])

  // The ledger tick keeps the nav rows fresh: registrants re-register with
  // freshly localized text on locale change, and the trigger/header/close
  // seats re-render through their own outlets' subscriptions.
  const rows = useSections(s => s)
  const connectionState = useConnectionState(state => state)
  const previousConnectionState = useRef(connectionState)
  const onboardingSteps = useOnboardingSteps(s => s)
  const onboardingActive = useSessions(state =>
    state.phase === 'ready'
    && (state.current === undefined || state.byId[state.current]?.blank === true))
  const onboardingStep = onboardingActive
    ? onboardingSteps.find(step => !completedOnboarding.has(step.id))
    : undefined

  useEffect(() => {
    if (onboardingActive) return
    setCompletedOnboarding(new Set())
  }, [onboardingActive])

  useLayoutEffect(() => {
    const previous = previousConnectionState.current
    previousConnectionState.current = connectionState
    if (connectionState !== 'connected') {
      setShowRecovery(false)
      return
    }
    if (previous !== 'disconnected' && previous !== 'connecting') return
    setShowRecovery(true)
    const timeout = window.setTimeout(() => { setShowRecovery(false) }, RECOVERY_CONFIRMATION_MS)
    return () => { window.clearTimeout(timeout) }
  }, [connectionState])

  const completeOnboardingStep = useCallback((id: string) => {
    setCompletedOnboarding((previous) => {
      if (previous.has(id)) return previous
      return new Set([...previous, id])
    })
  }, [])

  let connectionIndicator: ConnectionIndicatorState | undefined
  if (connectionState === 'disconnected') {
    connectionIndicator = 'disconnected'
  } else if (connectionState === 'connecting') {
    connectionIndicator = 'connecting'
  } else if (showRecovery) {
    connectionIndicator = 'recovered'
  }

  return (
    <>
      <div className={clsx(css.triggerRow, !wide && css.railRow)}>
        <button
          ref={triggerButton}
          type="button"
          className={clsx(css.trigger, !wide && css.rail)}
          aria-label={t('trigger')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => { setOpen(true) }}
        >
          {renderSlot('settings.trigger', { wide })}
        </button>
        <ConnectionIndicator
          state={wide ? connectionIndicator : undefined}
          disconnectedLabel={t('connection.error')}
          reconnectLabel={t('connection.retry')}
          connectingLabel={t('connection.connecting')}
          recoveredLabel={t('connection.connected')}
          reconnectActionLabel={t('connection.reconnect')}
          restartActionLabel={t('connection.restart')}
          onReconnect={reconnect}
        />
      </div>
      {open && (
        <SettingsPanel
          rows={rows}
          renderSlot={renderSlot}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={close}
        />
      )}
      {/* Dialog chrome and `#root` inert ownership live inside each step's
          visible branch. A step still deciding (private facts loading)
          renders null, so nothing paints or blocks while it decides. */}
      {onboardingStep !== undefined && renderSlot('settings.onboarding', {
        stepId: onboardingStep.id,
        complete: () => { completeOnboardingStep(onboardingStep.id) },
        openSection,
      }, { only: onboardingStep.id })}
    </>
  )
}
