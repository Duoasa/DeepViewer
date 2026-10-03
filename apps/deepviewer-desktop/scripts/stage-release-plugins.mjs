import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stageSubscriptionsPlugin } from './stage-subscriptions.mjs'
import { stageBetterSidebar } from './stage-better-sidebar.mjs'
import { prepareSubscriptionsClient } from './prepare-subscriptions-client.mjs'
import { adaptSubscriptionsPlugin } from './adapt-subscriptions-plugin.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const projectRoot = resolve(appRoot, '../..')
const upstreamRoot = resolve(projectRoot, 'upstream/deepseek-harness')
const subscriptionsSource = resolve(projectRoot, 'node_modules/dsh-plugin-subscriptions')
const subscriptionsTarget = resolve(upstreamRoot, 'node_modules/dsh-plugin-subscriptions')

function run(command, args, cwd, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} failed with code=${String(code)} signal=${String(signal)}`))
    })
  })
}

// Restore the published source snapshot before running this script. Only
// generated node_modules are touched; the exact Harness source tree stays fixed.
stageSubscriptionsPlugin()
stageBetterSidebar(upstreamRoot)
prepareSubscriptionsClient(subscriptionsTarget, upstreamRoot, subscriptionsSource)
await run('pnpm', ['exec', 'tsdown', '--config', resolve(subscriptionsTarget, 'deepviewer-client.config.mjs')], subscriptionsTarget, {
  ...process.env,
  DSH_EXTERNAL_WORKSPACE_MANIFEST: resolve(subscriptionsTarget, 'package.json'),
})
adaptSubscriptionsPlugin(subscriptionsTarget)
process.stdout.write('Pinned release plugins staged without changing the Harness source snapshot.\n')
