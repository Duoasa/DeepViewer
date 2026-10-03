import { useCallback, useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type {} from './locales.ts'
import type { EditorStore } from './editor-store.ts'
import { CodeEditor } from './CodeEditor.tsx'
import css from './workspace.module.css'
export type WorkspaceInjected = { call: (sessionId: string, method: string, payload?: Record<string, unknown>) => Promise<unknown> }
type Base = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<WorkspaceInjected> & PropsLocale<'deepviewer'>
export function EditorPanel({ sessionId, useTabInfo, useStore, actions, call, t }: Base & PropsStore<EditorStore>) {
  const { tab } = useTabInfo(), path = (tab.navigation.params as { path?: string } | undefined)?.path
  const file = useStore(state => path === undefined ? undefined : state.byPath[path])
  const [error, setError] = useState<string>(), [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    if (!path || (file?.text !== file?.saved && !window.confirm(t('discardDraft')))) return
    setBusy(true); setError(undefined)
    try { const value = await call(sessionId, 'editor.read', { path }) as { path: string; text: string; version: string }; actions.loaded(value) }
    catch (error) { setError(String(error)) } finally { setBusy(false) }
  }, [path, sessionId, file?.text, file?.saved, call, actions, t])
  useEffect(() => { if (path && !file) void reload() }, [path, file, reload])
  const save = async () => {
    if (!file || busy) return
    setBusy(true); setError(undefined)
    try { const value = await call(sessionId, 'editor.save', { path: file.path, text: file.text, version: file.version }) as { path: string; text: string; version: string }; actions.saved(value) }
    catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <section className={css.panel} aria-label={t('editor')}>
    <div className={css.toolbar}><span className={css.path}>{path}</span>{file && file.text !== file.saved && <span aria-label={t('unsaved')}>●</span>}<button disabled={!file || busy || file.text === file.saved} onClick={() => { void save() }}>{t('save')}</button><button disabled={busy} onClick={() => { void reload() }}>{t('reload')}</button></div>
    {error && <div role="alert" className={css.error}>{error}</div>}
    {file && <CodeEditor path={file.path} label={t('editor')} text={file.text} onChange={text => actions.edit(file.path, text)} onSave={() => { void save() }} />}
  </section>
}
interface GitState { isRepo: boolean; root?: string; branch?: string; repositories?: string[]; entries: { path: string; xy: string }[] }
export function GitPanel({ sessionId, useTabInfo, call, t }: Base) {
  const { tab } = useTabInfo()
  const [status, setStatus] = useState<GitState>(), [diff, setDiff] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState<string>(), [busy, setBusy] = useState(false), [branches, setBranches] = useState<string[]>([]), [repository, setRepository] = useState<string>()
  const refresh = useCallback(async () => {
    if (!tab.visible) return
    setError(undefined)
    try { const state = await call(sessionId, 'git.status', { repository }) as GitState; setStatus(state); if (state.isRepo) setBranches((await call(sessionId, 'git.branches', { repository }) as { names: string[] }).names) }
    catch (error) { setError(String(error)) }
  }, [tab.visible, sessionId, repository, call])
  useEffect(() => { void refresh() }, [refresh])
  const run = async (method: string, payload: Record<string, unknown> = {}) => {
    if (busy) return
    setBusy(true); setError(undefined)
    try { const value = await call(sessionId, method, { ...payload, repository }); if (method === 'git.diff') setDiff(String(value)); else if (method === 'git.log') setDiff(JSON.stringify(value, null, 2)); else { await refresh(); if (method === 'git.commit') setMessage('') } }
    catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <section className={css.panel} aria-label="Git">
    <div className={css.toolbar}><strong>Git</strong>{status?.isRepo && <select aria-label={t('branch')} value={status.branch ?? ''} disabled={busy} onChange={event => { void run('git.checkout', { branch: event.target.value }) }}>{branches.map(branch => <option key={branch}>{branch}</option>)}</select>}<button disabled={busy} onClick={() => { void refresh() }}>{t('reload')}</button><button disabled={busy || !status?.isRepo} onClick={() => { void run('git.log') }}>{t('history')}</button></div>
    {error && <div role="alert" className={css.error}>{error}</div>}
    {status?.isRepo && (status.repositories?.length ?? 0) > 1 && <select aria-label={t('repository')} value={repository ?? status.root ?? ''} disabled={busy} onChange={event => { setRepository(event.target.value); setDiff('') }}>{status.repositories?.map(path => <option key={path}>{path}</option>)}</select>}
    {!status?.isRepo && <div className={css.empty}>{status?.repositories?.length ? <select aria-label={t('repository')} value={repository ?? ''} onChange={event => setRepository(event.target.value)}><option value="">{t('repository')}</option>{status.repositories.map(path => <option key={path}>{path}</option>)}</select> : t('noRepository')}</div>}
    {status?.entries.map(entry => <div className={css.file} key={entry.path}><button className={css.filePath} disabled={busy} onClick={() => { void run('git.diff', { path: entry.path, staged: entry.xy[0] !== ' ' && entry.xy !== '??' }) }}>{entry.xy} {entry.path}</button><button disabled={busy} onClick={() => { void run('git.stage', { path: entry.path }) }}>+</button><button disabled={busy || entry.xy[0] === ' ' || entry.xy === '??'} onClick={() => { void run('git.unstage', { path: entry.path }) }}>−</button></div>)}
    {status?.isRepo && <div className={css.commit}><input value={message} placeholder={t('commitMessage')} aria-label={t('commitMessage')} onChange={event => setMessage(event.target.value)} /><button disabled={busy || !message.trim() || !status.entries.some(entry => entry.xy[0] !== ' ' && entry.xy !== '??')} onClick={() => { void run('git.commit', { message }) }}>{t('commit')}</button></div>}
    {diff && <pre className={css.diff}>{diff}</pre>}
  </section>
}
export function WorkspacePanelTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>) { const { tab } = useTabInfo(); const path = (tab.navigation.params as { path?: string } | undefined)?.path; return <>{path?.split('/').at(-1) ?? tab.title}</> }
