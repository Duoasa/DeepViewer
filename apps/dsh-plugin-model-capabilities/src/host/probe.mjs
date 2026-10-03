/** Bounded wire probes. Every returned provider string is request-scoped and redacted. */
import { classifyError } from './classify.mjs'
import { BodyLimitError, bodyChunks, boundedText } from './read-body.mjs'
import { createRedactor } from './redact.mjs'

export const MAX_BODY_BYTES = 1_048_576
export const MAX_ERROR_BYTES = 65_536
export const MAX_LIST_BYTES = 8 * MAX_BODY_BYTES

export function endpointUrl(baseURL, suffix) {
  const url = new URL(baseURL)
  if (url.username || url.password || url.search || url.hash) throw new Error('baseURL must not carry credentials, a query string or a fragment')
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('remote baseURL must use HTTPS')
  return `${url.href.replace(/\/+$/u, '')}/${suffix}`
}

const INSTRUCTION = 'You are a capability probe. Follow the user instruction exactly and answer as briefly as possible.'
function requestBody(request) {
  const responses = request.api === 'openai-responses'
  const messages = []
  if (request.systemRole !== 'none') messages.push({ role: request.systemRole, content: INSTRUCTION })
  messages.push({ role: 'user', content: request.image
    ? responses
      ? [{ type: 'input_text', text: request.image.prompt }, { type: 'input_image', image_url: request.image.dataUrl }]
      : [{ type: 'text', text: request.image.prompt }, { type: 'image_url', image_url: { url: request.image.dataUrl } }]
    : 'Reply with exactly: OK' })
  if (responses) return { model: request.model, input: messages, stream: true, store: false,
    max_output_tokens: Math.max(16, request.maxOutputTokens), ...(request.effort === undefined ? {} : {
      reasoning: { effort: request.effort, summary: 'auto' }, include: ['reasoning.encrypted_content'],
    }) }
  return { model: request.model, messages, stream: true,
    [request.maxTokensField ?? 'max_tokens']: request.maxOutputTokens,
    ...(request.effort === undefined ? {} : { reasoning_effort: request.effort }) }
}

async function readStream(response, api, context, startedAt, redact) {
  let text = '', sawReasoning = false, finishedByLength = false, completed = false, terminal = false
  let inlineError, malformed = false, incomplete = false
  const snapshot = status => ({ status, http: response.status, text: redact(text), sawReasoning, finishedByLength, durationMs: Date.now() - startedAt })
  const completions = value => {
    if (value.error) { inlineError = value.error; terminal = true; return }
    for (const choice of value.choices ?? []) {
      if (choice.index !== undefined && choice.index !== 0) continue
      const delta = choice.delta ?? choice.message ?? {}
      if (typeof delta.content === 'string') text += delta.content
      else if (Array.isArray(delta.content)) for (const part of delta.content) if (typeof part?.text === 'string') text += part.text
      if (delta.reasoning_content || delta.reasoning) sawReasoning = true
      if (choice.finish_reason) {
        terminal = true
        finishedByLength ||= choice.finish_reason === 'length'
        completed = choice.finish_reason === 'stop'
        incomplete ||= !completed
      }
    }
  }
  const responseObject = value => {
    if (value.error || value.status === 'failed') { inlineError = value.error ?? { message: 'Response failed' }; terminal = true; return }
    terminal = ['completed', 'incomplete', 'cancelled'].includes(value.status)
    completed = value.status === 'completed'
    incomplete = terminal && !completed
    finishedByLength ||= value.status === 'incomplete' && value.incomplete_details?.reason === 'max_output_tokens'
    if (!text) text = (value.output ?? []).flatMap(item => item.type === 'message' ? item.content ?? [] : [])
      .filter(part => part.type === 'output_text').map(part => part.text ?? '').join('')
    if ((value.output ?? []).some(item => item.type === 'reasoning')) sawReasoning = true
  }
  const handle = value => {
    if (!value || typeof value !== 'object') { malformed = true; return }
    if (api !== 'openai-responses') { completions(value); return }
    if (value.type === 'error' || value.type === 'response.failed' || value.error) {
      inlineError = value.response?.error ?? value.error ?? { message: 'Response failed' }; terminal = true; return
    }
    if (value.object === 'response' || (!value.type && value.output)) { responseObject(value); return }
    if (value.type === 'response.output_text.delta' && typeof value.delta === 'string') text += value.delta
    if (['response.reasoning_summary_text.delta', 'response.reasoning_text.delta'].includes(value.type)) sawReasoning = true
    if (['response.completed', 'response.incomplete', 'response.cancelled'].includes(value.type)) responseObject(value.response ?? {})
  }
  let buffer = '', data = []
  const decoder = new TextDecoder()
  let json = response.headers.get('content-type')?.includes('application/json') ?? false
  const flush = () => {
    if (!data.length) return
    const raw = data.join('\n'); data = []
    if (raw === '[DONE]') { if (api !== 'openai-responses') { terminal = true; completed = !incomplete }; return }
    try { handle(JSON.parse(raw)) } catch { malformed = true }
  }
  const line = value => {
    value = value.replace(/\r$/u, '')
    if (!value) flush()
    else if (value.startsWith('data:')) data.push(value.slice(5).trimStart())
  }
  try {
    for await (const chunk of bodyChunks(response, MAX_BODY_BYTES)) {
      buffer += decoder.decode(chunk, { stream: true })
      json ||= buffer.trimStart().startsWith('{')
      if (json) continue
      const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
      for (const value of lines) { line(value); if (terminal) break }
      if (terminal) break
    }
    buffer += decoder.decode()
    if (json) { try { handle(JSON.parse(buffer)) } catch { malformed = true } }
    else if (!terminal) { if (buffer) line(buffer); flush() }
  } catch (error) {
    if (error instanceof BodyLimitError) return snapshot('truncated')
    throw error
  }
  if (inlineError) return { ...snapshot('error'), error: classifyError(redact(typeof inlineError === 'string' ? inlineError : JSON.stringify(inlineError)), response.status, context) }
  if (malformed) return snapshot('malformed')
  if (!completed || finishedByLength || !text.trim()) return snapshot('incomplete')
  return snapshot('ok')
}

export async function probe(request, fetchImpl = fetch) {
  const startedAt = Date.now()
  const redact = createRedactor(request.apiKey, request.headers)
  const context = { image: Boolean(request.image), effort: request.effort !== undefined, developer: request.systemRole === 'developer' }
  const failed = (status, cause, http = 0) => ({ status, http, text: '', sawReasoning: false, finishedByLength: false,
    durationMs: Date.now() - startedAt, error: { kind: 'unknown', status: http, excerpt: redact(cause instanceof Error ? cause.message : cause).slice(0, 200) } })
  if (request.signal.aborted) return failed('aborted', 'Scan cancelled')
  try {
    const headers = new Headers(request.headers ? Object.entries(request.headers) : undefined)
    headers.set('authorization', `Bearer ${request.apiKey}`)
    headers.set('content-type', 'application/json')
    headers.set('accept', 'text/event-stream, application/json')
    const response = await fetchImpl(endpointUrl(request.baseURL, request.api === 'openai-responses' ? 'responses' : 'chat/completions'), {
      method: 'POST', headers, body: JSON.stringify(requestBody(request)),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(request.timeoutMs)]), redirect: 'error',
    })
    if (!response.ok) {
      let body
      try { body = await boundedText(response, MAX_ERROR_BYTES) }
      catch (error) { if (error instanceof BodyLimitError) return failed('truncated', error, response.status); throw error }
      return { ...failed('error', '', response.status), error: classifyError(redact(body), response.status, context) }
    }
    return await readStream(response, request.api, context, startedAt, redact)
  } catch (cause) { return failed(request.signal.aborted ? 'aborted' : 'network', cause) }
}

export async function listModels(request, fetchImpl = fetch) {
  const redact = createRedactor(request.apiKey, request.headers)
  try {
    const headers = new Headers(request.headers ? Object.entries(request.headers) : undefined)
    headers.set('authorization', `Bearer ${request.apiKey}`); headers.set('accept', 'application/json')
    const response = await fetchImpl(endpointUrl(request.baseURL, 'models'), { method: 'GET', headers,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(request.timeoutMs)]), redirect: 'error' })
    if (!response.ok) { await response.body?.cancel(); return { ok: false, http: response.status, reason: `HTTP ${response.status}` } }
    const text = await boundedText(response, MAX_LIST_BYTES)
    let body
    try { body = JSON.parse(text) } catch { return { ok: false, http: response.status, reason: 'listing is not JSON' } }
    const entries = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data
      : body?.models && typeof body.models === 'object' ? Object.entries(body.models).map(([id, entry]) => ({ id, ...(entry && typeof entry === 'object' ? entry : {}) })) : undefined
    if (!entries) return { ok: false, http: response.status, reason: 'listing has no data array' }
    // Never accept a model id containing a reflected credential, or persist arbitrary listing text.
    return { ok: true, entries: entries.filter(entry => typeof entry?.id === 'string' && entry.id.trim() && entry.id.length <= 256 && redact(entry.id) === entry.id) }
  } catch (cause) { return { ok: false, reason: redact(cause instanceof Error ? cause.message : 'network error').slice(0, 200) } }
}
