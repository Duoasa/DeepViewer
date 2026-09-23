import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Script } from 'node:vm'
import { afterEach, expect, it } from 'vitest'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))

it('adapts pinned settings and preview policy reproducibly, and rejects bundle drift', async () => {
  // @ts-expect-error The build adapter is JavaScript, outside the app compilation.
  const { adaptBetterSidebarUI } = await import('../scripts/adapt-better-sidebar-ui.mjs')
  const root = mkdtempSync(join(tmpdir(), 'sidebar-management-'))
  roots.push(root)
  cpSync(resolve('../../node_modules/dsh-better-sidebar/lib'), join(root, 'lib'), { recursive: true })
  adaptBetterSidebarUI(root)
  const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
  const editor = readFileSync(join(root, 'lib/client-editor.js'), 'utf8')
  expect(() => new Script(client)).not.toThrow()
  expect(() => new Script(editor)).not.toThrow()
  expect(client).toContain('settingsNav: "侧栏管理"')
  expect(client).not.toContain('className: SideCardSection_module_css_default.versionBadge,')
  expect(client).not.toContain('value: titleBarSchemeValue(prefs)')
  expect(client).toContain('const scheme = "web";')
  expect(client).not.toContain('id: "sidechat",')
  const recordsStart = client.indexOf('function createNativeTabRecords() {')
  const recordsEnd = client.indexOf('function useRecordVersion(', recordsStart)
  const pathFunctions = ['isAbsolutePath$1', 'resolveSidebarPath'].map(name => {
    const start = client.indexOf(`function ${name}(`)
    return client.slice(start, client.indexOf('\n\t\t}', start) + 5)
  }).join('\n')
  const records = new Script(pathFunctions + '\n' + client.slice(recordsStart, recordsEnd) + '\ncreateNativeTabRecords()').runInNewContext()
  const scope = { sessionId: 'test-session', cwd: '/workspace' }
  const firstUrl = 'https://example.test/search?q=hello#results'
  const first = records.ensure({ id: 'browser-1', kind: 'browser', title: 'example.test', params: { url: firstUrl }, scope })
  expect(first.tab.path).toBe(firstUrl)
  const second = records.ensure({ id: 'browser-2', kind: 'browser', title: 'Other', params: { url: 'https://other.test/' }, scope })
  expect(second.tab.path).toBe('https://other.test/')
  const changed = records.ensure({ id: 'browser-1', kind: 'browser', title: 'example.test', params: { url: 'https://example.test/next' }, scope })
  expect(changed.tab.path).toBe('https://example.test/next')
  expect(records.get('browser-2').tab.path).toBe('https://other.test/')
  const file = records.ensure({ id: 'editor-1', kind: 'editor', title: 'file', params: { path: '/workspace/a.html', url: firstUrl }, scope })
  expect(file.tab.path).toBe('/workspace/a.html')
  for (const path of ['speeding_car.png', '图片/跑车 #1%.png', '../outside.png', '/other/image.png']) {
    const relative = records.ensure({ id: `file:${path}`, kind: 'editor', title: 'image', params: { path }, scope })
    expect(relative.tab.path).toBe(path.startsWith('/') ? path : `/workspace/${path}`)
  }
  const pending = { id: 'restored-image', kind: 'editor', title: 'image', params: { path: 'image.png' }, scope: { sessionId: 'test-session' } }
  expect(records.ensure(pending).tab.path).toBe('image.png')
  expect(records.ensure({ ...pending, scope }).tab.path).toBe('/workspace/image.png')
  expect(records.ensure({ ...pending, scope: { ...scope, cwd: '/workspace-two/' } }).tab.path).toBe('/workspace-two/image.png')
  expect(records.ensure({ id: 'empty', kind: 'files', params: { path: '' }, scope }).tab.path).toBe('')
  expect(records.ensure({ id: 'explorer', kind: 'files', scope }).tab.path).toBeUndefined()
  expect(records.ensure({ id: 'folder', kind: 'files', params: { path: 'images' }, scope }).tab.path).toBe('/workspace/images')
  expect(records.ensure({ id: 'root', kind: 'editor', params: { path: 'image.png' }, scope: { ...scope, cwd: '/' } }).tab.path).toBe('/image.png')
  expect(client).toContain('const noSandbox = true;')
  expect(editor).toContain('const htmlNoSandbox = true;')
  for (const key of ['browserNoSandbox', 'browserAllowedLoopback', 'htmlViewerNoSandbox', 'htmlViewerDefaultUnsafe']) {
    expect(client).not.toContain(`key: "${key}"`)
  }
  const surfaceStart = client.indexOf('function createNativeSurface(ctx, records) {')
  const surfaceEnd = client.indexOf('//#endregion', surfaceStart)
  const opened: string[] = []
  const context = { get: () => ({ openResource: (address: string) => opened.push(address) }), sessions: { list: { subscribe: () => () => {} } } }
  const surface = new Script(client.slice(surfaceStart, surfaceEnd) + '\ncreateNativeSurface(ctx, {})').runInNewContext({
    ctx: context, activeSessionId: () => 'session-one', crypto: { randomUUID: (() => { let id = 0; return () => String(++id) })() },
  })
  for (const url of ['https://first.test/', 'https://second.test/']) surface.openTab({ sessionId: 'session-one', kind: 'browser', params: { url } })
  expect(opened).toHaveLength(2)
  expect(opened[0]).not.toBe(opened[1])
  expect(new URL(opened[1]!).searchParams.get('url')).toBe('https://second.test/')
  adaptBetterSidebarUI(root)
  expect(readFileSync(join(root, 'lib/client.js'), 'utf8')).toBe(client)
  const original = readFileSync(resolve('../../node_modules/dsh-better-sidebar/lib/client.js'), 'utf8')
  writeFileSync(join(root, 'lib/client.js'), original.replace('const noSandbox =', 'const changedSandbox ='))
  expect(() => adaptBetterSidebarUI(root)).toThrow(/anchor mismatch/)
})
