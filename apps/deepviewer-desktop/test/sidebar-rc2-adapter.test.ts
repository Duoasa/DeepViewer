import { cpSync, mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
// @ts-expect-error Build adapter is JavaScript.
import { adaptBetterSidebarUI } from '../scripts/adapt-better-sidebar-ui.mjs'

it('adapts the pinned client bundle to RC2 selection, subagent projections and navigation', () => {
  const root = mkdtempSync(join(tmpdir(), 'deepviewer-sidebar-rc2-'))
  try {
    mkdirSync(join(root, 'lib'))
    for (const file of ['client.js', 'client-editor.js']) {
      cpSync(new URL(`../../../node_modules/dsh-better-sidebar/lib/${file}`, import.meta.url), join(root, 'lib', file))
    }
    adaptBetterSidebarUI(root)
    const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
    const helpers = source.slice(source.indexOf('function deepviewerMainSession'), source.indexOf('// deepviewer-rc2-session-helpers-end'))
    // Execute exactly the helpers shipped in the adapted bundle, without a browser or UI interaction.
    const { main, catalogs } = runInNewContext(`${helpers}; ({ main: deepviewerMainSession, catalogs: deepviewerSubagentCatalogs })`)
    const snapshot = {
      byId: {
        parent: { id: 'parent', retainedBy: { sideView: 1 }, running: false },
        child: { id: 'child', retainedBy: { mainView: 1 }, running: true },
      },
      projectionsBySession: {
        parent: { state: 'idle', values: { subagentCatalog: [{ id: 'child', kind: 'child', mode: 'fork' }] } },
        pending: { state: 'idle', values: {} },
        failed: { state: 'error', error: { message: 'unavailable' }, values: {} },
      },
    }
    expect(main(snapshot)).toBe('child')
    expect(catalogs(snapshot)).toMatchObject({
      parent: { state: 'ready', entries: [{ id: 'child', mode: 'fork', activity: 'running' }] },
      pending: { state: 'loading', entries: [] },
      failed: { state: 'error', error: { message: 'unavailable' } },
    })
    snapshot.byId.child.retainedBy.mainView = 0
    expect(main(snapshot)).toBeUndefined()
    expect(source).not.toMatch(/getSnapshot\(\)\.current|sessionList\.current|subagentsByParent|setSubagentCatalogOpen|refreshSubagents|sessions\.openSubagent/)
    expect(source).toContain('ctx.get("uiWorkspace").openSession(address)')
    expect(source).toContain('ctx.get("uiWorkspace").openSession(rootId)')
    expect(source).toContain('sessions.refreshProjections(parentSessionId)')
    expect(source.match(/bottomSplits|bottomOpen|bottomHeight|bottomPanelAutoTerminal|BottomDockToggle|registerBottomToggle|data-dsh-bottom|data-dsh-panel-host|--dsh-sidebar-height/g)).toBeNull()
    expect(source).not.toMatch(/function (?:Sidebar|Workbench|useCenterColumn|setBottomHeight|toggleBottomPanel)\(/)
    // Execute the actual adapted native registration against a small registry:
    // builtin Browser's flags are not inherited by an extension takeover.
    const start = source.indexOf('function registerNativeSurface(')
    const end = source.indexOf('\n\t\t//#endregion', start)
    const definitions: Array<{ kind: string; multiple: boolean; keepMounted: boolean }> = []
    const register = runInNewContext(`(${source.slice(start, end)})`, {
      EDITOR_KIND: 'editor', FILES_KIND: 'files',
      nativeId: (id: string) => `dsh-better-sidebar:${id}`,
      titleOf: (descriptor: { id: string }) => descriptor.id,
      guideDescriptionOf: () => ({}), guideIconOf: () => ({}),
      NativeTabBody: () => null, NativeTabTitle: () => null,
    })
    const ctx = {
      get: () => ({ register: (definition: typeof definitions[number]) => {
        definitions.push(definition)
        return () => {}
      } }),
      inject: (_keys: string[], install: (ctx: object) => () => void) => ({ dispose: install(ctx) }),
      slots: { inject: () => () => {} },
    }
    const dispose = register({ ctx, records: {}, store: { subscribe: () => () => {} }, service: {
      subscribe: () => () => {},
      getTabs: () => [{ id: 'browser' }, { id: 'terminal' }],
      isTabEnabled: (id: string) => id !== 'editor',
    } })
    expect(definitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'browser', multiple: true, keepMounted: true }),
      expect.objectContaining({ kind: 'terminal', keepMounted: true }),
    ]))
    dispose()
    adaptBetterSidebarUI(root)
    expect(readFileSync(join(root, 'lib/client.js'), 'utf8')).toBe(source)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
