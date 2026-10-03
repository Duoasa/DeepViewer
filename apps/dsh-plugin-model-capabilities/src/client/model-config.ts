/**
 * Pure helpers for editing one model entry of an llm-pi-ai provider route.
 * No React, no I/O — the editors call these and hand the produced settings
 * op to the host.
 *
 * @module dsh-plugin-model-capabilities/client/model-config
 */

export const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type Level = (typeof LEVELS)[number]
export type EffortMode = 'inherit' | 'disabled' | 'custom'
export type ImageMode = 'preserve' | 'inherit' | 'text' | 'image'

export interface ModelEntry {
  id: string
  name?: string
  input?: string[]
  reasoningEfforts?: Record<string, string | null> | false
  compat?: Record<string, unknown>
  [key: string]: unknown
}

export interface SettingsViewLike {
  revision: number
  value?: unknown
  user?: unknown
  secrets?: Array<{ path: readonly string[] }>
}

export function validateEfforts(mode: EffortMode, rows: Record<string, string>): Record<string, string | null> | false | undefined {
  if (mode === 'inherit') return undefined
  if (mode === 'disabled') return false
  const result: Record<string, string | null> = {}
  for (const [level, value] of Object.entries(rows)) {
    if (!LEVELS.includes(level as Level)) throw new Error(`Unknown effort level: ${level}`)
    const wire = String(value ?? '').trim()
    if (!wire && level !== 'off') throw new Error('Enabled levels need an API value')
    if (wire.length > 80 || /[\r\n]/u.test(wire)) throw new Error('Invalid API value')
    result[level] = wire || null
  }
  if (!Object.keys(result).some((key) => key !== 'off')) throw new Error('Select at least one thinking level besides Off')
  return result
}

export function providerModels(view: SettingsViewLike | undefined, route: string): ModelEntry[] | undefined {
  const providers = ((view?.user ?? view?.value) as { providers?: Record<string, { models?: ModelEntry[] }> } | undefined)?.providers
  const models = providers?.[route]?.models
  return Array.isArray(models) ? models : undefined
}

/** Build the `set` op that rewrites one model in place. */
export function modelEdit(view: SettingsViewLike, route: string, id: string, mode: EffortMode, rows: Record<string, string>, imageMode: ImageMode = 'preserve') {
  const path = ['providers', route, 'models']
  if (view.secrets?.some((secret) => secret.path.length >= 3 && path.every((key, index) => secret.path[index] === key))) throw new Error('This model list contains secret fields; editing is unavailable')
  const models = providerModels(view, route)
  if (!models) throw new Error('Only explicitly configured model lists can be edited')
  if (models.filter((model) => model.id === id).length !== 1) throw new Error('Model changed or duplicate model id; reload')
  const efforts = validateEfforts(mode, rows)
  return {
    op: 'set' as const,
    path,
    value: models.map((model) => {
      if (model.id !== id) return model
      const copy: ModelEntry = { ...model }
      if (efforts === undefined) delete copy.reasoningEfforts
      else copy.reasoningEfforts = efforts
      if (imageMode === 'inherit') delete copy.input
      else if (imageMode === 'image') copy.input = ['text', 'image']
      else if (imageMode === 'text') copy.input = ['text']
      return copy
    }),
  }
}
