import type { ChatNode } from '../contract/chat-nodes.ts'
import { isSettledTool } from '../contract/chat-nodes.ts'
import type { ToolCallBlock } from '../contract/snapshot.ts'

export type ProcessView = 'prose' | 'reasoning'
export type Category = 'context' | 'reasoning' | 'read' | 'command' | 'write' | 'agent' | 'other'
export type Activity = { id: string; key: string; toolName?: string; summary?: string | undefined; view?: ProcessView; category: Category; state: 'running' | 'done' | 'attention' }
export type Group = { id: string; kind: 'context' | 'process'; activities: Activity[] }
export type Entry = { id: string; key: string; view?: ProcessView } | Group
export function projectProcessNode(node: ChatNode | undefined, view?: ProcessView): ChatNode | undefined {
  if (!node || node.kind !== 'assistant-step' || !view) return node
  const reasoning = view === 'reasoning'
  const blocks = node.data.blocks.filter(block => reasoning ? block.kind === 'reasoning' : block.kind !== 'reasoning')
  return { ...node, key: reasoning && node.data.blocks.some(block => block.kind !== 'reasoning' && block.kind !== 'tool-call') ? `${node.key}:reasoning` : node.key, data: { ...node.data, blocks,
    status: reasoning && node.data.status === 'running' && node.data.blocks.at(-1)?.kind !== 'reasoning' ? 'settled' : node.data.status } }
}
function toolAttention(root: ToolCallBlock): boolean {
  return (isSettledTool(root) && root.isError) || root.subCalls.some(toolAttention)
}
function category(name: string): Category {
  if (['read', 'read_image', 'web_fetch', 'web_search', 'grep', 'glob', 'cordis_package_inspect', 'cordis_runtime_inspect'].includes(name)) return 'read'
  if (['bash', 'pwsh', 'run_code'].includes(name)) return 'command'
  if (['write', 'edit'].includes(name)) return 'write'
  if (name === 'subagent' || name.startsWith('subagent_')) return 'agent'
  return 'other'
}
function excerpt(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const line = value.split(/\r?\n/).map(part => part.trim()).find(Boolean)
  if (!line) return undefined
  const characters = Array.from(line.replace(/\s+/g, ' '))
  return characters.length > 100 ? characters.slice(0, 100).join('') + '…' : characters.join('')
}
/** Use declared inputs only; never infer a command's purpose or summarize raw outputs. */
function toolSummary(root: ToolCallBlock, name: string): string | undefined {
  const raw = isSettledTool(root) ? root.call?.argsRaw : root.argsRaw
  let args: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw ?? '')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return name || undefined
    args = parsed as Record<string, unknown>
  } catch { return name || undefined }
  if (name === 'web_search' && Array.isArray(args.queries)) {
    const queries = args.queries.map(excerpt).filter((value): value is string => !!value)
    if (queries.length) return queries.slice(0, 2).join(' / ')
  }
  const keys = category(name) === 'command' ? ['description', 'command']
    : category(name) === 'read' ? ['query', 'pattern', 'path', 'file_path', 'url']
      : category(name) === 'write' ? ['path', 'file_path']
        : ['description', 'title', 'prompt', 'task']
  for (const key of keys) {
    const value = args[key]
    if (typeof value !== 'string' || !value.trim()) continue
    if (key === 'path' || key === 'file_path') return excerpt(value.split(/[\\/]/).filter(Boolean).slice(-2).join('/'))
    if (key === 'url') {
      try { const url = new URL(value); return excerpt(url.host + url.pathname) } catch { return excerpt(value) }
    }
    return excerpt(value)
  }
  return name || undefined
}
/** A small, deterministic preview; the complete records stay in the disclosure. */
export function processSummaryDetails(activities: readonly Activity[]): string {
  const ordered = activities[0]?.category === 'reasoning' ? [...activities].reverse() : activities
  const summaries = [...new Set(ordered.map(item => item.summary).filter((value): value is string => !!value))]
  return summaries.slice(0, 3).join(' · ') + (summaries.length > 3 ? ' …' : '')
}
/** Only known process rows collapse; prose, errors and unknown contributions stay in flow. */
export function processEntries(nodes: readonly (ChatNode | undefined)[]): Entry[] {
  const result: Entry[] = []
  let group: Group | undefined
  let boundary = 'start'
  for (const node of nodes) {
    if (!node || node.visibility === 'hidden' || node.kind === 'turn-process') continue
    const location = node.location
    const turn = location.kind === 'turn' || location.kind === 'step' ? location.turn.turn : 'unscoped'
    if (node.kind === 'user' || node.kind === 'steering') boundary = node.key
    // Context is its own adjacent disclosure, not an executed operation. A new
    // turn, narration, or other record ends the group without moving history.
    if (node.kind === 'context' && node.data.provenance.role !== 'recall') {
      const contextId = `context:${turn}:${boundary}`
      if (group?.kind !== 'context' || group.id !== contextId) {
        group = { id: contextId, kind: 'context', activities: [] }
        result.push(group)
      }
      group.activities.push({ id: node.key, key: node.key, category: 'context', summary: excerpt(node.data.provenance.label), state: 'done' })
      continue
    }
    if (group?.kind === 'context') {
      boundary = group.activities.at(-1)!.key
      group = undefined
    }
    const groupId = `process:${turn}:${boundary}`
    let activity: Activity | undefined
    if (node.kind === 'tool-call') {
      const root = node.data.root
      const name = isSettledTool(root) ? root.call?.name ?? '' : root.name
      activity = { id: node.key, key: node.key, toolName: name, summary: toolSummary(root, name), category: category(name), state: toolAttention(root) || (!isSettledTool(root) && name === 'ask_user_question') ? 'attention' : isSettledTool(root) ? 'done' : 'running' }
    } else if (node.kind === 'assistant-step' && node.data.blocks.some(block => block.kind === 'reasoning')) {
      const projected = projectProcessNode(node, 'reasoning') as ChatNode<'assistant-step'>
      const text = node.data.blocks.find(block => block.kind === 'reasoning')
      activity = { id: `${node.key}:reasoning`, key: node.key, view: 'reasoning', category: 'reasoning', summary: text?.kind === 'reasoning' ? excerpt(text.text) : undefined, state: projected.data.status === 'interrupted' ? 'attention' : projected.data.status === 'running' ? 'running' : 'done' }
    }
    if (activity) {
      if (group?.id !== groupId) { group = { id: groupId, kind: 'process', activities: [] }; result.push(group) }
      group.activities.push(activity)
    }
    if (!activity || (node.kind === 'assistant-step' && node.data.blocks.some(block => block.kind !== 'reasoning' && block.kind !== 'tool-call'))) {
      result.push({ id: node.key, key: node.key, ...(activity ? { view: 'prose' as const } : {}) })
      // Preserve narration order: subsequent work follows the message that announced it.
      boundary = node.key
    }
  }
  return result
}
