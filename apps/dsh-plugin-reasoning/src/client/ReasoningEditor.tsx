import { useEffect, useState, useSyncExternalStore } from 'react'
import { LEVELS, modelEdit } from './model-config.mjs'
import styles from './ReasoningEditor.module.css'
import type { SettingsDescribeFace } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
type Model = { id: string; name?: string; input?: string[]; reasoningEfforts?: false | Record<string, string | null> }
type Provider = { displayName?: string; models?: Model[] }
type ModelView = Omit<SettingsNamespaceView, 'user'> & { user?: { providers?: Record<string, Provider> } }
export interface ReasoningEditorProps {
  fixedProvider?: string
  mirror: SettingsDescribeFace
  write: (op: SettingsPathOpView, revision: number) => Promise<SettingsNamespaceView>
  t: (key: string) => string
}

export function ReasoningEditor({ mirror, write, t, fixedProvider }: ReasoningEditorProps) {
  const state = useSyncExternalStore(callback => mirror.subscribe(callback), () => mirror.getSnapshot())
  useEffect(() => { void mirror.ensure() }, [mirror])
  const current = state.view?.namespaces.find(v => v.ns === 'llm-pi-ai') as ModelView | undefined
  const providers = Object.entries(current?.user?.providers ?? {}).filter(([, p]) => Array.isArray(p.models) && p.models.length)
  const [route, setRoute] = useState(fixedProvider ?? '')
  const [id, setId] = useState('')
  const [baseline, setBaseline] = useState<ModelView | undefined>(undefined)
  const [imageMode, setImageMode] = useState('inherit')
  const [mode, setMode] = useState('inherit')
  const [rows, setRows] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const models = current?.user?.providers?.[route]?.models ?? []
  const stale = baseline && baseline.revision !== current?.revision
  const load = (modelId: string, view = current) => {
    setId(modelId); setBaseline(view); setMessage(''); setFailed(false)
    const model = view?.user?.providers?.[route]?.models?.find(m => m.id === modelId)
    const value = model?.reasoningEfforts
    setImageMode(model?.input?.includes('image') ? 'image' : model?.input?.length ? 'text' : 'inherit')
    setMode(value === false ? 'disabled' : value === undefined ? 'inherit' : 'custom')
    setRows(value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k, v ?? ''])) : {})
  }
  const save = async () => {
    if (!baseline || busy || stale || !state.view?.writable) return
    setBusy(true); setMessage(''); setFailed(false)
    try {
      const view = await write(modelEdit(baseline, route, id, mode, rows, imageMode), baseline.revision)
      load(id, view as ModelView); setMessage(t('saved'))
    } catch (e) { setMessage(t('error') + ': ' + (e instanceof Error ? e.message : String(e))); setFailed(true) }
    finally { setBusy(false) }
  }
  return <details className={styles.root}>
    <summary>{t('title')}</summary>
    <p>{t('description')}</p>
    {!providers.length && <p>{state.error || t('unavailable')}</p>}
    <fieldset disabled={busy || !state.view?.writable}>
      {!fixedProvider && <label>{t('provider')}<select value={route} onChange={e => { setRoute(e.target.value); setId(''); setBaseline(undefined); setMessage('') }}>
        <option value="">{t('choose')}</option>{providers.map(([key,p]) => <option key={key} value={key}>{p.displayName || key}</option>)}
      </select></label>}
      <label>{t('model')}<select value={id} onChange={e => load(e.target.value)}>
        <option value="">{t('choose')}</option>{models.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
      </select></label>
      {id && <>
        <label>{t('imageInput')}<select value={imageMode} onChange={e => setImageMode(e.target.value)}>
          <option value="inherit">{t('inherit')}</option><option value="text">{t('textOnly')}</option><option value="image">{t('textImage')}</option>
        </select></label>
        <p>{t('imageNote')}</p>
        <label>{t('mode')}<select value={mode} onChange={e => setMode(e.target.value)}>
          {['inherit','disabled','custom'].map(v => <option key={v} value={v}>{t(v)}</option>)}
        </select></label>
        {mode === 'custom' && <>
          <button type="button" onClick={() => setRows({ low: 'low', medium: 'medium', high: 'high' })}>{t('preset')}</button>
          {LEVELS.map(level => <div className={styles.level} key={level}>
            <label><input type="checkbox" checked={Object.hasOwn(rows, level)} onChange={e => setRows(prev => { const next = { ...prev }; if (e.target.checked) next[level] = level === 'off' ? '' : level; else delete next[level]; return next })}/>{t(level)}</label>
            <input aria-label={t(level) + ' · ' + t('wire')} disabled={!Object.hasOwn(rows,level)} value={rows[level] ?? ''} maxLength={80} onChange={e => setRows(prev => ({...prev, [level]: e.target.value}))}/>
          </div>)}
          <p>{t('note')}</p>
        </>}
        {stale && <p role="alert">{t('stale')}</p>}
        <div className={styles.actions}><button type="button" onClick={() => load(id)}>{t('reload')}</button><button type="button" disabled={!!stale} onClick={() => void save()}>{t(busy ? 'saving' : 'save')}</button></div>
      </>}
    </fieldset>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </details>
}
