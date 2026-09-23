// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { processEntries, processSummaryDetails, projectProcessNode } from '../src/client/chat/progressive-process.ts'
import { ProgressiveChatNodeList, observeProcessNodes } from '../src/client/chat/ProgressiveChatNodeList.tsx'
import type { ChatNode } from '../src/client/contract/chat-nodes.ts'
import type { ChatNodeStore } from '../src/client/contract/snapshot.ts'
import type { ComponentProps } from 'react'

vi.mock('../src/client/chat/ChatNodeSeat.tsx', () => ({ ChatNodeSeat: ({ nodeKey }: { nodeKey: string }) => {
  const [open, setOpen] = useState(false)
  return <div><button data-disclosure-row aria-expanded={open} onClick={() => setOpen(!open)}>{nodeKey}</button>{open && <span>detail:{nodeKey}</span>}</div>
} }))
afterEach(cleanup)
function tool(key: string, name = 'bash', settled = false, error = false, argsRaw = ''): ChatNode {
  return { key, kind: 'tool-call', target: 'chat', anchorSeq: 1, visibility: 'visible', location: { kind: 'turn', turn: { turn: 1 } }, data: { root: settled
    ? { kind: 'tool-result', call: { name, argsRaw }, isError: error, subCalls: [] }
    : { name, argsRaw, subCalls: [] } } } as unknown as ChatNode
}
function context(key: string, turn = 1, role = 'instruction'): ChatNode {
  return { key, kind: 'context', target: 'chat', anchorSeq: 1, visibility: 'visible', location: { kind: 'turn', turn: { turn } },
    data: { content: key, provenance: { role, label: key }, source: 'fixture', form: null } } as unknown as ChatNode
}
function model(initial: ChatNode[]) {
  let nodes = initial
  const listeners = new Set<() => void>()
  const store = { get: (key: string) => nodes.find(node => node.key === key), source: (key: string) => ({ getSnapshot: () => store.get(key), subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } } }) } as ChatNodeStore
  return { store, set(next: ChatNode[]) { nodes = next; act(() => listeners.forEach(fn => fn())) } }
}
const props = { compactTranscript: true, historyIncomplete: false, waiting: false, t: (key: string, values?: { count: number }) => `${key}${values ? ':' + values.count : ''}` } as unknown as Omit<ComponentProps<typeof ProgressiveChatNodeList>, 'order' | 'nodeStore'>
describe('progressive process', () => {
  it('previews recorded subjects, deduplicates them, and bounds long directory summaries', () => {
    const entries = processEntries([
      tool('s1', 'web_search', true, false, JSON.stringify({ queries: ['DSH plugins', 'Electron themes'] })),
      tool('s2', 'web_search', true, false, JSON.stringify({ queries: ['DSH plugins', 'Electron themes'] })),
      tool('r1', 'read', true, false, JSON.stringify({ path: '/workspace/src/main.ts' })),
      tool('r2', 'read', true, false, JSON.stringify({ path: '/workspace/src/theme.ts' })),
      tool('r3', 'web_fetch', true, false, JSON.stringify({ url: 'https://example.com/docs?token=secret' })),
    ])
    const group = entries[0]!
    if (!('activities' in group)) throw new Error('expected process group')
    expect(group.activities.at(-1)?.summary).toBe('example.com/docs')
    expect(processSummaryDetails(group.activities)).toBe('DSH plugins / Electron themes · src/main.ts · src/theme.ts …')
  })
  it('uses declared command descriptions and latest reasoning without inventing malformed tool details', () => {
    const reasoning = (key: string, text: string) => ({ ...tool(key), kind: 'assistant-step', data: { status: 'settled', blocks: [{ kind: 'reasoning', text }] } }) as unknown as ChatNode
    const entries = processEntries([
      reasoning('old', 'Inspect the dependencies.'), reasoning('new', '\nVerify the build.\nMore details.'),
      tool('cmd', 'bash', true, false, JSON.stringify({ description: 'Check repository status', command: 'git status --short' })),
      tool('partial', 'audio_generate', false, false, '{"prompt":'),
      tool('custom', 'custom_tool', true, false, JSON.stringify({ token: 'hidden-value' })),
    ])
    const group = entries[0]!
    if (!('activities' in group)) throw new Error('expected process group')
    expect(processSummaryDetails(group.activities.filter(item => item.category === 'reasoning'))).toBe('Verify the build. · Inspect the dependencies.')
    expect(group.activities.slice(2).map(item => item.summary)).toEqual(['Check repository status', 'audio_generate', 'custom_tool'])
  })
  it('shows category counts at the top and concrete subjects on category headers', () => {
    const m = model([tool('read', 'read', true, false, '{"path":"/workspace/src/main.ts"}'), tool('cmd', 'bash', true, false, '{"command":"pnpm build"}')])
    render(<ProgressiveChatNodeList {...props} order={['read', 'cmd']} nodeStore={m.store} />)
    const top = screen.getByText('process.completed:2').closest('summary')!
    expect(top.textContent).toContain('process.count.read:1 · process.count.command:1')
    const commands = screen.getByText('process.count.command:1').closest('summary')!
    expect(commands.textContent).toContain('pnpm build')
    expect(screen.getByText('process.count.read:1').closest('summary')?.textContent).toContain('src/main.ts')
  })
  it('merges adjacent context injections without counting them as completed operations', () => {
    const entries = processEntries([context('prompt'), context('skills'), tool('shell', 'bash', true)])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ kind: 'context', activities: [{ key: 'prompt' }, { key: 'skills' }] })
    expect(entries[1]).toMatchObject({ kind: 'process', activities: [{ key: 'shell', category: 'command' }] })
  })
  it('keeps context groups on their own side of narration, turn, and recall boundaries', () => {
    const prose = { ...tool('narration'), kind: 'assistant-step', data: { status: 'settled', blocks: [{ kind: 'text', text: 'answer' }] } } as unknown as ChatNode
    const entries = processEntries([context('one'), prose, context('two'), context('three', 2), context('recall', 2, 'recall'), context('four', 2)])
    expect(entries.map(entry => 'activities' in entry ? entry.activities.map(item => item.key) : entry.key))
      .toEqual([['one'], 'narration', ['two'], ['three'], 'recall', ['four']])
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length)
  })
  it('preserves open context details when another injection arrives', () => {
    const m = model([context('prompt')])
    const view = render(<ProgressiveChatNodeList {...props} order={['prompt']} nodeStore={m.store} />)
    const directory = screen.getByText('process.context · 1').closest('details')!
    expect(directory.open).toBe(false)
    directory.open = true
    const button = screen.getByRole('button', { name: 'prompt' }); fireEvent.click(button)
    m.set([context('prompt'), context('skills')])
    view.rerender(<ProgressiveChatNodeList {...props} order={['prompt', 'skills']} nodeStore={m.store} />)
    expect(directory.open).toBe(true)
    expect(screen.getByRole('button', { name: 'prompt' })).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'skills' })).toBeTruthy()
    expect(directory.querySelector('summary')?.textContent).toBe('process.context · 2 · prompt · skills')
  })
  it('observes a lifecycle-only update with unchanged key order and stable snapshots', () => {
    const m = model([tool('a')]); const observer = observeProcessNodes(m.store, ['a'])
    expect(observer.getSnapshot()).toBe(observer.getSnapshot())
    const before = observer.getSnapshot(); const fn = vi.fn(); const stop = observer.subscribe(fn)
    m.set([tool('a', 'bash', true)]); expect(fn).toHaveBeenCalledOnce(); expect(observer.getSnapshot()).not.toBe(before); stop()
  })
  it('preserves mounted tool details and reveals the completed category after transition', () => {
    const m = model([tool('a')]); render(<ProgressiveChatNodeList {...props} order={['a']} nodeStore={m.store} />)
    const button = screen.getByRole('button', { name: 'a' }); fireEvent.click(button)
    m.set([tool('a', 'bash', true)])
    expect(screen.getByRole('button', { name: 'a' })).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.closest('details')?.open).toBe(true)
    expect(button.closest('details')?.parentElement?.closest('details')?.open).toBe(true)
    expect(screen.getByText('process.completed:1')).toBeTruthy()
  })
  it('shows real parallel count, preserves manual category expansion on incoming updates, and pauses shimmer', () => {
    const m = model([tool('a'), tool('b'), tool('c', 'read', true)])
    const order = ['a', 'b', 'c']; const view = render(<ProgressiveChatNodeList {...props} order={order} nodeStore={m.store} />)
    expect(screen.getByText('process.parallel:2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'b' }).closest('[data-live]')?.getAttribute('data-live')).toBe('true')
    const summary = screen.getByText('process.completed:1'); const history = summary.closest('details') as HTMLDetailsElement; history.open = true
    m.set([tool('a'), tool('b'), tool('c', 'read', true)])
    expect(history.open).toBe(true)
    view.rerender(<ProgressiveChatNodeList {...props} waiting order={order} nodeStore={m.store} />)
    expect(screen.getByRole('button', { name: 'b' }).closest('[data-live]')?.getAttribute('data-live')).toBe('false')
  })
  it('keeps errors and waiting questions outside collapsed history', () => {
    const m = model([tool('failed', 'bash', true, true), tool('question', 'ask_user_question')])
    render(<ProgressiveChatNodeList {...props} order={['failed', 'question']} nodeStore={m.store} />)
    for (const name of ['failed', 'question']) expect(screen.getByRole('button', { name }).closest('details')).toBeNull()
    expect(document.querySelector('[data-process-current]')).toBeNull()
  })
  it('splits reasoning from assistant prose without dropping output or interrupt status', () => {
    const node = { ...tool('text'), kind: 'assistant-step', data: { status: 'running', blocks: [{ kind: 'reasoning', text: 'think' }, { kind: 'text', text: 'answer' }] } } as unknown as ChatNode
    const reasoning = projectProcessNode(node, 'reasoning') as ChatNode<'assistant-step'>
    const prose = projectProcessNode(node, 'prose') as ChatNode<'assistant-step'>
    expect(reasoning.data.status).toBe('settled'); expect(reasoning.data.blocks).toHaveLength(1)
    expect(prose.data.blocks).toEqual([{ kind: 'text', text: 'answer' }]); expect(prose.key).toBe('text')
    expect(processEntries([node])).toHaveLength(2)
  })
  it('classifies by actual tool identity and keeps unknown events visible', () => {
    const unknown = { ...tool('unknown'), kind: 'unknown-surface' } as unknown as ChatNode
    const entries = processEntries([tool('search', 'web_search', true), tool('shell', 'bash', true), unknown])
    expect(entries[0]).toMatchObject({ activities: [{ category: 'read' }, { category: 'command' }] })
    expect(entries[1]).toMatchObject({ key: 'unknown' })
  })
  it('resets disclosure state at the session boundary', () => {
    const m = model([tool('a')]); const view = render(<ProgressiveChatNodeList key="one" {...props} order={['a']} nodeStore={m.store} />)
    fireEvent.click(screen.getByRole('button', { name: 'a' }))
    view.rerender(<ProgressiveChatNodeList key="two" {...props} order={['a']} nodeStore={m.store} />)
    expect(screen.getByRole('button', { name: 'a' }).getAttribute('aria-expanded')).toBe('false')
  })
})
