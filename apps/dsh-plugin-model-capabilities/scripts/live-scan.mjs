#!/usr/bin/env node
/**
 * Live verification against a real OpenAI-compatible gateway.
 *
 *   MC_BASE_URL=https://gw/v1 MC_API_KEY=sk-… node scripts/live-scan.mjs model-a model-b …
 *
 * Prints one line per model: availability, image verdict (+source), reasoning verdict, request count.
 * The key is read from the environment only and never printed.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { loadPiAiCatalog } from '../src/host/catalog.mjs'
import { DEFAULT_LIMITS, scanModel } from '../src/host/scanner.mjs'

const baseURL = process.env.MC_BASE_URL
const apiKey = process.env.MC_API_KEY
const api = process.env.MC_API ?? 'openai-completions'
if (!baseURL || !apiKey) {
  console.error('set MC_BASE_URL and MC_API_KEY')
  process.exit(2)
}
const ids = process.argv.slice(2)
if (!ids.length) {
  console.error('pass model ids')
  process.exit(2)
}
const toolchain = process.env.DSH_TOOLCHAIN?.replace(/\/?$/u, '/')
const toolchainRequire = toolchain ? createRequire(`${toolchain}package.json`) : undefined
const catalog = await loadPiAiCatalog(async (specifier) => {
  if (!toolchainRequire) return import(specifier)
  try {
    return await import(pathToFileURL(toolchainRequire.resolve(specifier)).href)
  } catch {
    // ESM-only export maps are invisible to require.resolve: fall back to the package's dist layout.
    return import(pathToFileURL(`${toolchain}node_modules/${specifier.replace(/^(@[^/]+\/[^/]+|[^/]+)\//u, '$1/dist/')}.js`).href)
  }
})
console.error(`catalog entries: ${catalog.length}`)
const route = { baseURL, api, apiKey }
const limits = { ...DEFAULT_LIMITS, concurrency: 3 }
const controller = new AbortController()
process.on('SIGINT', () => controller.abort())
let next = 0
const rows = []
await Promise.all(
  Array.from({ length: limits.concurrency }, async () => {
    while (next < ids.length) {
      const id = ids[next++]
      const started = Date.now()
      const result = await scanModel(route, { id }, { catalog, limits, signal: controller.signal })
      rows.push(result)
      const img = `${result.image.status}${result.image.source !== 'none' ? `(${result.image.source})` : ''}`
      const rsn = `${result.reasoning.status}${result.reasoning.levels.length ? `[${result.reasoning.levels.join('/')}]` : ''}`
      const dev = result.compat?.supportsDeveloperRole === false ? ' dev-role:no' : ''
      console.log(`${id.padEnd(40)} ${result.availability.padEnd(17)} image=${img.padEnd(22)} reasoning=${rsn.padEnd(30)} req=${String(result.requests).padStart(2)} ${((Date.now() - started) / 1000).toFixed(1)}s${dev}\n${' '.repeat(41)}↳ ${result.image.note}`)
    }
  }),
)
if (process.env.MC_JSON) console.log(JSON.stringify(rows, null, 2))
