import { Fragment, useSyncExternalStore } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, RunningToolCall, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { DetailsSlotProps, ToolDetailsViewProps } from '../contract/slots.ts'
import { findToolCall } from '../chat/tool-node-reader.ts'
import css from './DetailsPanel.module.css'

export type DetailsPanelProps = DetailsSlotProps

interface CallMaterial {
  name: string
  argsRaw: string | null
  block: ToolCallBlock
}

function settledMaterial(node: ToolResultNode, callId: string): CallMaterial {
  return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node }
}

function runningMaterial(call: RunningToolCall): CallMaterial {
  return { name: call.name, argsRaw: call.argsRaw, block: call }
}

function materialFor(s: ConversationSnapshot, callId: string): CallMaterial | null {
  const found = findToolCall(s, callId)
  if (found === undefined) return null
  return 'kind' in found ? settledMaterial(found, callId) : runningMaterial(found)
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function rawResultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item, null, 2))
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n')
}

/** Stable shell for every right-column details entry. */
export function DetailsPanel(props: DetailsPanelProps) {
  const { activeView = 'tool', renderSlot, selectDetailsView, views, t } = props
  const registry = views ?? {
    list: () => [{ id: 'tool', label: t('details.title') }],
    subscribe: () => () => {},
    version: () => 0,
  }
  useSyncExternalStore(registry.subscribe, registry.version)
  const tabs = registry.list()
  const active = tabs.find(tab => tab.id === activeView) ?? tabs[0]

  // Pinned-core tests and downstreams may still mount DetailsPanel directly with the
  // former single-view props. Keep that source-compatible path while the real
  // registered shell always receives the additive registry.
  if (views === undefined) {
    return (
      <div className={css.root}>
        <div className={css.header} data-deepviewer-details-header>
          <div className={css.title}>{t('details.title')}</div>
        </div>
        <div className={css.body}>
          <ToolDetailsView {...props as unknown as ToolDetailsViewProps} />
        </div>
      </div>
    )
  }

  return (
    <div className={css.root}>
      <div className={css.header} data-deepviewer-details-header>
        <div className={css.tabs} role="tablist" aria-label={t('details.title')}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active?.id}
              className={tab.id === active?.id ? `${css.tab} ${css.tabActive}` : css.tab}
              onClick={() => { selectDetailsView?.(tab.id) }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={css.body}>
        {active === undefined
          ? <div className={css.emptyShell}>{t('details.empty')}</div>
          : renderSlot('conversation.details.view', {}, { only: active.id })}
      </div>
    </div>
  )
}

/** The preserved pinned-core tool-call details body, now one additive details view. */
export function ToolDetailsView({ useSession, useSessions, sessionId, useStore, renderSlot, t }: ToolDetailsViewProps) {
  const selection = useStore(s => s.selection)
  const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd)
  const callId = selection?.callId
  const material = useSession(
    s => (callId === undefined ? null : materialFor(s, callId)),
    (a, b) => shallowEqual(a, b),
  )

  return (
    <div className={css.toolBody}>
      {selection === null || callId === undefined
        ? <div className={css.empty}>{t('details.empty')}</div>
        : material === null
          ? <div className={css.empty}>{t('details.notInWindow')}</div>
          : (
            <>
              <div className={css.toolName}>{material.name}</div>
              {material.argsRaw !== null && (
                <section className={css.section}>
                  <div className={css.sectionLabel}>{t('details.input')}</div>
                  <CodeBlock code={pretty(material.argsRaw)} lang="json" copyLabel={t('copy')} copiedLabel={t('copied')} />
                </section>
              )}
              <section className={css.section}>
                <div className={css.sectionLabel}>{t('details.output')}</div>
                <Fragment key={callId}>
                  {renderSlot('conversation.details.tool', { block: material.block, cwd: sessionCwd }, {
                    fallback: 'kind' in material.block
                      ? <pre className={css.code} data-error={material.block.isError || undefined}>{rawResultText(material.block)}</pre>
                      : <div className={css.empty}>{t('details.running')}</div>,
                  })}
                </Fragment>
              </section>
            </>
          )}
    </div>
  )
}
