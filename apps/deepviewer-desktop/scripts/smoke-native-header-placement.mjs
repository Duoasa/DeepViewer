/** Native synthetic session bench checks DeepViewer navigation-row ownership. */
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', 'upstream/deepseek-harness')
const source = resolve(root, 'packages/client/ui-conversation/tests/skeleton.client.spec.tsx')
const fixture = resolve(root, 'packages/client/ui-conversation/tests/deepviewer-header-smoke.client.spec.tsx')
const tests = `
it('DeepViewer statistics share the view navigation row outside the tablist', () => {
  const b = mount(sessionSnapshotOf())
  const tabs = b.view.getByRole('tablist')
  const stats = b.view.container.querySelector('[data-deepviewer-session-statistics]')
  expect(stats).not.toBeNull()
  expect(stats?.parentElement).toBe(tabs.parentElement)
  expect(tabs.contains(stats)).toBe(false)
  expect(stats?.parentElement?.hasAttribute('data-deepviewer-navigation-row')).toBe(true)
  fireEvent.click(b.view.getByRole('tab', {name: 'Trajectory'}))
  expect(b.view.getByRole('tab', {name: 'Trajectory'}).getAttribute('aria-selected')).toBe('true')
})
it('DeepViewer statistics survive a single view without fabricating tabs', () => {
  const b = mount(sessionSnapshotOf(), undefined, undefined, {viewTabs: [{id:'chat', label:'Chat'}]})
  expect(b.view.queryByRole('tablist')).toBeNull()
  expect(b.view.container.querySelector('[data-deepviewer-session-statistics]')).not.toBeNull()
})
it('DeepViewer statistics do not occupy the blank welcome header', () => {
  const b = mount(sessionSnapshotOf({blank:true}))
  expect(b.view.container.querySelector('[data-deepviewer-navigation-row]')).toBeNull()
})
`
try {
  writeFileSync(fixture, readFileSync(source, 'utf8') + tests)
  execFileSync('pnpm', ['exec', 'vitest', 'run', fixture, '-t', 'DeepViewer statistics'], { cwd: root, stdio: 'inherit' })
} finally { rmSync(fixture, { force: true }) }
