import { useEffect, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

declare module '@deepseek-ai/dsh-api-session-controller/client' { interface SessionReferenceSourceMap { deepviewerMap: unknown } }

type MapProps = PropsRuntime<'conversation.view'> & {
  /** Native shell navigation prepares the destination's own view state. */
  openSessionView?: (id: SessionId, view: string, focus: string) => Promise<void> | void
}

function safeSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** The iframe receives resolved theme values, never a second theme preference. */
function presentation(ctx: Context) {
  const theme = ctx.theme.getTheme()
  const style = getComputedStyle(document.body)
  const dark = theme.active.colorScheme === 'dark'
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    locale: ctx.locale.getLocale().active.startsWith('zh') ? 'zh-CN' : 'en-US',
    fontSize: theme.fontSize,
    fontFamily: style.fontFamily || '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    dark,
    tokens: {
      background: token('--dsw-alias-bg-base', dark ? '#141414' : '#ffffff'),
      surface: token('--dsw-alias-bg-layer-1', dark ? '#242424' : '#ffffff'),
      text: token('--dsw-alias-label-primary', dark ? '#f4f4f4' : '#242424'),
      muted: token('--dsw-alias-label-secondary', dark ? '#aaaaaa' : '#747474'),
      border: token('--dsw-alias-border-l2', dark ? '#383838' : '#e1e1e1'),
      accent: token('--dsw-alias-link', dark ? '#6b9fff' : '#3478f6'),
      hover: token('--dsw-alias-interactive-bg-hover', dark ? '#303030' : '#f1f1f1'),
      subtle: token('--dsw-alias-bg-layer-2', dark ? '#1c1c1c' : '#f7f7f7'),
      error: token('--dsw-alias-state-error-primary', dark ? '#ff8b86' : '#c62a24'),
    },
  }
}

export function registerSynapseView(ctx: Context) {
  const text = ctx.locale.bind('deepviewer')
  function MapView({ sessionId, openView, openSessionView }: MapProps) {
    const iframe = useRef<HTMLIFrameElement>(null)
    useEffect(() => {
      const frame = iframe.current
      if (!frame) return
      let disposed = false, reconcileQueued = false, navigationRequest = 0, pendingFork = false
      let selected = sessionId
      const connection = ctx.get('connection') as ConnectionHandle
      const observers = new Map<SessionId, { reference: SessionReference; cleanup?: () => void }>()
      const send = (type: string, payload: Record<string, unknown> = {}) => {
        if (!disposed) frame.contentWindow?.postMessage({ source: 'dsh-synapse', type, ...payload }, location.origin)
      }
      // The iframe owns its details width; the native input owns its height.
      // Both measurements stay in this one mount, and never become preferences.
      const content = frame.closest<HTMLElement>('[data-conversation-content]')
      const composer = content?.querySelector<HTMLElement>('[data-deepviewer-composer-seat]')
      let inspectorWidth = 0, lastComposerHeight: number | undefined
      const clearInspector = () => {
        inspectorWidth = 0
        content?.removeAttribute('data-deepviewer-map-inspector')
        content?.style.removeProperty('--deepviewer-map-inspector-width')
      }
      const setInspector = (width: number) => {
        if (width === 0) { clearInspector(); return }
        inspectorWidth = width
        content?.setAttribute('data-deepviewer-map-inspector', '')
        content?.style.setProperty('--deepviewer-map-inspector-width', `${width}px`)
      }
      const publishLayout = (force = false) => {
        if (disposed) return
        // A smaller window must not retain a stale desktop details column.
        if (inspectorWidth > frame.clientWidth) clearInspector()
        const height = composer?.offsetHeight ?? 0
        if (force || height !== lastComposerHeight) {
          lastComposerHeight = height
          send('synapse:layout', { composerHeight: height })
        }
      }
      const geometry = new ResizeObserver(() => { publishLayout() })
      geometry.observe(frame)
      if (composer) geometry.observe(composer)
      const snapshot = (id: SessionId) => {
        const row = ctx.sessions.list.getSnapshot().byId[id]
        return row ? { id, title: row.displayTitle, cwd: row.cwd ?? null } : null
      }
      const requireSession = (id: unknown): SessionId => {
        if (typeof id !== 'string' || !snapshot(id as SessionId)) throw new Error(text('mapSessionMissing'))
        return id as SessionId
      }
      const reconcile = () => {
        if (disposed) return
        const sessions = ctx.sessions.list.getSnapshot()
        // Cold history remains in the Host projection. Only the selected and
        // actually running sessions need Client streaming references.
        const wanted = new Set<SessionId>(sessions.ids.filter(id => sessions.byId[id]?.running))
        if (snapshot(selected)) wanted.add(selected)
        for (const [id, observer] of observers) {
          if (wanted.has(id)) continue
          observers.delete(id); observer.cleanup?.(); observer.reference.release()
          send('synapse:live-reply', { sessionId: id, running: false, text: '' })
        }
        for (const id of wanted) {
          if (observers.has(id)) continue
          const reference = ctx.sessions.retain(id, { source: 'deepviewerMap' })
          const observer = { reference, cleanup: undefined as (() => void) | undefined }
          observers.set(id, observer)
          void reference.ready.then(binding => {
            if (disposed || observers.get(id) !== observer) return
            const chat = ctx.uiConversation.binding(binding).target('chat')
            const publish = () => {
              const current = chat.getSnapshot()
              const partial = current?.legacy.partial
              // The native classifier assigns both turn-opening and next-step
              // human inputs to user/steering; injected notices are context.
              const userSeq = current?.legacy.nodes.filter(node => node.kind === 'user' || node.kind === 'steering').at(-1)?.seq
              const output = partial?.blocks.filter(block => block.kind === 'text').map(block => block.text).join('') ?? ''
              send('synapse:live-reply', { sessionId: id, running: binding.session.getSnapshot().running, text: output, userSeq })
            }
            const offChat = chat.subscribe(publish), offSession = binding.session.subscribe(publish)
            observer.cleanup = () => { offChat(); offSession() }
            publish()
          }).catch(error => {
            if (disposed || observers.get(id) !== observer) return
            observers.delete(id); observer.cleanup?.(); reference.release()
            send('synapse:bridge-error', { message: error instanceof Error ? error.message : String(error) })
          })
        }
      }
      const scheduleReconcile = () => {
        if (reconcileQueued || disposed) return
        reconcileQueued = true
        queueMicrotask(() => { reconcileQueued = false; reconcile() })
      }
      const sync = () => {
        const sessions = ctx.sessions.list.getSnapshot()
        const workspaces = ctx.workspaces.list.getSnapshot().items
        const known = new Set(workspaces.flatMap(w => w.sessionIds))
        send('synapse:workspaces', { workspaces: [
          ...workspaces.map(w => ({ id: w.workspaceId, title: w.title, path: w.path, sessionIds: w.sessionIds })),
          { id: 'dsh-ungrouped', title: text('mapUngrouped'), path: null, sessionIds: sessions.ids.filter(id => !known.has(id)) },
        ] })
        send('synapse:current-session', { session: snapshot(selected) })
        send('synapse:presentation', presentation(ctx))
        send('synapse:theme', { dark: ctx.theme.getTheme().active.colorScheme === 'dark' })
        scheduleReconcile()
        publishLayout()
      }
      const navigate = async (id: SessionId, view: string, seq?: number, request = ++navigationRequest) => {
        const previous = selected
        const focus = seq === undefined ? '' : `seq:${seq}`
        const commit = async () => {
          if (disposed || request !== navigationRequest) return false
          if (!openSessionView && id !== sessionId) throw new Error('Native session navigation unavailable')
          selected = id
          if (openSessionView) await openSessionView(id, view, focus)
          else { ctx.uiWorkspace.openSession(id); openView(view, focus) }
          if (request !== navigationRequest) return false
          if (!disposed) sync()
          return true
        }
        try {
          // Keep paged history alive until the native destination owns it.
          return await ctx.sessions.using(id, { source: 'deepviewerMap' }, async reference => {
            const binding = await reference.ready
            if (seq !== undefined) await binding.session.loadThrough(seq as SessionSeq)
            return commit()
          })
        } catch (error) {
          if (!disposed && request === navigationRequest) { selected = previous; sync() }
          throw error
        }
      }
      const create = async (workspaceId?: unknown) => {
        const workspaces = ctx.workspaces.list.getSnapshot().items
        const workspace = workspaceId === undefined
          ? workspaces.find(w => w.sessionIds.includes(selected))
          : workspaces.find(w => w.workspaceId === workspaceId)
        if (workspaceId && workspaceId !== 'dsh-ungrouped' && !workspace) throw new Error(text('mapSessionMissing'))
        const source = ctx.sessions.list.getSnapshot().byId[selected]
        return ctx.sessions.create(workspace ? { workspaceId: workspace.workspaceId as WorkspaceId } : { agentPreset: source?.projectionValues?.agentPreset === 'deepviewer-chat' ? 'deepviewer-chat' : undefined })
      }
      const onMessage = async (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.source !== 'dsh-synapse') return
        const data = event.data
        try {
          if (data.type === 'synapse:layout') {
            const width = data.inspectorWidth
            if (typeof width !== 'number' || !Number.isFinite(width) || width < 0 || width > frame.clientWidth) throw new Error('Invalid inspector width')
            setInspector(width)
            publishLayout()
          } else if (data.type === 'synapse:api') {
            const result = await connection.rpc.call('/deepviewer-synapse', 'request', { path: data.path, method: data.method, body: data.body })
            if (!result.ok) throw new Error(result.error.message)
            send('synapse:api-result', { requestId: data.requestId, value: result.value })
          } else if (data.type === 'synapse:request-current') { sync(); publishLayout(true); send('synapse:map-opened') }
          else if (data.type === 'synapse:close') await navigate(selected, 'chat')
          else if (data.type === 'synapse:open-session' || data.type === 'synapse:activate-session') {
            if (data.seq !== undefined && !safeSeq(data.seq)) throw new Error('Invalid conversation position')
            await navigate(requireSession(data.sessionId), data.type === 'synapse:open-session' ? 'chat' : 'deepviewer-map', data.seq)
          } else if (data.type === 'synapse:compose') {
            // A second click must never manufacture a second native branch.
            if (data.fork === true && pendingFork) throw new Error('A branch is already being prepared')
            const request = ++navigationRequest
            if (data.atSeq !== undefined && !safeSeq(data.atSeq)) throw new Error('Invalid fork boundary')
            if (data.text !== undefined && (typeof data.text !== 'string' || data.text.length > 100000)) throw new Error('Invalid draft')
            if (data.fork !== undefined && typeof data.fork !== 'boolean') throw new Error('Invalid compose action')
            if (data.fork === true && data.sessionId === undefined) throw new Error('Fork source required')
            if (data.fork === true) pendingFork = true
            let preparedInput: ReturnType<typeof ctx.conversation.input.for> | undefined
            let preparedScope: Context | undefined
            let acknowledged = false
            try {
              let id = data.sessionId === undefined ? await create() : requireSession(data.sessionId)
              if (data.fork === true) id = await ctx.sessions.fork({ sessionId: id, atSeq: data.atSeq, increaseTitle: true })
              // The native editor owns attachments, model/permission controls,
              // drafts and submission. A canvas action never sends a prompt.
              await ctx.sessions.using(id, { source: 'deepviewerMap' }, async reference => {
                const binding = await reference.ready
                if (disposed) return
                if (request !== navigationRequest) throw new Error('Conversation action was superseded')
                const input = ctx.conversation.input.for(binding.ctx)
                preparedInput = input; preparedScope = binding.ctx
                if (data.text) {
                  const draft = input.state.getSnapshot().draft
                  const next = draft.trim() ? `${draft}\n\n${data.text}` : data.text
                  if (next.length > 100000) throw new Error('Draft exceeds supported length')
                  input.setDraft(next)
                }
                // Reply before native selection can retire this iframe. The
                // canvas persists the new child's exact visual anchor here.
                send('synapse:composed', { requestId: data.requestId, session: snapshot(id) })
                acknowledged = true
                if (!await navigate(id, 'deepviewer-map', undefined, request)) {
                  if (!disposed) throw new Error('Conversation action was superseded')
                  return
                }
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
                if (request === navigationRequest) input.focus()
              })
            } catch (error) {
              if (!acknowledged) throw error
              const message = error instanceof Error ? error.message : String(error)
              // A settled preparation RPC cannot carry a later navigation
              // failure. Surface it in the native editor and the surviving map.
              preparedInput?.notify('error', message)
              const current = ctx.sessions.binding(selected)
              if (current && current.ctx !== preparedScope) ctx.conversation.input.for(current.ctx).notify('error', message)
              send('synapse:bridge-error', { message })
            } finally { if (data.fork === true) pendingFork = false }
          } else if (data.type === 'synapse:create-session') {
            const request = ++navigationRequest
            const id = await create(data.workspaceId)
            send('synapse:created-session', { requestId: data.requestId, session: snapshot(id) })
            await navigate(id, 'deepviewer-map', undefined, request)
          } else if (data.type === 'synapse:fork-session') {
            const request = ++navigationRequest
            if (data.atSeq !== undefined && !safeSeq(data.atSeq)) throw new Error('Invalid fork boundary')
            const id = await ctx.sessions.fork({ sessionId: requireSession(data.sessionId), atSeq: data.atSeq, increaseTitle: true })
            send('synapse:forked-session', { requestId: data.requestId, session: snapshot(id) })
            await navigate(id, 'deepviewer-map', undefined, request)
          } else if (data.type === 'synapse:send-message') {
            throw new Error('Use the native DeepViewer composer to send messages')
          }
        } catch (error) { send('synapse:bridge-error', { requestId: data.requestId, message: error instanceof Error ? error.message : String(error) }) }
      }
      const onLoad = () => { sync(); publishLayout(true); send('synapse:map-opened') }
      window.addEventListener('message', onMessage)
      frame.addEventListener('load', onLoad)
      const offSessions = ctx.sessions.list.subscribe(sync)
      const offWorkspaces = ctx.workspaces.list.subscribe(sync)
      const offTheme = ctx.on('theme/change', sync)
      const offLocale = ctx.on('locale/change', sync)
      const appearance = new MutationObserver(sync)
      appearance.observe(document.body, { attributes: true, attributeFilter: ['style', 'data-ds-dark-theme'] })
      appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'lang'] })
      sync()
      return () => {
        disposed = true
        geometry.disconnect(); clearInspector()
        window.removeEventListener('message', onMessage); frame.removeEventListener('load', onLoad)
        offSessions(); offWorkspaces(); offTheme?.(); offLocale?.(); appearance.disconnect()
        for (const observer of observers.values()) { observer.cleanup?.(); observer.reference.release() }
        observers.clear()
      }
    }, [sessionId, openView, openSessionView])
    return <iframe ref={iframe} title={text('map')} src="/assets/deepviewer/synapse/index.html" data-deepviewer-map="" style={{ border: 0, width: '100%', height: '100%', minHeight: 0, display: 'block', flex: 1 }} />
  }
  ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'deepviewer-map', order: 20, label: () => text('map') }, MapView))
}
