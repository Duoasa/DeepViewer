import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { afterAll, expect, it, vi } from 'vitest'
// @ts-expect-error The staging adapter is JavaScript.
import { adaptBetterSidebarUI } from '../scripts/adapt-better-sidebar-ui.mjs'
const root = mkdtempSync(join(tmpdir(), 'deepviewer-native-sidebar-'))
mkdirSync(join(root, 'lib'))
for (const name of ['client.js', 'client-editor.js']) {
  cpSync(new URL(`../../../node_modules/dsh-better-sidebar/lib/${name}`, import.meta.url), join(root, 'lib', name))
}
adaptBetterSidebarUI(root)
const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
const file = ts.createSourceFile('client.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
function functions(names: string[]) {
  const found = new Map<string, string>()
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.set(node.name.text, node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  expect(found.size).toBe(names.length)
  return [...found.values()].join('\n')
}
afterAll(() => rmSync(root, { recursive: true, force: true }))

it('projects old saved state without restoring any workbench layout', () => {
  const { makeDefaultState, sanitizeState } = runInNewContext(functions(['makeDefaultState', 'sanitizeState']) + '; ({makeDefaultState, sanitizeState})')
  const old = { nextTerminal: 4, nextBrowser: 2, expanded: ['/project'], bottomOpen: true, bottomHeight: 500, bottomSplits: { tabs: ['old-terminal'] } }
  const migrated = sanitizeState(old)
  expect(migrated).toEqual({ ...makeDefaultState(), nextTerminal: 4, nextBrowser: 2, expanded: ['/project'] })
  expect(old.bottomOpen).toBe(true) // Reading projects data; never destroys the saved legacy layout.
  expect(sanitizeState({ nextTerminal: -1, expanded: [1, '/safe'] })).toEqual({ ...makeDefaultState(), expanded: ['/safe'] })
})

it('routes terminal, browser and file requests exclusively through the native right surface', () => {
  const state = { nextTerminal: 1 }
  const reduce = vi.fn()
  const store = { getPrefs: () => ({ tabsEnabled: {}, viewersEnabled: {} }), getSnapshot: () => ({ sessionId: 'current', state }), reduce }
  const create = runInNewContext(functions(['createBetterSidebarService', 'safeCall']) + '; createBetterSidebarService', {
    SIDEBAR_SERVICE_VERSION: 'test', SIDEBAR_FEATURES: [], console,
  })
  const service = create(store)
  for (const id of ['terminal', 'browser', 'editor']) service.registerTab({ id, title: id })
  const surface = {
    openTab: vi.fn(), openResource: vi.fn(), fileAddress: vi.fn(() => 'dsh-resource://file/test'),
    close: vi.fn(() => ({ type: 'editor', title: 'file' })), update: vi.fn(), activate: vi.fn(),
  }
  service.setSurface(surface)
  service.openTab({ type: 'terminal', target: 'bottom' }) // Legacy callers cannot recreate the removed surface.
  service.openTab({ type: 'browser', url: 'https://example.com' }, { sessionId: 'other' })
  service.openTab({ type: 'editor', path: '/project/file.txt' })
  expect(surface.openTab).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'terminal', sessionId: 'current' }))
  expect(surface.openTab).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'browser', sessionId: 'other', params: expect.objectContaining({ url: 'https://example.com' }) }))
  expect(surface.openResource).toHaveBeenCalledWith(expect.objectContaining({ address: 'dsh-resource://file/test' }))
  service.updateTab('file', { title: 'renamed' }); service.activateTab('file'); service.closeTab('file')
  expect(surface.update).toHaveBeenCalledWith('file', { title: 'renamed' })
  expect(surface.activate).toHaveBeenCalledWith('file')
  expect(surface.close).toHaveBeenCalledWith('current', 'file')
  service.setSurface(undefined)
  service.openTab({ type: 'terminal', target: 'bottom' })
  expect(reduce).not.toHaveBeenCalled()
})

it('keeps rename and deletion tied to native file tabs', () => {
  const tabs = [{ id: 'a', path: '/project/a.txt' }, { id: 'b', path: '/other/b.txt' }]
  const service = { updateTab: vi.fn(), closeTab: vi.fn() }
  const { retargetPathTabs, closePathTabs } = runInNewContext(functions(['pathTabsOf', 'retargetPathTabs', 'closePathTabs']) + '; ({retargetPathTabs, closePathTabs})', {
    baseName: (path: string) => path.split('/').pop(),
    isWithinWorkspace: (root: string, path: string) => path.startsWith(root + '/'),
  })
  const ctx = { get: () => service }, store = { nativeTabs: () => tabs }
  retargetPathTabs(ctx, store, '/project/a.txt', '/project/new.txt')
  expect(service.updateTab).toHaveBeenCalledWith('a', { path: '/project/new.txt', title: 'new.txt' })
  closePathTabs(ctx, store, '/project')
  expect(service.closeTab).toHaveBeenCalledExactlyOnceWith('a')
})
