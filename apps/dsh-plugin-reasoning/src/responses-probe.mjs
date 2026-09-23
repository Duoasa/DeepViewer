/** Responses wire adapter. Only synthetic prompts/images are sent; never persist output. */
import { matchesImageAnswer } from './image-challenge.mjs'
export const RESPONSES_OUTPUT_TOKENS = 64
export function responsesBody(id, effort, supportsDeveloperRole, image) {
  return {
    model: id, stream: true, store: false, max_output_tokens: RESPONSES_OUTPUT_TOKENS,
    input: [
      { role: supportsDeveloperRole ? 'developer' : 'system', content: 'You are a helpful assistant. Answer briefly.' },
      { role: 'user', content: image ? [{ type: 'input_text', text: image.prompt }, { type: 'input_image', image_url: image.url }] : 'Reply with OK.' },
    ],
    ...(effort === undefined ? {} : { reasoning: { effort } }),
  }
}
export async function readResponsesProbe(response, image, classifyError) {
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', bytes = 0, answer = '', data = [], terminal
  const uncertain = note => ({ ok: false, note })
  const outcome = value => {
    if (value.error || value.status === 'failed') return classifyError(value.error ?? {})
    if (value.status === 'incomplete') return uncertain('输出预算不足或响应未完成，待确认')
    if (value.status !== 'completed') return uncertain('未收到完成响应，待确认')
    const text = (value.output ?? []).flatMap(item => item.type === 'message' ? item.content ?? [] : [])
      .filter(part => part.type === 'output_text').map(part => part.text ?? '').join('') || answer
    return { ok: image ? matchesImageAnswer(text, image) : !!text.trim(), http: 200 }
  }
  const event = value => {
    if (value.type === 'error' || value.type === 'response.failed') return classifyError(value.response?.error ?? value.error ?? value)
    if (value.type === 'response.output_text.delta' && typeof value.delta === 'string') answer += value.delta
    if (['response.completed', 'response.incomplete'].includes(value.type)) return outcome(value.response ?? {})
  }
  const flush = () => {
    if (!data.length) return
    const raw = data.join('\n'); data = []
    if (raw === '[DONE]') return
    try { terminal ??= event(JSON.parse(raw)) } catch { /* malformed events cannot prove success */ }
  }
  const line = value => {
    value = value.replace(/\r$/, '')
    if (!value) flush()
    else if (value.startsWith('data:')) data.push(value.slice(5).trimStart())
  }
  try {
    // Some compatible providers ignore stream=true and return JSON.
    const json = response.headers.get('content-type')?.includes('application/json')
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > 1048576) return uncertain('响应超过扫描大小限制')
      buffer += decoder.decode(value, { stream: true })
      if (!json) {
        // Retain JSON fallback in full even when it is pretty-printed.
        if (buffer.trimStart().startsWith('{')) continue
        const lines = buffer.split('\n'); buffer = lines.pop()
        for (const value of lines) line(value)
        if (terminal) return terminal
      }
    }
    buffer += decoder.decode()
    if (json || buffer.trimStart().startsWith('{')) {
      try { return outcome(JSON.parse(buffer)) } catch { return uncertain('响应格式不受支持，待确认') }
    }
    if (buffer) line(buffer)
    flush()
    return terminal ?? uncertain('响应中断或未收到完成事件，待确认')
  } finally { await reader.cancel().catch(() => {}) }
}
