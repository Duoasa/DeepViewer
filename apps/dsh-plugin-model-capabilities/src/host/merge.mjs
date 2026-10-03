/** Apply a verified working configuration, including corrections to previous manual capabilities. */
import { createHash } from 'node:crypto'
export const modelFingerprint = model => createHash('sha256').update(JSON.stringify(model)).digest('hex')

export function mergeModels(existing, results, options = {}) {
  const byId = new Map(results.map(row => [row.id, row]))
  const ownership = { models: Object.create(null) }
  const changed = [], seen = new Set(), ordered = [...existing], models = []
  if (options.addDiscovered) {
    for (const row of results) if (row.availability === 'available' && !existing.some(model => model.id === row.id)) ordered.push({ id: row.id, name: row.id })
  }
  for (const model of ordered) {
    if (!model || typeof model.id !== 'string' || seen.has(model.id)) continue
    seen.add(model.id)
    const row = byId.get(model.id)
    const previous = options.ownership?.models?.[model.id]
    // Legacy boolean ownership is deliberately never trusted.
    const owned = previous?.fingerprint === modelFingerprint(model) ? { ...previous } : {}
    if (!row) {
      models.push(model)
      if (owned.fingerprint) ownership.models[model.id] = owned
      continue
    }
    if (options.exclude && row.availability === 'model_not_found') { changed.push(model.id); continue }
    const copy = structuredClone(model)
    // No successful final request means no recommended payload and no automatic writes.
    const working = row.availability === 'available' ? row.recommended : undefined
    if (working) {
      copy.input = [...working.input]
      copy.reasoningEfforts = structuredClone(working.reasoningEfforts)
      copy.compat = { ...copy.compat, ...working.compat }
      if (working.minOutputTokens && copy.maxTokens !== undefined && copy.maxTokens < working.minOutputTokens) copy.maxTokens = working.minOutputTokens
      owned.input = [...copy.input]
      owned.reasoningEfforts = structuredClone(copy.reasoningEfforts)
    }
    if (owned.input || owned.reasoningEfforts) {
      owned.fingerprint = modelFingerprint(copy)
      ownership.models[model.id] = owned
    }
    if (JSON.stringify(copy) !== JSON.stringify(model)) changed.push(model.id)
    models.push(copy)
  }
  if (!models.length) throw new Error('merge would leave no models; configuration not modified')
  return { models, ownership, changed }
}
