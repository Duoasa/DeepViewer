import { IconFolderOpenOutlineRegular, IconNewChatOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from './locales.ts'
import { useRef, useState } from 'react'
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-agent-preset-registry/types'
import css from './mode.module.css'
type Injected = { change: (mode: 'work' | 'chat') => Promise<void> }
type Props = PropsRuntime<'sidebar.mode'> & InjectFace<Injected> & PropsLocale<'deepviewer'>
export function ModeSwitch({ wide, useSessions, change, t }: Props) {
  const chat = useSessions(s => Object.values(s.byId).some(row => (row.retainedBy.mainView ?? 0) > 0 && row.projectionValues?.agentPreset === 'deepviewer-chat'))
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  const pending = useRef(false)
  const select = async (mode: 'work' | 'chat') => {
    if (pending.current || (mode === 'chat') === chat) return
    pending.current = true
    setBusy(true); setError(undefined)
    try { await change(mode) } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className={css.root} data-wide={wide}>
    <div className={css.tabs} role="group" aria-label={t('modes')}>
      {(['work', 'chat'] as const).map(mode => <button type="button" key={mode} aria-label={t(mode)} aria-pressed={(mode === 'chat') === chat} disabled={busy} onClick={() => { void select(mode) }}>{mode === 'work' ? <IconFolderOpenOutlineRegular size={16} /> : <IconNewChatOutlineRegular size={16} />}{wide && <span>{t(mode)}</span>}</button>)}
    </div>
    {error && <div role="alert" className={css.error}>{error}</div>}
  </div>
}
