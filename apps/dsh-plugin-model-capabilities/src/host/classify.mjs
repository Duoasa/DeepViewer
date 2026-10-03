/**
 * Turn a provider error reply into a verdict the scanner can act on.
 *
 * Gateways front many upstreams and each phrases the same refusal
 * differently, so every class here is matched by a *family* of phrasings,
 * in English and Chinese. The classifier is deliberately conservative:
 * an unrecognised error is `uncertain`, never a definitive verdict.
 *
 * @module dsh-plugin-model-capabilities/host/classify
 */

/**
 * @typedef {'developer_role' | 'image_rejected' | 'effort_rejected' | 'model_not_found' | 'permission_denied' | 'rate_limited' | 'budget' | 'server_error' | 'unknown'} ErrorKind
 */

/**
 * @typedef {object} ErrorVerdict
 * @property {ErrorKind} kind
 * @property {number} status HTTP status (200 when the error rode inside a 200 body)
 * @property {string} excerpt a short, sanitised excerpt of the provider message for the report
 */

/** Regular expressions per family. Kept together so a new gateway phrasing is one edit. */
const PATTERNS = {
  developerRole: [
    /developer.{0,160}role/isu,
    /role.{0,160}developer/isu,
    /\bdeveloper\b.{0,80}(?:not one of|not (?:a )?valid|invalid|unknown|unsupported|not support|not allowed|unexpected)/isu,
    /(?:unknown|invalid|unsupported|unexpected)(?: value)?:?\s*['"]?developer['"]?/iu,
    /角色(?:信息)?(?:不正确|无效|不支持|错误)/u,
  ],
  imageRejected: [
    /(?:image|vision|multimodal|multi-modal|图片|图像|视觉|多模态).{0,80}(?:not support|unsupported|not allowed|not accept|cannot|can't|only support|text.?only|不支持|无法|仅支持|只支持)/iu,
    /(?:not support|unsupported|does not support|do not support|cannot|can't|only support|不支持|无法|仅支持|只支持).{0,80}(?:image|vision|multimodal|multi-modal|图片|图像|视觉|多模态)/iu,
    /\btype\b.{0,60}(?:invalid|not allowed|unsupported|非法|不合法|无效).{0,60}\[?['"]?text['"]?\]?/iu,
    /(?:allowed values?|取值范围|可选值|允许的值).{0,20}\[?['"]?text['"]?\]?\s*$/iu,
    /content.{0,30}(?:must be|should be) (?:a )?string/iu,
    /image_url.{0,60}(?:invalid|not (?:a )?valid|unsupported|not support)/iu,
  ],
  /** Complaints about the *image payload* (format/size/url), which say nothing about model support. */
  imagePayload: [/\b(?:mime|format|resolution|too large|size limit|decode|base64|data.?uri|fetch|download|timeout)\b/iu],
  effortRejected: [/reasoning[_.\s-]?effort/iu, /__dsh_invalid_effort__/u, /\beffort\b.{0,60}(?:invalid|not (?:a )?valid|unsupported|not support|must be one of|not one of)/iu, /(?:invalid|unsupported|unknown).{0,40}(?:thinking|reasoning)/iu],
  modelNotFound: [/model[_\s-]?not[_\s-]?found/iu, /unknown model/iu, /model.{0,160}(?:does not exist|not (?:found|exist)|is not available|invalid model)/iu, /no such model/iu, /模型(?:不存在|未找到|无效)/u, /invalid model (?:id|name)/iu],
  permissionDenied: [/insufficient[_\s-]?quota/iu, /group not allowed/iu, /permission denied/iu, /\bforbidden\b/iu, /\bunauthori[sz]ed\b/iu, /invalid (?:api[_\s-]?key|token)/iu, /未提供令牌|令牌无效|无权|余额不足|权限/u, /not (?:allowed|permitted) to (?:use|access)/iu],
  rateLimited: [/rate[_\s-]?limit/iu, /too many requests/iu, /\bquota exceeded\b/iu, /请求过于频繁|限流|并发/u, /\b429\b/u],
  budget: [/max_tokens|max_completion_tokens|max_output_tokens/iu, /\bbudget\b/iu, /token limit/iu, /context length/iu],
  ratioNotSet: [/倍率或价格未配置/u, /ratio or price not set/iu],
}

const some = (patterns, text) => patterns.some((pattern) => pattern.test(text))

/**
 * Produce a compact excerpt of the provider message for the human report.
 * @param {string} text
 */
export function errorExcerpt(text) {
  let message = text
  try {
    const parsed = JSON.parse(text)
    message = parsed?.error?.message ?? parsed?.message ?? parsed?.error?.msg ?? parsed?.msg ?? (typeof parsed?.error === 'string' ? parsed.error : text)
  } catch {
    // plain text
  }
  return String(message).replace(/\s+/gu, ' ').replace(/(?:sk|Bearer)[-\s][A-Za-z0-9._-]{8,}/gu, '[redacted]').slice(0, 200)
}

/**
 * Classify one error body.
 * @param {string} text raw response body (JSON or text)
 * @param {number} status HTTP status
 * @param {{ image?: boolean, effort?: boolean, developer?: boolean }} [context] what the failing request carried (`developer`: the instruction used role "developer"; when omitted the role pattern is still consulted)
 * @returns {ErrorVerdict}
 */
export function classifyError(text, status, context = {}) {
  const body = String(text ?? '')
  const excerpt = errorExcerpt(body)
  const done = (kind) => ({ kind, status, excerpt })

  if (status === 429 || some(PATTERNS.rateLimited, body)) return done('rate_limited')
  if (status === 401 || status === 403 || some(PATTERNS.permissionDenied, body)) return done('permission_denied')
  if (status >= 500 || some(PATTERNS.ratioNotSet, body)) return done('server_error')

  const clientError = status === 400 || status === 422 || status === 404 || status === 200
  if (clientError && context.developer !== false && some(PATTERNS.developerRole, body)) return done('developer_role')
  if (clientError && context.effort && some(PATTERNS.effortRejected, body)) return done('effort_rejected')
  if (clientError && context.image && some(PATTERNS.imageRejected, body) && !some(PATTERNS.imagePayload, body)) return done('image_rejected')
  if (clientError && some(PATTERNS.modelNotFound, body)) return done('model_not_found')
  if (clientError && some(PATTERNS.budget, body)) return done('budget')
  return done('unknown')
}
