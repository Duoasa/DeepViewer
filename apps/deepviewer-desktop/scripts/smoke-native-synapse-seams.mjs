import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = resolve(root, 'upstream/deepseek-harness')
const conversation = resolve(upstream, 'packages/client/ui-conversation/tests/deepviewer-synapse-native.client.spec.tsx')
const chat = resolve(upstream, 'packages/client/ui-chat/tests/deepviewer-synapse-focus.client.spec.tsx')
try {
  writeFileSync(conversation, readFileSync(resolve(root, 'apps/deepviewer-adapter/tests/synapse-native.spec.tsx.txt')))
  // Reuse the upstream measurement/Session fixtures; run only DeepViewer's new
  // cases rather than duplicating or broadening the upstream test suite.
  writeFileSync(chat, readFileSync(resolve(upstream, 'packages/client/ui-chat/tests/chat-view.client.spec.tsx'), 'utf8') + '\n' + readFileSync(resolve(root, 'apps/deepviewer-adapter/tests/synapse-chat-focus.spec.tsx.txt'), 'utf8'))
  execFileSync('pnpm', ['exec', 'vitest', 'run', conversation, chat, '-t', 'DeepViewer map native'], { cwd: upstream, stdio: 'inherit' })
} finally { rmSync(conversation, { force: true }); rmSync(chat, { force: true }) }
