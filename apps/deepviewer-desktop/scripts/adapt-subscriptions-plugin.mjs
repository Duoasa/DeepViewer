import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { subscriptionMessages } from './subscriptions-v4-messages.mjs'

export const SUBSCRIPTIONS_UI_ADAPTER_ID = 'deepviewer-remaining-usage-dsh020-v1'
export const SUBSCRIPTIONS_DSH_PEER_VERSION = '0.2.0-rc.2'

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
  manifest.peerDependencies['@deepseek-ai/cordis'] = '4.0.4'
  manifest.files = [...new Set([...manifest.files, 'lib/LICENSE.dsh-gallery'])]
  manifest.dsh.client.inject = manifest.dsh.client.inject.map(name => name === '@deepseek-ai/dsh-client-runtime' ? '@deepseek-ai/dsh-client-ui-session' : name)
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** Preserve DeepViewer's remaining-balance presentation when rebuilding the published sources. */
export function adaptSubscriptionsClientSource(name, source) {
  const replacements = name === 'locales.ts' ? [
    ["usageSession: '5-hour window',", "usageSession: 'Periodic window',\n  usageRemaining: '{percent}% remaining',\n  usageLevelHealthy: 'available',\n  usageLevelLow: 'low',\n  usageLevelCritical: 'critical',"],
    ["usageSession: '5 小时窗口',", "usageSession: '周期窗口',\n  usageRemaining: '剩余 {percent}%',\n  usageLevelHealthy: '充足',\n  usageLevelLow: '偏低',\n  usageLevelCritical: '紧张',"],
  ] : name === 'SubscriptionsSection.tsx' ? [
    ["function usageBarColor(usedPercent: number): string {\n  if (usedPercent >= 95) return 'var(--dsw-alias-state-error-primary)'\n  if (usedPercent >= 80) return 'var(--dsw-alias-state-warn-label)'", "function usageBalanceColor(remainingPercent: number): string {\n  if (remainingPercent < 20) return 'var(--dsw-alias-state-error-primary)'\n  if (remainingPercent < 50) return 'var(--dsw-alias-state-warn-label)'"],
    ['const percent = Math.min(100, Math.max(0, window.usedPercent))', "const remainingPercent = 100 - Math.min(100, Math.max(0, window.usedPercent))\n                  const balanceColor = usageBalanceColor(remainingPercent)\n                  const level = remainingPercent < 20 ? 'usageLevelCritical' : remainingPercent < 50 ? 'usageLevelLow' : 'usageLevelHealthy'"],
    ['<span>\n                          {`${String(Math.round(percent))}%`}', '<span style={{ color: balanceColor }}>\n                          {t(\'usageRemaining\', { percent: String(Math.round(remainingPercent)) })}\n                          {` · ${t(level)}`}'],
    ['width: `${String(percent)}%`, background: usageBarColor(percent)', 'width: `${String(remainingPercent)}%`, background: balanceColor'],
  ] : name === 'ImageGenerateToolview.tsx' ? [
    ["import { en } from './locales.js'", "import { en } from './locales.js'\nimport css from './ImageGenerateToolview.module.css'"],
    ["<p style={styles.subtle}>{t('generating')}</p>", "<p className={css.generating} role=\"status\">{t('generating')}</p>"],
    ["<div style={styles.container}>", "<div style={styles.container} className={css.toolview}>"],
    ["fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-primary)'", "fontSize: 'var(--dsh-content-font-size, 14px)', lineHeight: 'calc(24px + var(--dsh-content-font-delta, 0px))', color: 'var(--dsw-alias-label-primary)'"],
    ["fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)'", "fontSize: 'var(--dsh-content-font-size, 14px)', lineHeight: 'calc(24px + var(--dsh-content-font-delta, 0px))', color: 'var(--dsw-alias-label-tertiary)'"],
    ["fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)'", "fontSize: 'var(--dsh-content-font-size, 14px)', lineHeight: 'calc(24px + var(--dsh-content-font-delta, 0px))', color: 'var(--dsw-alias-label-secondary)'"],
    ["fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)'", "fontSize: 'var(--dsh-content-font-size, 14px)', lineHeight: 'calc(24px + var(--dsh-content-font-delta, 0px))', color: 'var(--dsw-alias-state-error-primary)'"],
  ] : []
  return replacements.reduce((content, [before, after]) => replaceRequired(content, before, after, `${name} source`), source)
}

/** Apply the tracked DeepViewer presentation and DSH compatibility adaptations to a staged plugin copy. */
export function adaptSubscriptionsPlugin(pluginRoot) {
  const hostPath = join(pluginRoot, 'lib', 'index.js')
  const originalHost = readFileSync(hostPath, 'utf8')
  let adaptedHost = replaceRequired(originalHost, 'CONTEXT_WINDOW_EXCEEDED_CODE, CallId,', 'CONTEXT_WINDOW_EXCEEDED_CODE, ToolCallId as CallId,', 'DSH tool-call identity rename')
  const imageStart = adaptedHost.indexOf('async function resolveImages(messages, attachments, signal) {')
  const imageEnd = adaptedHost.indexOf('\n//#endregion', imageStart)
  if (imageStart < 0 || imageEnd < imageStart) throw new Error('subscriptions image resolver is missing')
  const resolver = `${subscriptionMessages.toString()}\nasync function resolveImages(messages, attachments, signal) {\n  return subscriptionMessages(messages, attachments, signal, offloadedImageText);\n}\n`
  if (!adaptedHost.includes('function subscriptionMessages(')) {
    adaptedHost = adaptedHost.slice(0, imageStart) + resolver + adaptedHost.slice(imageEnd)
  }
  adaptedHost = replaceRequired(adaptedHost, 'CONTEXT_WINDOW_EXCEEDED_CODE, ToolCallId as CallId,', 'offloadedImageText, CONTEXT_WINDOW_EXCEEDED_CODE, ToolCallId as CallId,', 'DSH V4 image omission')
  adaptedHost = replaceRequired(adaptedHost,
    'type: "function",\n\t\tname: tool.name,\n\t\tdescription: tool.description,\n\t\tparameters: tool.parameters',
    // Responses may normalize an omitted strict flag and require optional
    // escalation fields. DSH validates its original optional schema at execution.
    'type: "function",\n\t\tname: tool.name,\n\t\tdescription: tool.description,\n\t\tstrict: false,\n\t\tparameters: tool.parameters',
    'Responses optional tool arguments')
  adaptedHost = replaceRequired(adaptedHost,
    'ctx.inject(["connection"], (ctx$1) => {\n\t\tconst connection = ctx$1.get("connection");\n\t\tctx$1.effect(() => connection.rpc.handle(',
    'ctx.inject(["connection", "webServer"], (ctx$1) => {\n\t\tif (ctx$1.webServer.host !== "127.0.0.1") throw new Error("DeepViewer subscriptions require loopback");\n\t\tconst connection = ctx$1.connection;\n\t\tconnection.rpc.handle(',
    'DSH scoped RPC registration')
  adaptedHost = replaceRequired(adaptedHost,
    '}, { authority: "loopback" }), "dsh-plugin-subscriptions: /subscriptions-auth rpc channel");',
    '}, ctx$1); // DeepViewer: authenticated Connection owns the route lifetime.',
    'DSH authenticated RPC authority')
  const hostChanged = adaptedHost !== originalHost
  if (hostChanged) writeFileSync(hostPath, adaptedHost)
  const clientPath = join(pluginRoot, 'lib', 'client.js')
  const manifestPath = join(pluginRoot, 'package.json')
  if (!existsSync(clientPath)) throw new Error(`subscriptions client is missing: ${clientPath}`)
  if (!existsSync(manifestPath)) throw new Error(`subscriptions manifest is missing: ${manifestPath}`)

  const original = readFileSync(clientPath, 'utf8')
  const originalManifest = readFileSync(manifestPath, 'utf8')
  const adapted = original.includes('function usageBalanceColor(') && original.includes('usageRemaining:')
    ? original
    : clientReplacements.reduce(
    (value, replacement) => replaceRequired(
      value,
      replacement.before,
      replacement.after,
      replacement.label,
    ),
    original,
  )
  const adaptedManifest = adaptedSubscriptionsManifest(manifestPath)
  if (adapted === original && adaptedManifest === originalManifest) return hostChanged
  if (adapted !== original) writeFileSync(clientPath, adapted)
  if (adaptedManifest !== originalManifest) writeFileSync(manifestPath, adaptedManifest)
  return true
}
