import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ProviderCardExtrasOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import { CapabilityEditor, type SettingsMirrorLike, type WriteOp } from './CapabilityEditor.tsx'
import styles from './styles.module.css'

type Verdict = { status: string; source: string; note: string }
export type ScanRow = {
  id: string
  availability: string
  image: Verdict
  reasoning: { status: string; levels: string[]; source: string; note: string }
  compat?: { supportsDeveloperRole?: boolean }
  recommended?: { input: string[]; reasoningEfforts: false | Record<string, string | null> }
  requests: number
  note: string
}
export type ScanState = {
  status: string
  id?: string
  scope?: 'configured' | 'all'
  progress?: number
  total?: number
  discovered?: number
  truncated?: boolean
  results?: ScanRow[]
  startedAt?: string
  finishedAt?: string
  stale?: boolean
  appliedAt?: string
  canRestore?: boolean
  changed?: string[]
  error?: string
}
export type ScanCall = (method: string, payload: Record<string, unknown>) => Promise<ScanState>

type Props = ProviderCardExtrasOwnerProps & {
  mirror: SettingsMirrorLike
  write: WriteOp
  t: Translate
  scan: ScanCall
}

const SUPPORTED = ['openai-completions', 'openai-responses']

function sourceLabel(t: Translate, source: string) {
  switch (source) {
    case 'probe':
      return t('sourceProbe')
    case 'listing':
      return t('sourceListing')
    case 'pi-ai-catalog':
      return t('sourceCatalog')
    case 'name':
      return t('sourceName')
    default:
      return ''
  }
}

function availabilityLabel(t: Translate, value: string) {
  switch (value) {
    case 'available':
      return t('availabilityAvailable')
    case 'permission_denied':
      return t('availabilityPermissionDenied')
    case 'model_not_found':
      return t('availabilityNotFound')
    case 'non-text':
      return t('availabilityNonText')
    default:
      return t('availabilityUncertain')
  }
}

function localTime(iso: string | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export function ProviderScan({ provider, configured, keyConfigured, mirror, write, t, scan }: Props) {
  const route = provider.provider
  const snapshot = useSyncExternalStore(
    (listener) => mirror.subscribe(listener),
    () => mirror.getSnapshot(),
  )
  const namespace = snapshot.view?.namespaces.find((view) => view.ns === 'llm-pi-ai')
  const profile = ((namespace?.value ?? namespace?.user) as { providers?: Record<string, { api?: string; baseURL?: string }> } | undefined)?.providers?.[route]

  const [state, setState] = useState<ScanState>({ status: 'loading' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState<'configured' | 'all'>('configured')
  const [exclude, setExclude] = useState(false)
  const [addDiscovered, setAddDiscovered] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const refresh = useCallback(
    (onFail: string) => {
      let alive = true
      void scan('status', { route }).then(
        (value) => {
          if (alive) {
            setState(value)
            setError('')
          }
        },
        () => {
          if (alive) setError(onFail)
        },
      )
      return () => {
        alive = false
      }
    },
    [route, scan],
  )

  useEffect(() => refresh(t('serviceUnavailable')), [refresh, namespace?.revision, t])
  useEffect(() => {
    if (state.status !== 'running') return
    let cancel = () => {}
    const timer = setInterval(() => {
      cancel()
      cancel = refresh(t('disconnected'))
    }, 1500)
    return () => {
      clearInterval(timer)
      cancel()
    }
  }, [refresh, state.status, t])

  const action = async (method: string, payload: Record<string, unknown> = {}) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      setState(await scan(method, { route, id: state.id, ...payload }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!configured || !profile) {
    return (
      <section className={styles.scan}>
        <strong>{t('title')}</strong>
        <p>{t('saveFirst')}</p>
      </section>
    )
  }
  if (profile.api && !SUPPORTED.includes(profile.api)) {
    return (
      <section className={styles.scan}>
        <strong>{t('title')}</strong>
        <p>{t('protocols')}</p>
      </section>
    )
  }

  const running = state.status === 'running'
  const rows = state.results ?? []
  const complete = state.status === 'complete'
  const counts = {
    available: rows.filter((row) => row.availability === 'available').length,
    image: rows.filter((row) => row.image.status === 'supported').length,
    noImage: rows.filter((row) => row.image.status === 'unsupported').length,
    uncertain: rows.filter((row) => row.availability === 'available' && row.image.status === 'uncertain').length,
  }
  const canApply = complete && !state.stale && !state.appliedAt && Boolean(state.id)

  return (
    <section className={styles.scan} aria-label={`${provider.displayName} · ${t('title')}`}>
      <div className={styles.header}>
        <strong>{t('title')}</strong>
        <div className={styles.controls}>
          <select aria-label={t('scopeConfigured')} value={scope} disabled={running || busy} onChange={(event) => setScope(event.target.value === 'all' ? 'all' : 'configured')}>
            <option value="configured">{t('scopeConfigured')}</option>
            <option value="all">{t('scopeAll')}</option>
          </select>
          {running ? (
            <button type="button" disabled={busy} onClick={() => void action('stop')}>
              {t('stop')}
            </button>
          ) : (
            <button type="button" disabled={busy || !keyConfigured || state.status === 'loading'} onClick={() => void action('start', { scope })}>
              {state.status === 'new' ? t('scan') : t('rescan')}
            </button>
          )}
        </div>
      </div>
      <p className={styles.hint}>{t('hint')}</p>
      {!keyConfigured && <p role="alert">{t('keyFirst')}</p>}
      {state.status === 'new' && <p role="status">{t('notScanned')}</p>}
      {state.stale && state.status !== 'new' && <p role="status">{t('stale')}</p>}
      {running && (
        <p role="status" aria-live="polite">
          {state.total ? t('progress', { progress: state.progress ?? 0, total: state.total }) : t('reading')}
        </p>
      )}
      {state.status === 'interrupted' && <p role="alert">{t('interrupted')}</p>}
      {state.status === 'failed' && <p role="alert">{t('failed', { error: state.error ?? '' })}</p>}
      {state.status === 'cancelled' && <p role="status">{t('cancelled')}</p>}
      {state.truncated && <p role="status">{t('truncated', { total: state.total ?? 0 })}</p>}
      {rows.length > 0 && (
        <>
          <p className={styles.summary}>
            {t('summary', counts)}
            {state.finishedAt && <span className={styles.meta}> · {t('finishedAt', { time: localTime(state.finishedAt) })}</span>}
          </p>
          <div className={styles.actions}>
            <label>
              <input type="checkbox" checked={exclude} disabled={!canApply} onChange={(event) => setExclude(event.target.checked)} /> {t('exclude')}
            </label>
            {state.scope === 'all' && (
              <label>
                <input type="checkbox" checked={addDiscovered} disabled={!canApply} onChange={(event) => setAddDiscovered(event.target.checked)} /> {t('addDiscovered')}
              </label>
            )}
            <button type="button" disabled={busy || !canApply} onClick={() => void action('apply', { exclude, addDiscovered })}>
              {state.appliedAt ? t('applied', { time: localTime(state.appliedAt) }) : t('apply')}
            </button>
            {state.canRestore && (
              <button type="button" className={styles.quiet} disabled={busy} onClick={() => void action('restore')}>
                {t('restore')}
              </button>
            )}
          </div>
          <p className={styles.hint}>{t('applyNote')}</p>
          {state.appliedAt && state.changed && (
            <p role="status">{state.changed.length ? t('changed', { count: state.changed.length, ids: state.changed.join(', ') }) : t('noChange')}</p>
          )}
          <button type="button" className={styles.quiet} aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}>
            {t('details')} {showDetails ? '▾' : '▸'}
          </button>
          {showDetails && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('colModel')}</th>
                  <th>{t('colAvailability')}</th>
                  <th>{t('colImage')}</th>
                  <th>{t('colReasoning')}</th>
                  <th>{t('colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-availability={row.availability}>
                    <td>
                      <code>{row.id}</code>
                    </td>
                    <td>{availabilityLabel(t, row.availability)}</td>
                    <td data-verdict={row.image.status} title={row.image.note}>
                      {row.image.status === 'supported' ? t('imageSupported') : row.image.status === 'unsupported' ? t('imageUnsupported') : t('imageUncertain')}
                      {row.availability === 'available' && <small> {sourceLabel(t, row.image.source)}</small>}
                    </td>
                    <td data-verdict={row.reasoning.status} title={row.reasoning.note}>
                      {row.reasoning.status === 'confirmed'
                        ? `${t('reasoningConfirmed')} ${row.reasoning.levels.join('/')}`
                        : row.reasoning.status === 'unconfirmed'
                          ? `${t('reasoningUnconfirmed')}${row.reasoning.levels.length ? ` ${row.reasoning.levels.join('/')}` : ''}`
                          : row.reasoning.status === 'unsupported'
                            ? t('reasoningUnsupported')
                            : t('reasoningUncertain')}
                    </td>
                    <td className={styles.note}>
                      {row.note}
                      {row.recommended && <small>{t('willApply')} {row.recommended.input.includes('image') ? t('imgImage') : t('imgText')} · {row.recommended.reasoningEfforts ? Object.keys(row.recommended.reasoningEfforts).join('/') : t('noEffortParameter')}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <CapabilityEditor mirror={mirror} write={write} t={t} route={route} />
    </section>
  )
}
