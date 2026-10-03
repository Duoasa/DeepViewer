/** Preserve upstream tests and run DeepViewer copies with approved presentation expectations. */
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = resolve(root, 'upstream/deepseek-harness')
const generated = []
function replace(source, before, after, count) {
  const actual = source.split(before).length - 1
  if (actual !== count) throw new Error(`DeepViewer expectation anchor changed (${actual}, expected ${count}): ${before}`)
  return source.replaceAll(before, after)
}
try {
  const skeletonSource = resolve(upstream, 'packages/client/ui-conversation/tests/skeleton.client.spec.tsx')
  const skeleton = resolve(dirname(skeletonSource), 'deepviewer-native-regression-skeleton.client.spec.tsx')
  let source = readFileSync(skeletonSource, 'utf8')
  // Approved DeepViewer hero copy; every chrome, composer and navigation assertion remains.
  source = replace(source, 'Into the Unknown', 'What shall we build?', 1)
  source = replace(source, '探索未至之境', '让我们做点什么', 3)
  writeFileSync(skeleton, source); generated.push(skeleton)
  const chatSource = resolve(upstream, 'packages/client/ui-chat/tests/chat-view.client.spec.tsx')
  const chat = resolve(dirname(chatSource), 'deepviewer-native-regression-chat.client.spec.tsx')
  source = readFileSync(chatSource, 'utf8')
  // Approved DeepViewer running/thinking names retain all clock, disclosure, focus and live-region assertions.
  const runningCount = source.split('深度求索中').length - 1
  if (runningCount < 1) throw new Error('Native running copy expectation missing')
  source = replace(source, 'name: /^思考/', 'name: /^深度求索中/', 2)
  // Approved removal of the decorative whale is tested as absence, while transcript-bottom ownership,
  // status/live text, absence of SVG animation and removal when idle are preserved.
  source = replace(source, `    const icon = status?.querySelector('svg')?.parentElement
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.firstElementChild?.tagName).toBe('SPAN')
    expect(icon?.querySelectorAll('path')).toHaveLength(1)
    expect(icon?.getAttribute('style')).toBeNull()`, `    expect(status?.querySelector('svg')).toBeNull()
    expect(status?.querySelector('path')).toBeNull()`, 1)
  writeFileSync(chat, source); generated.push(chat)
  // Unmodified upstream apply-wiring checks retain target-neutral roster introspection coverage.
  const wiring = resolve(upstream, 'packages/client/ui-conversation/tests/apply-wiring.client.spec.tsx')
  execFileSync(process.execPath, [resolve(upstream, 'node_modules/vitest/vitest.mjs'), 'run', chat, skeleton, wiring], { cwd: upstream, stdio: 'inherit' })
} finally { for (const file of generated) rmSync(file, { force: true }) }
