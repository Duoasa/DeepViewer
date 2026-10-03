/** Reuse the native synthetic composer bench, changing only DeepViewer placement assertions. */
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', 'upstream/deepseek-harness')
const source = resolve(root, 'packages/client/ui-conversation/tests/input-bar.client.spec.tsx')
const fixture = resolve(root, 'packages/client/ui-conversation/tests/deepviewer-layout-smoke.client.spec.tsx')
let text = readFileSync(source, 'utf8')
function replace(before, after) {
  if (!text.includes(before)) throw new Error('Native composer smoke fixture changed')
  text = text.replace(before, after)
}
replace("it('places context usage below the composer and hides it until the activity closes'", "it('places DeepViewer context after model and before activity, retaining activity lifecycle'")
replace('contextWindow: 128_000 },\n    activityEntry:', 'contextWindow: 128_000 }, modelEntry: <button>deepviewer model choice</button>,\n    activityEntry:')
replace('expect(microphone.compareDocumentPosition(meter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()', "expect(view.getByRole('button', { name: 'deepviewer model choice' }).nextElementSibling?.contains(meter)).toBe(true)\n  expect(meter.compareDocumentPosition(microphone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()")
try {
  writeFileSync(fixture, text)
  execFileSync('pnpm', ['exec', 'vitest', 'run', fixture, '-t', 'places DeepViewer context'], { cwd: root, stdio: 'inherit' })
} finally { rmSync(fixture, { force: true }) }
