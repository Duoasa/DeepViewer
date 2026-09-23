const FAMILY_SUFFIX = /(?:[-_.](?:\d+(?:\.\d+)*|latest|preview|rc\d+|(?:mini|pro|flash|plus|max|sonnet|opus|haiku))+)$/iu
const IMAGE_NAMES = /(?:vision|vl|omni|multimodal|4o|gemini|qwen3-vl|claude-3|claude-sonnet-4|claude-opus-4)/iu
const THINKING_NAMES = /(?:thinking|reason(?:ing)?|(?:^|[-_.])r\d|(?:^|[-_.])o[1345](?:$|[-_.]))/iu

export function normalizeModelId(id) {
  return String(id ?? '').trim().toLowerCase().replaceAll('_', '-').replace(FAMILY_SUFFIX, '').replace(/-+/gu, '-')
}

function modalitiesOf(entry) {
  const input = entry?.modalities?.input ?? entry?.input ?? entry?.inputModalities ?? entry?.supported_endpoint_types
  if (!Array.isArray(input)) return undefined
  const values = input.map(value => String(value).toLowerCase())
  // Do not treat arbitrary endpoint metadata as a text declaration. Only
  // entries that explicitly mention a text/chat/completion or image modality
  // are authoritative enough to skip an active probe.
  if (!values.some(value => /text|chat|completion|image|vision|multimodal/iu.test(value))) return undefined
  const image = values.some(value => /image|vision|multimodal/iu.test(value))
  return image ? ['text', 'image'] : ['text']
}

function reasoningOf(entry) {
  if (entry?.reasoning === false) return false
  const values = entry?.reasoning_options?.values ?? entry?.reasoningOptions?.values ?? entry?.reasoning_options ?? (entry?.thinkingLevelMap && Object.keys(entry.thinkingLevelMap))
  if (Array.isArray(values) && values.length) return Object.fromEntries(values.map(value => [String(value), String(value)]))
  if (entry?.reasoning === true) return { low: 'low', medium: 'medium', high: 'high' }
  return undefined
}

function match(entries, id) {
  const exact = entries.find(entry => normalizeModelId(entry?.id ?? entry?.name) === normalizeModelId(id))
  if (exact) return { entry: exact, confidence: 'exact' }
  const family = normalizeModelId(id)
  const candidate = entries.find(entry => {
    const normalized = normalizeModelId(entry?.id ?? entry?.name)
    return normalized && (normalized.startsWith(family) || family.startsWith(normalized))
  })
  return candidate ? { entry: candidate, confidence: 'family-matched' } : undefined
}

/** Resolve capability declarations without making a model request. */
export function resolveDeclaredCapability({ id, vendor, pricing = [], modelsDev = [], piCatalog = [] }) {
  const sources = [
    ['gateway-pricing', pricing.filter(entry => !vendor || !entry.vendor_id || entry.vendor_id === vendor)],
    ['models.dev', modelsDev.filter(entry => !vendor || !entry.vendor || entry.vendor === vendor)],
    ['pi-ai-catalog', piCatalog],
  ]
  for (const [source, entries] of sources) {
    const found = match(entries, id)
    if (!found) continue
    const modalities = modalitiesOf(found.entry)
    const reasoning = reasoningOf(found.entry)
    if (modalities === undefined && reasoning === undefined) continue
    return { ...(modalities === undefined ? {} : { modalities }), ...(reasoning === undefined ? {} : { reasoning }), source, confidence: found.confidence }
  }
  return { source: 'probe', confidence: 'unknown', ...(IMAGE_NAMES.test(id) ? { imageHint: true } : {}), ...(THINKING_NAMES.test(id) ? { reasoningHint: true } : {}) }
}

export function parseGatewayPricing(body) {
  const entries = Array.isArray(body) ? body : body?.data ?? body?.models ?? body?.data?.models
  return Array.isArray(entries) ? entries.filter(entry => typeof entry?.id === 'string' || typeof entry?.model_name === 'string').map(entry => ({
    ...entry,
    id: entry.id ?? entry.model_name,
    supported_endpoint_types: entry.supported_endpoint_types ?? entry.supportedEndpointTypes,
  })) : []
}

/** Flatten the public models.dev provider map into the resolver's entries. */
export function parseModelsDevCatalog(body) {
  const entries = []
  if (!body || typeof body !== 'object' || Array.isArray(body)) return entries
  for (const [providerId, provider] of Object.entries(body)) {
    const models = provider?.models && typeof provider.models === 'object' ? provider.models : provider
    if (!models || typeof models !== 'object' || Array.isArray(models)) continue
    for (const [modelId, entry] of Object.entries(models)) {
      if (!entry || typeof entry !== 'object') continue
      entries.push({ ...entry, id: entry.id ?? modelId, vendor: entry.vendor?.id ?? entry.vendor ?? providerId })
    }
  }
  return entries
}

/** Read the installed pi-ai catalog when the host exposes it. */
export async function loadPiAiCatalog() {
  try {
    const mod = await import('@earendil-works/pi-ai/providers/all')
    const entries = []
    for (const provider of mod.getBuiltinProviders?.() ?? []) {
      for (const model of mod.getBuiltinModels?.(provider) ?? []) {
        entries.push({ ...model, vendor: model.provider ?? provider, reasoning_options: model.thinkingLevelMap ? { values: Object.keys(model.thinkingLevelMap) } : undefined })
      }
    }
    return entries
  } catch {
    // The plugin remains portable when the optional host catalog is absent.
    return []
  }
}
