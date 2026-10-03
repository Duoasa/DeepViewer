import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import { LEVELS, modelEdit, providerModels, type EffortMode, type ImageMode, type SettingsViewLike } from './model-config.ts'
import styles from './styles.module.css'

export interface SettingsMirrorLike {
  getSnapshot(): { status: string; view: { writable?: boolean; namespaces: Array<SettingsViewLike & { ns: string }> } | undefined; error: string | null }
  subscribe(listener: () => void): () => void
  ensure(): Promise<void>
}
export type WriteOp = (op: ReturnType<typeof modelEdit>, revision: number, modelId: string) => Promise<unknown>

interface Props {
  mirror: SettingsMirrorLike
  write: WriteOp
  t: Translate
  route: string
}

/** Manual per-model override of image input and thinking levels. */
export function CapabilityEditor({ mirror, write, t, route }: Props) {
  const snapshot = useSyncExternalStore(
    (listener) => mirror.subscribe(listener),
    () => mirror.getSnapshot(),
  )
  useEffect(() => {
    void mirror.ensure()
  }, [mirror])
  const view = snapshot.view?.namespaces.find((entry) => entry.ns === 'llm-pi-ai')
  const models = view ? providerModels(view, route) : undefined

  const [id, setId] = useState('')
  const [effortMode, setEffortMode] = useState<EffortMode>('inherit')
  const [rows, setRows] = useState<Record<string, string>>({})
  const [imageMode, setImageMode] = useState<ImageMode>('preserve')
  const [loadedRevision, setLoadedRevision] = useState<number | undefined>()
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = (modelId: string) => {
    setId(modelId)
    setMessage('')
    setFailed(false)
    const model = models?.find((entry) => entry.id === modelId)
    if (!model) {
      setEffortMode('inherit')
      setRows({})
      setImageMode('preserve')
      setLoadedRevision(undefined)
      return
    }
    const efforts = model.reasoningEfforts
    if (efforts === undefined) setEffortMode('inherit')
    else if (efforts === false) setEffortMode('disabled')
    else setEffortMode('custom')
    setRows(efforts && typeof efforts === 'object' ? Object.fromEntries(Object.entries(efforts).map(([level, wire]) => [level, wire ?? ''])) : {})
    setImageMode('preserve')
    setLoadedRevision(view?.revision)
  }

  const stale = loadedRevision !== undefined && view?.revision !== loadedRevision
  const secretBlocked = Boolean(view?.secrets?.some((secret) => secret.path[0] === 'providers' && secret.path[1] === route && secret.path[2] === 'models'))

  const save = async () => {
    if (!view || !id || busy) return
    setBusy(true)
    setFailed(false)
    try {
      const op = modelEdit(view, route, id, effortMode, rows, imageMode)
      await write(op, view.revision, id)
      setMessage(t('saved'))
      setLoadedRevision(undefined)
      setImageMode('preserve')
    } catch (cause) {
      setFailed(true)
      setMessage(`${t('saveFailed')}：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setBusy(false)
    }
  }

  // `writable` describes the whole active profile (SettingsDescribeValue), not one namespace.
  if (!models?.length || snapshot.view?.writable === false) return null

  return (
    <details className={styles.editor}>
      <summary>{t('editor')}</summary>
      <p className={styles.hint}>{t('editorHint')}</p>
      {secretBlocked && <p role="alert">{t('editorSecrets')}</p>}
      <fieldset disabled={secretBlocked || busy}>
        <label className={styles.field}>
          <span>{t('model')}</span>
          <select value={id} onChange={(event) => load(event.target.value)}>
            <option value="">{t('choose')}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name && model.name !== model.id ? `${model.name} (${model.id})` : model.id}
              </option>
            ))}
          </select>
        </label>
        {id && loadedRevision !== undefined && (
          <>
            <label className={styles.field}>
              <span>{t('image')}</span>
              <select value={imageMode} onChange={(event) => setImageMode(event.target.value as ImageMode)}>
                <option value="preserve">{t('imgPreserve')}</option>
                <option value="inherit">{t('imgInherit')}</option>
                <option value="text">{t('imgText')}</option>
                <option value="image">{t('imgImage')}</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>{t('efforts')}</span>
              <select value={effortMode} onChange={(event) => setEffortMode(event.target.value as EffortMode)}>
                <option value="inherit">{t('effInherit')}</option>
                <option value="disabled">{t('effDisabled')}</option>
                <option value="custom">{t('effCustom')}</option>
              </select>
            </label>
            {effortMode === 'custom' && (
              <div className={styles.levels}>
                <button type="button" className={styles.quiet} onClick={() => setRows({ off: '', low: 'low', medium: 'medium', high: 'high' })}>
                  {t('preset')}
                </button>
                {LEVELS.map((level) => (
                  <div className={styles.level} key={level}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Object.hasOwn(rows, level)}
                        onChange={(event) =>
                          setRows((previous) => {
                            const next = { ...previous }
                            if (event.target.checked) next[level] = level === 'off' ? '' : level
                            else delete next[level]
                            return next
                          })
                        }
                      />
                      {t(level)}
                    </label>
                    <input
                      aria-label={`${t(level)} · ${t('wire')}`}
                      disabled={!Object.hasOwn(rows, level)}
                      value={rows[level] ?? ''}
                      maxLength={80}
                      onChange={(event) => setRows((previous) => ({ ...previous, [level]: event.target.value }))}
                    />
                  </div>
                ))}
                <p className={styles.hint}>{t('effortsNote')}</p>
              </div>
            )}
            {stale && <p role="alert">{t('editorStale')}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.quiet} onClick={() => load(id)}>
                {t('reload')}
              </button>
              <button type="button" disabled={stale} onClick={() => void save()}>
                {busy ? t('saving') : t('save')}
              </button>
            </div>
          </>
        )}
      </fieldset>
      {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    </details>
  )
}
