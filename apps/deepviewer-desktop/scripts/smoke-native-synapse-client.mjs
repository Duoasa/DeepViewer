import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = resolve(root, 'upstream/deepseek-harness')
const fixture = resolve(upstream, 'packages/client/ui-conversation/tests/deepviewer-synapse.client.spec.tsx')
try {
  writeFileSync(fixture, readFileSync(resolve(root, 'apps/deepviewer-adapter/tests/synapse-client.spec.tsx.txt')))
  execFileSync('pnpm', ['exec','vitest','run',fixture], {cwd:upstream,stdio:'inherit'})
} finally { rmSync(fixture,{force:true}) }
