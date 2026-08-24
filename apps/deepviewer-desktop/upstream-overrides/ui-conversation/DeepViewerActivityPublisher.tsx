import { useEffect, useRef } from 'react'
import type { ConversationSlotProps } from '../contract/slots.ts'

type ActivityState =
  | 'standby'
  | 'thinking'
  | 'working'
  | 'awaitingConfirmation'
  | 'completed'
  | 'error'

interface ActivityProjection {
  schemaVersion: 1
  sequence: number
  sessionId: string
  state: ActivityState
  title: string
  occurredAt: number
}

interface DesktopActivityBridge {
  publishActivityIsland(activity: ActivityProjection | null): void
}

type Props = Pick<ConversationSlotProps, 'sessionId' | 'useSession' | 'useSessions'>

function desktopBridge(): DesktopActivityBridge | undefined {
  return (window as unknown as { deepviewerDesktop?: DesktopActivityBridge }).deepviewerDesktop
}

function fallbackTitle(): string {
  return navigator.language.toLowerCase().startsWith('zh') ? '当前任务' : 'Current task'
}

/** Publish only a bounded state projection for the currently selected Session. */
export function DeepViewerActivityPublisher({ sessionId, useSession, useSessions }: Props) {
  const running = useSession(snapshot => snapshot.running) ?? false
  const runningCallCount = useSession(snapshot => snapshot.runningCalls.length) ?? 0
  const pendingCount = useSession(snapshot => snapshot.pending.length) ?? 0
  const promptError = useSession(snapshot => snapshot.promptError)
  const lastAgentError = useSession(snapshot => snapshot.lastAgentError)
  const displayTitle = useSessions(snapshot => sessionId === undefined
    ? undefined
    : snapshot.byId[sessionId]?.displayTitle)
  const previousSession = useRef<string | undefined>(undefined)
  const previousRunning = useRef(false)
  const sequence = useRef(0)

  useEffect(() => {
    const bridge = desktopBridge()
    if (bridge === undefined) return
    if (sessionId === undefined) {
      previousSession.current = undefined
      previousRunning.current = false
      bridge.publishActivityIsland(null)
      return
    }

    const sessionChanged = previousSession.current !== sessionId
    let state: ActivityState
    if (pendingCount > 0) state = 'awaitingConfirmation'
    else if (lastAgentError !== null && lastAgentError !== undefined
      || promptError !== null && promptError !== undefined) state = 'error'
    else if (running && runningCallCount > 0) state = 'working'
    else if (running) state = 'thinking'
    else if (!sessionChanged && previousRunning.current) state = 'completed'
    else state = 'standby'

    previousSession.current = sessionId
    previousRunning.current = running
    sequence.current += 1
    const occurredAt = Date.now()
    bridge.publishActivityIsland({
      schemaVersion: 1,
      sequence: occurredAt * 1_000 + sequence.current % 1_000,
      sessionId,
      state,
      title: displayTitle?.trim() || fallbackTitle(),
      occurredAt,
    })
  }, [displayTitle, lastAgentError, pendingCount, promptError, running, runningCallCount, sessionId])

  useEffect(() => () => { desktopBridge()?.publishActivityIsland(null) }, [])
  return null
}
