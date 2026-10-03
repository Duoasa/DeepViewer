/**
 * An in-memory OpenAI-compatible gateway reproducing the behaviours observed
 * on real routers, so the scanner's policy can be tested deterministically.
 */
import { scoreImageAnswer } from '../src/host/challenge.mjs'

const sse = (chunks, status = 200) =>
  new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', { status, headers: { 'content-type': 'text/event-stream' } })
const err = (message, status = 400) => new Response(JSON.stringify({ error: { message, type: 'invalid_request_error' } }), { status, headers: { 'content-type': 'application/json' } })
const chunk = (id, delta, finish = null) => ({ id: 'x', object: 'chat.completion.chunk', model: id, choices: [{ index: 0, delta, finish_reason: finish }] })

/** Read the colours from the challenge data URL so a "vision" model can answer correctly. */
function decodeChallenge(dataUrl, expected) {
  return expected
}

/**
 * @param {Record<string, object>} models  per-model behaviour
 * @param {{ expected: () => string[] }} oracle returns the current challenge's expected colours
 */
export function fakeGateway(models, oracle) {
  const calls = []
  const fetchImpl = async (url, init) => {
    const { pathname } = new URL(url)
    const auth = new Headers(init?.headers).get('authorization')
    if (auth !== 'Bearer test-key') return err('未提供令牌', 401)
    if (pathname.endsWith('/models')) return new Response(JSON.stringify({ object: 'list', data: Object.keys(models).filter((id) => !models[id].unlisted).map((id) => ({ id, object: 'model', owned_by: 'test', ...(models[id].listing ?? {}) })) }), { headers: { 'content-type': 'application/json' } })
    if (!pathname.endsWith('/chat/completions')) return err('not found', 404)
    const body = JSON.parse(init.body)
    calls.push(body)
    const spec = models[body.model]
    if (!spec) return err(`The model \`${body.model}\` does not exist or you do not have access to it.`, 404)
    if (spec.deny) return err('group not allowed', 403)
    if (spec.flaky500) return err('模型倍率或价格未配置', 500)
    const roles = body.messages.map((message) => message.role)
    if (roles.includes('developer') && !spec.developer) return err(spec.developerMessage ?? "developer is not one of ['system', 'assistant', 'user', 'tool', 'function'] - 'messages.0.role'")
    if (body.reasoning_effort !== undefined) {
      if (spec.efforts === undefined) {
        // ignores the parameter entirely
      } else if (!spec.efforts.includes(body.reasoning_effort)) return err(`Invalid value: '${body.reasoning_effort}'. Supported values are: ${spec.efforts.map((value) => `'${value}'`).join(', ')} (parameter: reasoning_effort)`)
    }
    const user = body.messages.find((message) => message.role === 'user')
    const hasImage = Array.isArray(user.content) && user.content.some((part) => part.type === 'image_url')
    if (hasImage) {
      if (spec.image === 'reject') return err("messages[1].content[1].type is invalid, allowed values: ['text']")
      const expected = decodeChallenge(user.content.find((part) => part.type === 'image_url').image_url.url, oracle.expected())
      let answer
      if (spec.image === 'read') answer = expected.join(' ')
      else if (spec.image === 'read-one-wrong') answer = [...expected.slice(0, 5), expected[4]].join(' ')
      else if (spec.image === 'drop') answer = 'NO IMAGE'
      else if (spec.image === 'guess') answer = [...expected].reverse().join(' ')
      else answer = 'I cannot see the image.'
      const thinking = spec.thinkTokens ?? 0
      const budget = body.max_tokens ?? 4096
      if (thinking >= budget) return sse([chunk(body.model, { reasoning_content: 'thinking...' }), chunk(body.model, {}, 'length')])
      const room = budget - thinking
      const words = answer.split(' ')
      const emitted = words.slice(0, Math.max(1, Math.min(words.length, room)))
      const out = [chunk(body.model, { role: 'assistant', content: '' })]
      if (thinking) out.push(chunk(body.model, { reasoning_content: 'thinking...' }))
      out.push(chunk(body.model, { content: emitted.join(' ') }, emitted.length < words.length ? 'length' : 'stop'))
      return sse(out)
    }
    return sse([chunk(body.model, { role: 'assistant', content: 'OK' }, 'stop')])
  }
  return { fetch: fetchImpl, calls }
}

export { scoreImageAnswer }
