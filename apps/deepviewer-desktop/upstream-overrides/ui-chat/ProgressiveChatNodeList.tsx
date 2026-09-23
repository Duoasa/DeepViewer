import { useMemo, useSyncExternalStore, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconThinkOutline14, IconSearchOutline16, IconCodeOutline16, IconEditOutline16, IconAgentPresetOutline16, IconApiOutline14, IconBrowseOutline16, IconGlobeOutline14, IconSparkle16, IconChevronRightOutline14, IconContextInjectionOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatNode } from '../contract/chat-nodes.ts'
import type { ChatNodeStore } from '../contract/snapshot.ts'
import { ChatNodeSeat } from './ChatNodeSeat.tsx'
import { processEntries, processSummaryDetails, type Activity, type Group, type Category } from './progressive-process.ts'
import css from './ProgressiveChatNodeList.module.css'

type SeatProps = Omit<ComponentProps<typeof ChatNodeSeat>, 'nodeKey'>
export type ProgressiveProps = SeatProps & { order: readonly string[]; nodeStore: ChatNodeStore; waiting: boolean }
/** Node store identity is stable: subscribe to individual keys, including lifecycle-only updates. */
export function observeProcessNodes(store: ChatNodeStore, order: readonly string[]) {
  let cached: readonly (ChatNode | undefined)[] = []
  return {
    subscribe(listener: () => void) { const stops = order.map(key => store.source(key).subscribe(listener)); return () => stops.forEach(stop => stop()) },
    getSnapshot() {
      const next = order.map(key => store.get(key) as ChatNode | undefined)
      if (next.length !== cached.length || next.some((node, i) => node !== cached[i])) cached = next
      return cached
    },
  }
}
function Mount({ host }: { host: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { ref.current?.append(host); return () => { host.remove() } }, [host])
  return <div ref={ref} className={css.mount} />
}
const processIcons = { context: IconContextInjectionOutline16, reasoning: IconThinkOutline14, read: IconSearchOutline16, command: IconApiOutline14, write: IconEditOutline16, agent: IconAgentPresetOutline16, other: IconSparkle16 }
const processCategories = ['reasoning', 'read', 'command', 'write', 'agent', 'other'] as const
function activityCounts(activities: readonly Activity[], t: SeatProps['t']): string {
  return processCategories.flatMap(category => {
    const count = activities.filter(item => item.category === category).length
    return count ? [t(`process.count.${category}`, { count })] : []
  }).join(' · ')
}
function activityIcon(item: Activity) {
  if (['read', 'read_image', 'web_fetch'].includes(item.toolName ?? '')) return IconBrowseOutline16
  if (item.toolName === 'web_search') return IconGlobeOutline14
  if (item.toolName === 'run_code') return IconCodeOutline16
  return processIcons[item.category]
}
function ProcessSummary({ category = 'other', activities = [], detail, children }: { category?: Category; activities?: readonly Activity[]; detail?: string; children: ReactNode }) {
  const firstIcon = activities[0] ? activityIcon(activities[0]) : undefined
  const Icon = firstIcon && activities.every(item => activityIcon(item) === firstIcon) ? firstIcon : processIcons[category]
  return <summary className={css.summary}>
    <span className={css.summaryIcon} aria-hidden="true"><Icon size={14} /></span>
    <span className={css.summaryLabel}>{children}</span>
    {detail && <span className={css.summaryDetail} title={detail}> · {detail}</span>}
    <span className={css.summaryChevron} aria-hidden="true"><IconChevronRightOutline14 size={14} /></span>
  </summary>
}
function ContextGroup({ group, hosts, t }: { group: Group; hosts: Map<string, HTMLElement>; t: SeatProps['t'] }) {
  return <section className={css.group} data-progressive-context="true">
    <details>
      <ProcessSummary category="context" detail={processSummaryDetails(group.activities)}>{t('process.context')} · {group.activities.length}</ProcessSummary>
      <div className={css.contextItems}>
        {group.activities.map(item => <Mount key={item.id} host={hosts.get(item.id)!} />)}
      </div>
    </details>
  </section>
}
function ProcessGroup({ group, hosts, expanded, waiting, t, historyIncomplete }: {
  group: Group; hosts: Map<string, HTMLElement>; expanded: Set<string>; waiting: boolean; t: SeatProps['t']; historyIncomplete: boolean
}) {
  const history = useRef<HTMLDetailsElement>(null)
  const parallel = useRef<HTMLDetailsElement>(null)
  const previousCurrent = useRef<string | undefined>(undefined)
  const categories = useRef(new Map<Category, HTMLDetailsElement>())
  const previous = useRef(new Map<string, Activity['state']>())
  useLayoutEffect(() => {
    const currentId = group.activities.filter(item => item.state === 'running').at(-1)?.id
    const prior = previousCurrent.current
    if (prior && prior !== currentId && group.activities.some(item => item.id === prior && item.state === 'running')
      && (expanded.has(prior) || hosts.get(prior)?.contains(document.activeElement)) && parallel.current) parallel.current.open = true
    previousCurrent.current = currentId
    for (const item of group.activities) {
      if (item.state === 'done' && previous.current.get(item.id) === 'running' && (expanded.has(item.id) || hosts.get(item.id)?.contains(document.activeElement))) {
        if (history.current) history.current.open = true
        const section = categories.current.get(item.category)
        if (section) section.open = true
      }
    }
    previous.current = new Map(group.activities.map(item => [item.id, item.state]))
  }, [group.activities, expanded, hosts])
  const active = group.activities.filter(item => item.state === 'running')
  const done = group.activities.filter(item => item.state === 'done')
  const current = active.at(-1)
  const mount = (item: Activity) => <Mount key={item.id} host={hosts.get(item.id)!} />
  return <section className={css.group} data-progressive-process="true">
    {current && <div data-process-current="true" data-live={!waiting}>{mount(current)}</div>}
    <details ref={parallel} className={css.parallel} hidden={active.length < 2}>
      <ProcessSummary activities={active} detail={activityCounts(active, t)}>{t('process.parallel', { count: active.length })}</ProcessSummary>
      {active.slice(0, -1).map(mount)}
    </details>
    {group.activities.filter(item => item.state === 'attention').map(mount)}
    <details ref={history} hidden={!done.length} className={css.history}>
      <ProcessSummary activities={done} detail={activityCounts(done, t)} category={done.length && done.every(item => item.category === done[0]!.category) ? done[0]!.category : 'other'}>{t(historyIncomplete ? 'process.loaded' : 'process.completed', { count: done.length })}</ProcessSummary>
      {processCategories.map(category => {
        const items = done.filter(item => item.category === category)
        return <details key={category} hidden={!items.length} ref={element => { if (element) categories.current.set(category, element); else categories.current.delete(category) }}>
          <ProcessSummary category={category} activities={items} detail={processSummaryDetails(items)}>{t(`process.count.${category}`, { count: items.length })}</ProcessSummary>
          {items.map(mount)}
        </details>
      })}
    </details>
  </section>
}
export function ProgressiveChatNodeList({ order, nodeStore, waiting, ...seatProps }: ProgressiveProps) {
  const source = useMemo(() => observeProcessNodes(nodeStore, order), [nodeStore, order])
  const nodes = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  const entries = useMemo(() => processEntries(nodes), [nodes])
  const hosts = useRef(new Map<string, HTMLElement>())
  const expanded = useRef(new Set<string>())
  const activities = entries.flatMap(entry => 'activities' in entry ? entry.activities : [])
  for (const item of activities) if (!hosts.current.has(item.id)) hosts.current.set(item.id, document.createElement('div'))
  useLayoutEffect(() => {
    const ids = new Set(activities.map(item => item.id))
    for (const [id, host] of hosts.current) if (!ids.has(id)) { host.remove(); hosts.current.delete(id); expanded.current.delete(id) }
  })
  return <>
    {entries.map(entry => 'activities' in entry
      ? entry.kind === 'context'
        ? <ContextGroup key={entry.id} group={entry} hosts={hosts.current} t={seatProps.t} />
        : <ProcessGroup key={entry.id} group={entry} hosts={hosts.current} expanded={expanded.current} waiting={waiting} t={seatProps.t} historyIncomplete={seatProps.historyIncomplete} />
      : <ChatNodeSeat key={entry.id} {...seatProps} nodeKey={entry.key} processView={entry.view} compactTranscript={false} />)}
    {activities.map(item => createPortal(
      <div onKeyDownCapture={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const row = (event.target as HTMLElement).closest('[aria-expanded]')
        if (row) { if (row.getAttribute('aria-expanded') === 'false') expanded.current.add(item.id); else expanded.current.delete(item.id) }
      }} onClickCapture={event => {
        const row = (event.target as HTMLElement).closest('[aria-expanded]')
        if (row) { if (row.getAttribute('aria-expanded') === 'false') expanded.current.add(item.id); else expanded.current.delete(item.id) }
      }}>
        <ChatNodeSeat {...seatProps} nodeKey={item.key} processView={item.view} compactTranscript={false} />
      </div>, hosts.current.get(item.id)!, item.id))}
  </>
}
