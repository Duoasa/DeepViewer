export const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
export function validateEfforts(mode, rows) {
  if (mode === 'inherit') return undefined
  if (mode === 'disabled') return false
  if (mode !== 'custom') throw new Error('Invalid mode')
  const result = {}
  for (const [level, value] of Object.entries(rows)) {
    if (!LEVELS.includes(level)) throw new Error('Unknown effort level')
    const wire = String(value).trim()
    if (!wire && level !== 'off') throw new Error('Enabled levels need an API value')
    if (wire.length > 80 || /[\r\n]/.test(wire)) throw new Error('Invalid API value')
    result[level] = wire || null
  }
  if (!Object.keys(result).some(key => key !== 'off')) throw new Error('Select at least one thinking level')
  return result
}
export function modelEdit(view, route, id, mode, rows, imageMode = 'preserve') {
  if (!['preserve', 'inherit', 'text', 'image'].includes(imageMode)) throw new Error('Invalid image input mode')
  const path = ['providers', route, 'models']
  if (view.secrets?.some(s => s.path.slice(0, 3).every((key, i) => key === path[i]) && s.path.length >= 3)) throw new Error('This model list contains secret fields; editing is unavailable')
  const models = view.user?.providers?.[route]?.models
  if (!Array.isArray(models)) throw new Error('Only explicitly configured model lists can be edited')
  if (models.filter(m => m.id === id).length !== 1) throw new Error('Model changed or duplicate model ID; reload')
  const efforts = validateEfforts(mode, rows)
  return { op: 'set', path, value: models.map(m => {
    if (m.id !== id) return m
    const copy = { ...m }
    if (efforts === undefined) delete copy.reasoningEfforts
    else copy.reasoningEfforts = efforts
    if (imageMode === 'inherit') delete copy.input
    else if (imageMode !== 'preserve') copy.input = imageMode === 'image' ? ['text', 'image'] : ['text']
    return copy
  }) }
}
