import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SUBSCRIPTIONS_UI_ADAPTER_ID = 'deepviewer-remaining-usage-v1'
export const SUBSCRIPTIONS_DSH_PEER_VERSION = '0.1.1-rc.2'

const subscriptionsPluginName = 'dsh-plugin-subscriptions'
const subscriptionsPluginVersion = '0.3.1'
const subscriptionsDshPeers = [
  '@deepseek-ai/dsh-attachment',
  '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-tools',
]

export function remainingSubscriptionPercent(usedPercent) {
  return 100 - Math.min(100, Math.max(0, usedPercent))
}

export function remainingSubscriptionLevel(remainingPercent) {
  if (remainingPercent < 20) return 'critical'
  if (remainingPercent < 50) return 'low'
  return 'healthy'
}

function replaceRequired(value, before, after, label) {
  if (value.includes(after)) return value
  const matches = value.split(before).length - 1
  if (matches !== 1) {
    throw new Error(`subscriptions UI adapter anchor mismatch: ${label} (${String(matches)})`)
  }
  return value.replace(before, after)
}

const clientReplacements = [
  {
    label: 'english usage copy',
    before: 'usageSession: "5-hour window",\n\tusageWeekly: "Weekly",',
    after: 'usageSession: "Periodic window",\n\tusageRemaining: "{percent}% remaining",\n\tusageLevelHealthy: "available",\n\tusageLevelLow: "low",\n\tusageLevelCritical: "critical",\n\tusageWeekly: "Weekly",',
  },
  {
    label: 'chinese usage copy',
    before: 'usageSession: "5 小时窗口",\n\tusageWeekly: "每周",',
    after: 'usageSession: "周期窗口",\n\tusageRemaining: "剩余 {percent}%",\n\tusageLevelHealthy: "充足",\n\tusageLevelLow: "偏低",\n\tusageLevelCritical: "紧张",\n\tusageWeekly: "每周",',
  },
  {
    label: 'remaining balance colors',
    before: `/** Bar fill color: success normally, warn from 80%, error from 95%. */
function usageBarColor(usedPercent) {
\tif (usedPercent >= 95) return "var(--dsw-alias-state-error-primary)";
\tif (usedPercent >= 80) return "var(--dsw-alias-state-warn-label)";
\treturn "var(--dsw-alias-state-success-primary)";
}`,
    after: `/** Remaining balance color and localized level at the DeepViewer thresholds. */
function usageBalanceColor(remainingPercent) {
\tif (remainingPercent < 20) return "var(--dsw-alias-state-error-primary)";
\tif (remainingPercent < 50) return "var(--dsw-alias-state-warn-label)";
\treturn "var(--dsw-alias-state-success-primary)";
}
function usageBalanceLevel(t, remainingPercent) {
\tif (remainingPercent < 20) return t("usageLevelCritical");
\tif (remainingPercent < 50) return t("usageLevelLow");
\treturn t("usageLevelHealthy");
}`,
  },
  {
    label: 'remaining percentage calculation',
    before: 'const percent = Math.min(100, Math.max(0, window$1.usedPercent));',
    after: 'const remainingPercent = 100 - Math.min(100, Math.max(0, window$1.usedPercent));\n\t\t\t\t\t\t\t\tconst balanceColor = usageBalanceColor(remainingPercent);',
  },
  {
    label: 'remaining percentage label',
    before: '(0, react_jsx_runtime.jsxs)("span", { children: [`${String(Math.round(percent))}%`, window$1.resetsAt',
    after: '(0, react_jsx_runtime.jsxs)("span", { style: { color: balanceColor }, children: [t("usageRemaining", { percent: String(Math.round(remainingPercent)) }), ` · ${usageBalanceLevel(t, remainingPercent)}`, window$1.resetsAt',
  },
  {
    label: 'remaining bar width',
    before: 'width: `${String(percent)}%`,',
    after: 'width: `${String(remainingPercent)}%`,',
  },
  {
    label: 'remaining bar color',
    before: 'background: usageBarColor(percent)',
    after: 'background: balanceColor',
  },
]

function adaptedSubscriptionsManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== subscriptionsPluginName || manifest.version !== subscriptionsPluginVersion) {
    throw new Error(`subscriptions adapter package mismatch: ${String(manifest.name)}@${String(manifest.version)}`)
  }
  if (manifest.peerDependencies === null || typeof manifest.peerDependencies !== 'object') {
    throw new Error('subscriptions adapter requires peerDependencies')
  }
  for (const peer of subscriptionsDshPeers) {
    if (typeof manifest.peerDependencies[peer] !== 'string') {
      throw new Error(`subscriptions adapter is missing peer dependency: ${peer}`)
    }
    manifest.peerDependencies[peer] = SUBSCRIPTIONS_DSH_PEER_VERSION
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** Apply the tracked DeepViewer presentation and DSH compatibility adaptations to a staged plugin copy. */
export function adaptSubscriptionsPlugin(pluginRoot) {
  const clientPath = join(pluginRoot, 'lib', 'client.js')
  const manifestPath = join(pluginRoot, 'package.json')
  if (!existsSync(clientPath)) throw new Error(`subscriptions client is missing: ${clientPath}`)
  if (!existsSync(manifestPath)) throw new Error(`subscriptions manifest is missing: ${manifestPath}`)

  const original = readFileSync(clientPath, 'utf8')
  const originalManifest = readFileSync(manifestPath, 'utf8')
  const adapted = clientReplacements.reduce(
    (value, replacement) => replaceRequired(
      value,
      replacement.before,
      replacement.after,
      replacement.label,
    ),
    original,
  )
  const adaptedManifest = adaptedSubscriptionsManifest(manifestPath)
  if (adapted === original && adaptedManifest === originalManifest) return false
  if (adapted !== original) writeFileSync(clientPath, adapted)
  if (adaptedManifest !== originalManifest) writeFileSync(manifestPath, adaptedManifest)
  return true
}
