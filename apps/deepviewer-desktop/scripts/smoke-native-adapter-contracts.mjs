/** Run pinned adapter contract fixtures without a second package-manager install. */
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const upstream = resolve(dirname(fileURLToPath(import.meta.url)), '../../../upstream/deepseek-harness')
execFileSync(process.execPath, [join(upstream, 'node_modules/vitest/vitest.mjs'), 'run',
  'packages/api/session-controller/tests/deepviewer-session-reuse.host.spec.ts',
  'apps/desktop/tests/deepviewer-update-channel.spec.ts',
  'apps/desktop/tests/update-coordinator.spec.ts',
  'packages/client/connection/tests/deepviewer-rpc-owner.host.spec.ts',
  'packages/client/ui-tool/tests/deepviewer-file-protection-tone.client.spec.tsx',
  'packages/client/hmr/tests/deepviewer-client-artifact-metadata.client.spec.ts',
], { cwd: upstream, stdio: 'inherit' })
