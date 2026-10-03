/**
 * Capability *hints* from declarative sources. A hint tells the scanner which
 * capabilities may be available; it never produces an applicable working
 * configuration by itself. Sources, in trust order:
 *
 * 1. the gateway's own `/models` entry (`modalities`, `input`, …) — describes
 *    the actual deployment;
 * 2. the installed pi-ai catalog — an exact id match on the vendor's own
 *    provider is strong, a family match is weak;
 * 3. the model name (`-vl`, `vision`, `omni`, …).
 *
 * @module dsh-plugin-model-capabilities/host/catalog
 */

const FAMILY_SUFFIX = /(?:[-_.](?:\d{4,}|\d+(?:\.\d+)*|latest|preview|exp|rc\d*|beta|alpha|(?:mini|pro|flash|plus|max|lite|turbo|fast|thinking|instruct|chat)))+$/iu
const IMAGE_NAMES = /(?:vision|(?:^|[-_./])vl(?:$|[-_.])|omni|multimodal|4o|gemini|gpt-5|gpt-4\.1|claude|kimi-k[3-9]|qwen[\d.]*-vl|glm-[5-9](?:\.\d+)?v|seed-|doubao-seed|grok-[4-9]|pixtral|llava|internvl|minicpm-v|ocr)/iu
const NON_TEXT_NAMES = /(?:embedding|embed(?:$|[-_])|rerank|(?:^|[-_/])tts(?:[-_/]|$)|whisper|speech|audio|seedance|seedream|dreamina|veo-|sora|dall-e|image-\d|-image(?:$|[-_])|gpt-image|flux|stable-diffusion|imagen|video)/iu

/** Normalise an id for family matching: lower-case, unify separators, strip a version/date tail. */
export function normalizeModelId(id) {
  const base = String(id ?? '').trim().toLowerCase().replace(/^.*\//u, '').replaceAll('_', '-')
  return base.replace(FAMILY_SUFFIX, '').replace(/-+/gu, '-')
}

/**
 * Read a modality list from an arbitrary listing entry.
 * @returns {Array<'text' | 'image'> | undefined}
 */
export function modalitiesOf(entry) {
  const raw = entry?.modalities?.input ?? entry?.architecture?.input_modalities ?? entry?.input_modalities ?? entry?.inputModalities ?? entry?.input
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const values = raw.map((value) => String(value).toLowerCase())
  const hasText = values.some((value) => /text|chat|completion/u.test(value))
  const hasImage = values.some((value) => /image|vision|multimodal/u.test(value))
  if (!hasText && !hasImage) return undefined
  return hasImage ? (hasText ? ['text', 'image'] : ['image']) : ['text']
}

/** Whether a listing entry plainly describes a non-chat model (embeddings, TTS, image generation …). */
export function isNonTextEntry(entry) {
  const id = String(entry?.id ?? '')
  const endpoints = entry?.supported_endpoint_types ?? entry?.supportedEndpointTypes
  if (Array.isArray(endpoints) && endpoints.length && !endpoints.some((type) => /openai|chat|completion|anthropic|responses|gemini|messages/iu.test(String(type)))) return true
  const modalities = entry?.modalities?.output ?? entry?.architecture?.output_modalities
  if (Array.isArray(modalities) && modalities.length && !modalities.some((value) => /text/iu.test(String(value)))) return true
  return NON_TEXT_NAMES.test(id)
}

/**
 * @typedef {object} CatalogEntry
 * @property {string} id
 * @property {string} [provider]
 * @property {readonly string[]} [input]
 * @property {boolean} [reasoning]
 * @property {Record<string, string | null>} [thinkingLevelMap]
 * @property {number} [contextWindow]
 * @property {number} [maxTokens]
 * @property {Record<string, unknown>} [compat]
 */

/**
 * Load the installed pi-ai catalog when the host ships one.
 * @returns {Promise<CatalogEntry[]>}
 */
export async function loadPiAiCatalog(importer = (specifier) => import(specifier)) {
  try {
    const mod = await importer('@earendil-works/pi-ai/providers/all')
    /** @type {CatalogEntry[]} */
    const entries = []
    for (const provider of mod.getBuiltinProviders?.() ?? []) {
      for (const model of mod.getBuiltinModels?.(provider) ?? []) entries.push({ ...model, provider: model.provider ?? provider })
    }
    return entries
  } catch {
    return []
  }
}

/**
 * @typedef {object} CapabilityHint
 * @property {'listing' | 'pi-ai-catalog' | 'name' | 'none'} source
 * @property {'exact' | 'family' | 'heuristic' | 'none'} confidence
 * @property {boolean | undefined} image  true = probably reads images, false = probably not, undefined = no idea
 * @property {boolean | undefined} reasoning
 * @property {string[] | undefined} thinkingLevels levels the catalog says are selectable (excluding `off`)
 * @property {string | undefined} matchedId the catalog id the hint came from
 */

/**
 * Find the best catalog entry for an id.
 * @param {CatalogEntry[]} catalog
 * @param {string} id
 * @returns {{ entry: CatalogEntry; confidence: 'exact' | 'family' } | undefined}
 */
export function matchCatalog(catalog, id) {
  const raw = String(id).toLowerCase()
  const exact = catalog.find((entry) => String(entry.id).toLowerCase() === raw)
  if (exact) return { entry: exact, confidence: 'exact' }
  const wanted = normalizeModelId(id)
  if (!wanted) return undefined
  const sameFamily = catalog.filter((entry) => normalizeModelId(entry.id) === wanted)
  if (sameFamily.length) {
    // Prefer an entry that agrees with the majority on image support.
    const votes = sameFamily.filter((entry) => entry.input?.includes('image')).length
    const majorityImage = votes * 2 >= sameFamily.length
    return { entry: sameFamily.find((entry) => Boolean(entry.input?.includes('image')) === majorityImage) ?? sameFamily[0], confidence: 'family' }
  }
  return undefined
}

/**
 * Resolve the hint for one model.
 * @param {{ id: string; listing?: object; catalog?: CatalogEntry[] }} input
 * @returns {CapabilityHint}
 */
export function resolveHint({ id, listing, catalog = [] }) {
  const listed = modalitiesOf(listing)
  if (listed) return { source: 'listing', confidence: 'exact', image: listed.includes('image'), reasoning: typeof listing?.reasoning === 'boolean' ? listing.reasoning : undefined, thinkingLevels: undefined, matchedId: id }
  const found = matchCatalog(catalog, id)
  if (found) {
    const levels = found.entry.thinkingLevelMap && typeof found.entry.thinkingLevelMap === 'object'
      ? Object.entries(found.entry.thinkingLevelMap).filter(([level, wire]) => level !== 'off' && typeof wire === 'string').map(([level]) => level)
      : undefined
    return {
      source: 'pi-ai-catalog',
      confidence: found.confidence,
      image: Array.isArray(found.entry.input) ? found.entry.input.includes('image') : undefined,
      reasoning: typeof found.entry.reasoning === 'boolean' ? found.entry.reasoning : undefined,
      thinkingLevels: levels?.length ? levels : undefined,
      matchedId: found.entry.id,
    }
  }
  if (IMAGE_NAMES.test(id)) return { source: 'name', confidence: 'heuristic', image: true, reasoning: undefined, thinkingLevels: undefined, matchedId: undefined }
  return { source: 'none', confidence: 'none', image: undefined, reasoning: undefined, thinkingLevels: undefined, matchedId: undefined }
}
