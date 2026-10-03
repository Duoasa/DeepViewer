// Compatibility command for callers of the former overlay pipeline.
// Product changes are now owned by apps/deepviewer-adapter; old 0.1.7 snapshots are never replayed.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { prepareUpstream, upstreamRoot } from '../../deepviewer-adapter/scripts/prepare-upstream.mjs'
export function ensureHarnessSource() { prepareUpstream(); return upstreamRoot }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 ensureHarnessSource()
 if (process.argv.includes('--build')) execFileSync(process.execPath, [fileURLToPath(new URL('./build-native-desktop.mjs', import.meta.url)), '--core-only'], { stdio: 'inherit' })
}
