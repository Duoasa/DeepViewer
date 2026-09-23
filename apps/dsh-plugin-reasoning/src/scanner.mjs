/** Bounded, provider-neutral probes. No credentials or response text leave this module. */
import { imageChallenge, matchesImageAnswer } from './image-challenge.mjs'
import { loadPiAiCatalog, parseGatewayPricing, parseModelsDevCatalog, resolveDeclaredCapability } from './capability-sources.mjs'
import { responsesBody, readResponsesProbe } from './responses-probe.mjs'
export const SCAN_VERSION = 4
export const EFFORTS = ['low', 'medium', 'high']
export const LIMITS = { models: 200, outputTokens: 1, requestsPerModel: 7, concurrency: 2, timeoutMs: 15000 }
let modelsDevCache = { at: 0, entries: [] }
let piAiCache = []
export function endpoint(baseURL, suffix) {
  const base = new URL(baseURL)
  if (base.username || base.password || base.search || base.hash) throw Error('API 地址不能包含凭据、查询参数或锚点')
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw Error('远程 API 必须使用 HTTPS')
  return base.href.replace(/\/$/, '') + '/' + suffix
}
async function boundedText(response, cap = 1048576) {
  const reader = response.body.getReader(); let text = ''; const decoder = new TextDecoder()
  try { while (true) { const { done, value } = await reader.read(); if (done) return text; text += decoder.decode(value, { stream: true }); if (text.length > cap) throw Error('响应超过扫描大小限制') } }
  finally { await reader.cancel().catch(() => {}) }
}
export async function discover(profile, key, signal, request = fetch) {
  let pricing = []
  try {
    const base = new URL(profile.baseURL)
    const response = await request(`${base.origin}/api/pricing`, { signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.timeoutMs)]), redirect: 'error' })
    if (response.ok) pricing = parseGatewayPricing(JSON.parse(await boundedText(response)))
  } catch { /* optional unauthenticated gateway directory */ }
  let modelsDev = profile.modelsDevCatalog ?? []
  if (!modelsDev.length && profile.modelsDev !== false && Date.now() - modelsDevCache.at > 86400000) {
    try {
      const response = await request('https://models.dev/api.json', { signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.timeoutMs)]), redirect: 'error', headers: { Accept: 'application/json' } })
      if (response.ok) {
        const parsed = parseModelsDevCatalog(JSON.parse(await boundedText(response, 8388608)))
        if (parsed.length) modelsDevCache = { at: Date.now(), entries: parsed }
      }
    } catch { /* public catalog is an optional capability source */ }
    modelsDev = modelsDevCache.entries
  }
  const piCatalog = profile.piAiCatalog ?? (piAiCache.length ? piAiCache : await loadPiAiCatalog())
  if (!piAiCache.length && !profile.piAiCatalog?.length) piAiCache = piCatalog
  const response = await request(endpoint(profile.baseURL, 'models'), { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.timeoutMs)]), redirect: 'error' })
  if (!response.ok && !([404, 405].includes(response.status) && profile.models?.length)) throw Error('获取模型列表失败 HTTP ' + response.status)
  const body = response.ok ? JSON.parse(await boundedText(response)) : { data: profile.models }
  if (!Array.isArray(body.data)) throw Error('模型目录格式不受支持，需要 OpenAI /models 接口')
  const ids = new Set(), models = []
  for (const entry of body.data) {
    if (typeof entry?.id !== 'string' || !entry.id.trim() || entry.id.length > 256 || ids.has(entry.id)) continue
    ids.add(entry.id)
    const capability = resolveDeclaredCapability({ id: entry.id, vendor: pricing.find(item => item.id === entry.id)?.vendor_id, pricing, modelsDev, piCatalog })
    models.push({ id: entry.id, nonText: capability.modalities ? !capability.modalities.includes('text') : /(?:embedding|(?:^|[-_/])(?:tts)(?:[-_/]|$)|seedance|seedream|veo-|whisper|dall-e)/i.test(entry.id), capability })
  }
  // Some gateways publish pricing entries before /v1/models catches up. Add
  // those IDs so a scan can make the picker symmetric for newly listed models.
  for (const entry of pricing) {
    if (typeof entry?.id !== 'string' || ids.has(entry.id)) continue
    ids.add(entry.id)
    const capability = resolveDeclaredCapability({ id: entry.id, vendor: entry.vendor_id, pricing, modelsDev, piCatalog })
    models.push({ id: entry.id, nonText: capability.modalities ? !capability.modalities.includes('text') : false, capability })
  }
  // Existing configured models absent from /models are still probed, never silently lost.
  for (const entry of profile.models ?? []) if (!ids.has(entry.id)) { ids.add(entry.id); models.push({ id: entry.id, nonText: false, capability: resolveDeclaredCapability({ id: entry.id, modelsDev, piCatalog }) }) }
  if (!models.length) throw Error('API 未返回可扫描的模型')
  return models
}
export function classifyProbeError(text, status, image = false) {
  const budget = /budget|max_tokens|max_completion_tokens|max_output_tokens/i.test(text)
  const developerRoleRejected = [400, 422, 200].includes(status) && /developer/i.test(text) && /role/i.test(text) && /unexpected|unsupported|not support|not allowed|allowed roles|only.*user/i.test(text)
  const effortError = /reasoning[_. -]?effort|__deepviewer_invalid_effort__/i.test(text)
  const permissionDenied = [401, 403].includes(status) || /insufficient[_ -]?quota|group not allowed|未提供令牌|permission denied|forbidden/i.test(text)
  // A missing endpoint is not evidence that any particular model is absent.
  const modelNotFound = !permissionDenied && [200, 400, 404, 422].includes(status) && /model[_ -]?not[_ -]?found|unknown model|model[^\n]{0,160}(?:does not exist|not found)/i.test(text)
  const rejectedImage = image && [200,400,422].includes(status) && /image|vision|multimodal/i.test(text) && /not support|unsupported|not allowed|only supports text|text.only/i.test(text) && !/format|mime|size|resolution|base64|decode|url|data.?uri|fetch|download/i.test(text) && !budget && !developerRoleRejected
  return { ok: false, rejectedImage, permissionDenied, modelNotFound, http: status, definitive: modelNotFound, developerRoleRejected,
    rejectedEffort: [200,400,422].includes(status) && effortError && !budget && !developerRoleRejected && !permissionDenied,
    note: developerRoleRejected ? '接口不接受 developer 角色' : permissionDenied ? '当前凭证无权访问此模型，模型可能仍存在' : modelNotFound ? '模型不存在' : budget ? '预算限制，未提高额度' : [404,405].includes(status) ? '接口路径不受支持，模型待确认' : status === 200 ? '流式接口返回错误，待确认' : 'HTTP ' + status }
}
export async function probe(profile, key, id, effort, signal, request = fetch, supportsDeveloperRole = true, image) {
  const responses = profile.api === 'openai-responses'
  const body = responses ? responsesBody(id, effort, supportsDeveloperRole, image) : { model: id, messages: [{ role: supportsDeveloperRole ? 'developer' : 'system', content: 'You are a helpful assistant. Answer briefly.' }, { role: 'user', content: 'Reply with OK.' }], stream: true, max_tokens: LIMITS.outputTokens }
  if (image && !responses) body.messages[1].content = [{ type: 'text', text: image.prompt }, { type: 'image_url', image_url: { url: image.url } }]
  if (signal.aborted) throw Error('扫描已停止')
  if (effort !== undefined && !responses) body.reasoning_effort = effort
  try {
    const response = await request(endpoint(profile.baseURL, responses ? 'responses' : 'chat/completions'), { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.timeoutMs)]), redirect: 'error' })
    const classify = (error, status = 200) => classifyProbeError(typeof error === 'string' ? error : JSON.stringify(error), status, !!image)
    if (!response.ok) return classify(await boundedText(response, 65536), response.status)
    if (responses) return await readResponsesProbe(response, image, classify)
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', bytes = 0, answer = ''
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        bytes += value.length; if (bytes > 1048576) return { ok: false, note: '响应超过扫描大小限制' }
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          if (image && line.slice(5).trim() === '[DONE]') return { ok: matchesImageAnswer(answer, image), http: 200 }
          let chunk; try { chunk = JSON.parse(line.slice(5).trim()) } catch { continue }
          if (chunk.error) return { ok: false, note: '流式接口返回错误' }
          const delta = chunk.choices?.[0]?.delta
          if (image) { if (typeof delta?.content === 'string') answer += delta.content }
          else if (delta?.content || delta?.reasoning_content || delta?.reasoning) return { ok: true, http: 200 }
        }
      }
      if (image && answer) return { ok: matchesImageAnswer(answer, image), http: 200 }
      // Some compatible gateways ignore stream=true and answer JSON.
      try { const json = JSON.parse(buffer); if (typeof json.choices?.[0]?.message?.content === 'string') return { ok: image ? matchesImageAnswer(json.choices[0].message.content, image) : !!json.choices[0].message.content, http: 200 } } catch {}
      return { ok: false, note: '输出上限内无文本，待确认' }
    } finally { await reader.cancel().catch(() => {}) }
  } catch {
    if (signal.aborted) throw Error('扫描已停止')
    return { ok: false, note: '网络、超时或重定向错误，待确认' }
  }
}
export async function scanModel(profile, key, model, signal, request = fetch) {
  if (model.nonText) return { id: model.id, availability: 'non-text', efforts: [], note: '非文本候选，未调用生成接口' }
  if (profile.api !== 'openai-responses' && model.capability?.source && model.capability.source !== 'probe') {
    const efforts = model.capability.reasoning && model.capability.reasoning !== false ? Object.keys(model.capability.reasoning) : []
    return { id: model.id, availability: 'available', efforts, imageInput: { status: model.capability.modalities?.includes('image') ? 'supported' : 'unsupported', note: `能力声明来自 ${model.capability.source}（${model.capability.confidence}）` }, capabilitySource: model.capability.source, capabilityConfidence: model.capability.confidence, listing: { state: 'listed' }, note: '采用能力目录声明，未发起模型探测' }
  }
  const configured = profile.models?.find(entry => entry.id === model.id)
  let supportsDeveloperRole = (configured?.compat?.supportsDeveloperRole ?? profile.compat?.supportsDeveloperRole) !== false
  let adjustedRole = false, fallbackConfirmed = false, calls = 0
  const boundedProbe = async (effort, image) => {
    if (signal.aborted) throw Error('扫描已停止')
    if (calls >= LIMITS.requestsPerModel) return { ok: false, note: '已达请求上限，待确认' }
    calls++
    return probe(profile, key, model.id, effort, signal, request, supportsDeveloperRole, image)
  }
  const call = async effort => {
    let result = await boundedProbe(effort)
    if (result.developerRoleRejected && supportsDeveloperRole) {
      supportsDeveloperRole = false
      result = await boundedProbe(effort)
      // The fallback remains unconfirmed until a valid request succeeds.
      adjustedRole = true
    }
    if (adjustedRole && !supportsDeveloperRole && result.ok) fallbackConfirmed = true
    return result
  }
  const baseline = await call(undefined)
  if (!baseline.ok) {
    if (baseline.definitive) {
      const retry = await call(undefined)
      if (!retry.definitive || retry.http !== baseline.http) return { id: model.id, availability: 'uncertain', efforts: [], listing: { state: 'listed' }, note: '模型不存在尚未重复确认，保留模型' }
      if (retry.definitive && retry.http === baseline.http) return { id: model.id, availability: 'model_not_found', efforts: [], listing: { state: 'pending_removal', outcome: 'model_not_found' }, note: '连续两次确认模型不存在' }
    }
    return { id: model.id, availability: baseline.permissionDenied ? 'permission_denied' : baseline.modelNotFound ? 'model_not_found' : 'uncertain', efforts: [], listing: baseline.modelNotFound ? { state: 'pending_removal', outcome: 'model_not_found' } : { state: 'listed' }, note: baseline.note }
  }
  const invalid = await call('__deepviewer_invalid_effort__')
  const levels = {}
  for (const level of EFFORTS) { if (signal.aborted) throw Error('扫描已停止'); levels[level] = await call(level) }
  // A gateway accepting arbitrary values is not evidence of parameter support.
  const efforts = invalid.rejectedEffort ? EFFORTS.filter(level => levels[level].ok) : []
  const picture = await boundedProbe(undefined, imageChallenge())
  const imageInput = { status: picture.ok ? 'supported' : picture.rejectedImage ? 'unsupported' : 'uncertain', note: picture.ok ? '随机图片识别通过；实际图片效果待验收' : picture.rejectedImage ? '接口明确拒绝图片输入' : '图片能力待确认；保留已有配置' }
  const compat = fallbackConfirmed ? { supportsDeveloperRole: false } : undefined
  return { id: model.id, availability: 'available', efforts, imageInput, listing: { state: 'listed' }, ...(compat ? { compat } : {}), note: efforts.length ? '合法档位通过，非法档位被拒绝；推理效果待实机验收' : Object.values(levels).some(x => /预算/.test(x.note ?? '')) ? '模型可用；档位受预算限制，待确认' : '模型可用；档位是否生效待确认' }
}
export function mergedModels(existing, results, exclude) {
  const result = new Map(results.map(row => [row.id, row])), models = [], seen = new Set()
  for (const model of [...existing, ...results.filter(r => !['model_not_found', 'non-text'].includes(r.availability)).map(r => ({ id: r.id, name: r.id }))]) {
    if (seen.has(model.id)) continue; seen.add(model.id)
    const row = result.get(model.id)
    if (exclude && (row?.availability === 'non-text' || row?.listing?.state === 'delisted' || (row?.availability === 'model_not_found' && !row.listing))) continue
    const copy = { ...model }
    if (row?.compat?.supportsDeveloperRole === false) copy.compat = { ...copy.compat, supportsDeveloperRole: false }
    if (row?.imageInput?.status === 'supported') copy.input = [...new Set([...(copy.input ?? ['text']), 'text', 'image'])]
    if (row?.efforts.length) copy.reasoningEfforts = Object.fromEntries(row.efforts.map(level => [level, level]))
    models.push(copy)
  }
  if (!models.length) throw Error('没有可保留的模型，未修改配置')
  return models
}
