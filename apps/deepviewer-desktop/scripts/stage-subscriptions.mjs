import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adaptSubscriptionsPlugin,
  SUBSCRIPTIONS_DSH_PEER_VERSION,
  SUBSCRIPTIONS_UI_ADAPTER_ID,
} from './adapt-subscriptions-plugin.mjs'
import { imageGenerateStylesPath } from './prepare-subscriptions-client.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(appRoot, '..', '..')
const upstreamRoot = resolve(projectRoot, 'upstream', 'deepseek-harness')
const subscriptionsPluginName = 'dsh-plugin-subscriptions'
const subscriptionsPluginVersion = '0.3.1'
const subscriptionsPluginSource = resolve(projectRoot, 'node_modules', subscriptionsPluginName)
const subscriptionsPluginTarget = resolve(upstreamRoot, 'node_modules', subscriptionsPluginName)
const subscriptionsPluginStampPath = resolve(upstreamRoot, '.deepviewer-subscriptions-plugin')
const subscriptionsUiAdapterPath = resolve(appRoot, 'scripts', 'adapt-subscriptions-plugin.mjs')
const subscriptionsPluginPeers = new Map([
  ['@deepseek-ai/cordis', resolve(upstreamRoot, 'vendor', 'cordis')],
  ['@deepseek-ai/dsh-attachment', resolve(upstreamRoot, 'packages', 'attachment', 'attachment')],
  ['@deepseek-ai/dsh-home-paths', resolve(upstreamRoot, 'packages', 'util', 'home-paths')],
  ['@deepseek-ai/dsh-llm', resolve(upstreamRoot, 'packages', 'llm', 'llm')],
  ['@deepseek-ai/dsh-tools', resolve(upstreamRoot, 'packages', 'core', 'tools')],
  ['@deepseek-ai/schemastery', resolve(upstreamRoot, 'vendor', 'schemastery')],
])
function subscriptionsPluginDigest(root) {
  const digest = createHash('sha256')
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === 'node_modules') continue
      const path = resolve(directory, entry.name)
      const relativePath = path.slice(root.length + 1)
      digest.update(relativePath)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() || entry.isSymbolicLink()) digest.update(readFileSync(path))
    }
  }
  visit(root)
  return digest.digest('hex')
}

function validateSubscriptionsPlugin(root, integrated = false) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Missing ${subscriptionsPluginName}; run pnpm install in the DeepViewer workspace`)
  }
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const clientExport = manifest.exports?.['./client']?.default
  if (
    manifest.name !== subscriptionsPluginName
    || manifest.version !== subscriptionsPluginVersion
    || manifest.license !== 'MIT'
    || (manifest.dsh?.bundle?.patch !== './cordis.patch.yml' && !(integrated && manifest.dsh?.bundle === undefined))
    || manifest.dsh?.client?.platform !== 'web'
    || typeof manifest.main !== 'string'
    || typeof clientExport !== 'string'
    || !existsSync(resolve(root, manifest.main))
    || !existsSync(resolve(root, clientExport))
    || !existsSync(resolve(root, 'cordis.patch.yml'))
    || !existsSync(resolve(root, 'LICENSE'))
  ) {
    throw new Error(`Invalid ${subscriptionsPluginName}@${subscriptionsPluginVersion} package`)
  }
}

function stageSubscriptionsPluginPeers() {
  let changed = false
  for (const [name, target] of subscriptionsPluginPeers) {
    if (!existsSync(resolve(target, 'package.json'))) {
      throw new Error(`Missing pinned Harness peer package for ${subscriptionsPluginName}: ${name}`)
    }
    const link = resolve(subscriptionsPluginTarget, 'node_modules', ...name.split('/'))
    try {
      if (lstatSync(link).isSymbolicLink() && realpathSync(link) === realpathSync(target)) continue
    } catch {
      // Any missing, wrong, or dangling generated entry is replaced below.
    }
    rmSync(link, { recursive: true, force: true })
    mkdirSync(resolve(link, '..'), { recursive: true })
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
    changed = true
  }
  return changed
}

export function stageSubscriptionsPlugin() {
  validateSubscriptionsPlugin(subscriptionsPluginSource)
  const sourceDigest = subscriptionsPluginDigest(subscriptionsPluginSource)
  const desiredStamp = `${sourceDigest}:${SUBSCRIPTIONS_UI_ADAPTER_ID}:${SUBSCRIPTIONS_DSH_PEER_VERSION}:${createHash("sha256").update(readFileSync(subscriptionsUiAdapterPath)).update(readFileSync(resolve(appRoot, "scripts/subscriptions-v4-messages.mjs"))).update(readFileSync(resolve(appRoot, "scripts/prepare-subscriptions-client.mjs"))).update(readFileSync(imageGenerateStylesPath)).digest("hex")}\n`
  const packageCurrent = (
    existsSync(subscriptionsPluginTarget)
    && lstatSync(subscriptionsPluginTarget).isDirectory()
    && existsSync(subscriptionsPluginStampPath)
    && readFileSync(subscriptionsPluginStampPath, 'utf8') === desiredStamp
  )
  if (!packageCurrent) {
    rmSync(subscriptionsPluginTarget, { recursive: true, force: true })
    mkdirSync(resolve(subscriptionsPluginTarget, '..'), { recursive: true })
    cpSync(subscriptionsPluginSource, subscriptionsPluginTarget, { recursive: true, dereference: true })
  }
  validateSubscriptionsPlugin(subscriptionsPluginTarget, true)
  const adapterChanged = adaptSubscriptionsPlugin(subscriptionsPluginTarget)
  if (!packageCurrent || adapterChanged) writeFileSync(subscriptionsPluginStampPath, desiredStamp)
  const peersChanged = stageSubscriptionsPluginPeers()
  if (packageCurrent && !adapterChanged && !peersChanged) return false
  process.stdout.write(
    `Staged ${subscriptionsPluginName}@${subscriptionsPluginVersion} with ${SUBSCRIPTIONS_UI_ADAPTER_ID} for DSH ${SUBSCRIPTIONS_DSH_PEER_VERSION}.\n`,
  )
  return true
}
