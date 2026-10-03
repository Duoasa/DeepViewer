import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModelCapabilitiesPlugin } from './build-model-capabilities-plugin.mjs'
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = join(project, 'upstream/deepseek-harness')
const plugin = buildModelCapabilitiesPlugin(upstream)
const result = spawnSync(process.execPath, [join(project, 'apps/dsh-plugin-model-capabilities/scripts/smoke-host.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, DSH_ROOT: upstream, MODEL_CAPABILITIES_PLUGIN_ROOT: plugin, SMOKE_LEGACY_SCANS: '1',
    SMOKE_NATIVE_MODULES: '1', SMOKE_CLI_ROOT: join(project,'apps/deepviewer-desktop/.desktop/native-cli'),
    SMOKE_EXTRA_PLUGIN_ROOTS: JSON.stringify(['dsh-plugin-subscriptions'].map(name => join(upstream, 'node_modules', name))) },
})
if (result.status !== 0) throw new Error('Native model capabilities Host smoke failed')
