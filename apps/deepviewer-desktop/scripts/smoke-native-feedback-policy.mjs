/** Synthetic profile only: DeepViewer feedback policy survives legacy overrides. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readProfilePatches, composeEntries } from '../../../upstream/deepseek-harness/packages/boot/app-boot/lib/index.js'
const home = mkdtempSync(join(tmpdir(), 'deepviewer-feedback-policy-'))
const ids = ['ui-message-feedback', 'message-feedback', 'command-feedback', 'session-log-deepseek', 'session-telemetry-otel']
try {
  const rows = [...ids, 'session-log-export', 'llm'].map(id => ({ id, name: `fixture-${id}` }))
  const context = { home, overlays: ids.map(id => ({ id, disabled: false })), telemetryDisabledEnv: undefined }
  const profile = { layers: [{ patches: [{ insert: rows }] }], patches: ids.map(id => ({ id, disabled: false })) }
  const resolved = composeEntries([readProfilePatches('DeepViewer smoke', context, profile)])
  for (const id of ids) assert.equal(resolved.find(row => row.id === id)?.disabled, true, id)
  for (const id of ['session-log-export', 'llm']) assert.notEqual(resolved.find(row => row.id === id)?.disabled, true, id)
  console.info(JSON.stringify({ result: 'PASS', feedbackDisabled: ids, legacyOverridesBlocked: true, exportAndInferencePreserved: true }))
} finally { rmSync(home, { recursive: true, force: true }) }
