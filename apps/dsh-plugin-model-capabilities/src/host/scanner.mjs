/**
 * Per-model capability scan.
 *
 * Policy: find a working request configuration first. Catalogs suggest capabilities;
 * successful wire probes and a final combined request determine what is applied.
 * - Validate developer unless explicitly disabled; a verified system fallback
 *   is persisted so actual pi-ai conversations use the same accepted role.
 * - The image probe gets a real output budget (and, for reasoning models,
 *   a second, larger attempt) because a six-word answer cannot fit in one
 *   token.
 * - Unverified optional capabilities fall back to a verified text configuration.
 *   Applying the report may replace earlier manual capability settings.
 *
 * @module dsh-plugin-model-capabilities/host/scanner
 */
import { createImageChallenge, scoreImageAnswer } from './challenge.mjs'
import { isNonTextEntry, resolveHint } from './catalog.mjs'
import { probe } from './probe.mjs'

/** Thinking levels llm-pi-ai accepts in `reasoningEfforts`, in rank order. */
export const THINKING_LEVELS = Object.freeze(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
/** Levels probed over the wire; the OpenAI `reasoning_effort` vocabulary. */
export const PROBED_EFFORTS = Object.freeze(['low', 'medium', 'high'])
const INVALID_EFFORT = '__dsh_invalid_effort__'

/** Default budget, overridable through plugin config. */
export const DEFAULT_LIMITS = Object.freeze({
  models: 200,
  concurrency: 2,
  timeoutMs: 20_000,
  imageTimeoutMs: 60_000,
  requestsPerModel: 12,
  textOutputTokens: 8,
  textRetryOutputTokens: 1024,
  imageOutputTokens: 96,
  imageRetryOutputTokens: 1024,
  probeEfforts: true,
})

/**
 * @typedef {object} ScanTarget
 * @property {string} id
 * @property {object} [listing] the `/models` entry, when listed
 * @property {object} [configured] the stored model profile, when configured
 */

/**
 * @typedef {object} Verdict
 * @property {'supported' | 'unsupported' | 'uncertain'} status
 * @property {'probe' | 'listing' | 'pi-ai-catalog' | 'name' | 'none'} source
 * @property {string} note
 */

/**
 * @typedef {object} ModelScanResult
 * @property {string} id
 * @property {'available' | 'permission_denied' | 'model_not_found' | 'non-text' | 'uncertain'} availability
 * @property {Verdict} image
 * @property {{ status: 'confirmed' | 'unconfirmed' | 'unsupported' | 'uncertain'; levels: string[]; source: string; note: string }} reasoning
 * @property {{ supportsDeveloperRole?: boolean }} [compat]
 * @property {number} requests
 * @property {number} [http]
 * @property {string} note
 */

/**
 * Turn probed/declared level names into the `reasoningEfforts` dict
 * llm-pi-ai accepts, or `undefined` when nothing beyond `off` is offered.
 * @param {readonly string[]} levels
 */
export function effortsDict(levels) {
  const known = THINKING_LEVELS.filter((level) => levels.includes(level))
  if (!known.some((level) => level !== 'off')) return undefined
  return Object.fromEntries(known.map((level) => [level, level === 'off' ? null : level]))
}

const noteFor = {
  zh: {
    nonText: '非文本模型（嵌入 / 语音 / 图像生成等），未调用对话接口',
    notFound: '接口明确返回模型不存在',
    denied: '当前凭证无权访问此模型；模型保留',
    rateLimited: '被限流，未能完成探测；保留现有配置',
    serverError: '服务端错误，未能完成探测；保留现有配置',
    network: '网络错误或超时；保留现有配置',
    available: '模型可用',
  },
}

/**
 * Scan one model.
 * @param {{ baseURL: string; api: 'openai-completions' | 'openai-responses'; apiKey: string; headers?: Record<string, string>; compat?: { supportsDeveloperRole?: boolean } }} route
 * @param {ScanTarget} target
 * @param {{ catalog: import('./catalog.mjs').CatalogEntry[]; limits: typeof DEFAULT_LIMITS; signal: AbortSignal; fetch?: typeof fetch; challenge?: () => import('./challenge.mjs').ImageChallenge }} options
 * @returns {Promise<ModelScanResult>}
 */
export async function scanModel(route, target, options) {
  const { catalog, limits, signal } = options
  const fetchImpl = options.fetch ?? fetch
  const hint = resolveHint({ id: target.id, listing: target.listing, catalog })
  const zh = noteFor.zh
  let requests = 0

  if (target.listing && isNonTextEntry(target.listing) && !target.configured) {
    return { id: target.id, availability: 'non-text', image: { status: 'uncertain', source: 'listing', note: zh.nonText }, reasoning: { status: 'uncertain', levels: [], source: 'listing', note: zh.nonText }, requests, note: zh.nonText }
  }

  // --- role strategy -------------------------------------------------------
  const configuredDeveloper = target.configured?.compat?.supportsDeveloperRole ?? route.compat?.supportsDeveloperRole
  /** @type {'system' | 'developer'} */
  let role = configuredDeveloper === false ? 'system' : 'developer'
  let developerVerdict = configuredDeveloper === false ? false : undefined
  let maxTokensField = target.configured?.compat?.maxTokensField ?? route.compat?.maxTokensField ?? 'max_tokens'
  let textBudget = limits.textOutputTokens
  let finalizing = false

  const send = async (extra) => {
    if (signal.aborted) throw new Error('aborted')
    // Reserve final verification, image-without-effort recovery, and text recovery.
    if (requests >= limits.requestsPerModel - (finalizing ? 0 : Math.min(3, Math.max(0, limits.requestsPerModel - 2)))) return { status: 'budget-exhausted', text: '', sawReasoning: false, finishedByLength: false, durationMs: 0 }
    requests++
    return probe({ baseURL: route.baseURL, api: route.api, apiKey: route.apiKey, headers: { ...route.headers, ...target.configured?.headers }, maxTokensField, model: target.id, systemRole: role, timeoutMs: limits.timeoutMs, signal, maxOutputTokens: textBudget, ...extra }, fetchImpl)
  }
  /** Send, and if the instruction role is refused, switch roles once and resend. */
  const sendWithRoleFallback = async (extra) => {
    let outcome = await send(extra)
    if (outcome.status === 'error' && outcome.error?.kind === 'developer_role' && role === 'developer') {
      role = 'system'
      developerVerdict = false
      outcome = await send(extra)
    }
    return outcome
  }

  // --- 1. availability -----------------------------------------------------
  let baseline = await sendWithRoleFallback({})
  if (baseline.status === 'error' && baseline.error?.kind === 'budget' && route.api === 'openai-completions') {
    maxTokensField = maxTokensField === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'
    baseline = await sendWithRoleFallback({})
  }
  if (baseline.status === 'incomplete' && (baseline.finishedByLength || baseline.sawReasoning)) {
    textBudget = Math.max(textBudget, limits.textRetryOutputTokens ?? 1024)
    baseline = await sendWithRoleFallback({})
  }
  const fail = (availability, note, http) => ({
    id: target.id,
    availability,
    image: { status: 'uncertain', source: 'none', note },
    reasoning: { status: 'uncertain', levels: [], source: 'none', note },
    requests,
    http,
    note,
  })
  if (baseline.status === 'aborted') throw new Error('aborted')
  if (baseline.status === 'network') return fail('uncertain', zh.network)
  if (baseline.status === 'error') {
    const kind = baseline.error?.kind
    if (kind === 'model_not_found') {
      // Confirm once more before trusting a "not found".
      const again = await send({})
      if (again.status === 'error' && again.error?.kind === 'model_not_found') return fail('model_not_found', zh.notFound, baseline.http)
      return fail('uncertain', `模型不存在仅出现一次，未确认：${baseline.error?.excerpt ?? ''}`, baseline.http)
    }
    if (kind === 'permission_denied') return fail('permission_denied', `${zh.denied}（${baseline.error?.excerpt ?? ''}）`, baseline.http)
    if (kind === 'rate_limited') return fail('uncertain', zh.rateLimited, baseline.http)
    if (kind === 'server_error') return fail('uncertain', `${zh.serverError}（${baseline.error?.excerpt ?? ''}）`, baseline.http)
    return fail('uncertain', `HTTP ${baseline.http ?? '?'}：${baseline.error?.excerpt ?? '未识别的错误'}`, baseline.http)
  }
  if (baseline.status !== 'ok') return fail('uncertain', `响应异常（${baseline.status}）；保留现有配置`, baseline.http)
  if (role === 'developer' && developerVerdict === undefined) developerVerdict = true

  // --- 2. image input ------------------------------------------------------
  // Two independent challenges may be spent: the second is a retry when the first
  // read was cut short (budget / thinking) or was partial but clearly above chance.
  // Guessing scores ≥ 4/6 with probability ≈ 0.9 %; two such scores in a row ≈ 0.008 %.
  const PARTIAL_FLOOR = 3
  const CONSISTENT_FLOOR = 4
  const newChallenge = options.challenge ?? createImageChallenge
  const imageProbe = async (challenge, maxOutputTokens) =>
    sendWithRoleFallback({ image: { dataUrl: challenge.dataUrl, prompt: challenge.prompt }, maxOutputTokens, timeoutMs: limits.imageTimeoutMs ?? limits.timeoutMs })
  let challenge = newChallenge()
  let picture = await imageProbe(challenge, limits.imageOutputTokens)
  let score = picture.status === 'ok' ? scoreImageAnswer(picture.text, challenge) : undefined
  let firstCorrect = score?.correct ?? 0
  const needsRetry =
    (['ok', 'incomplete'].includes(picture.status) && !score?.matched && !score?.sawNoImage && (picture.finishedByLength || picture.sawReasoning || !picture.text.trim() || (score?.correct ?? 0) >= PARTIAL_FLOOR)) ||
    picture.status === 'network'
  if (needsRetry) {
    const second = newChallenge()
    const retry = await imageProbe(second, limits.imageRetryOutputTokens)
    if (retry.status === 'ok') {
      const retryScore = scoreImageAnswer(retry.text, second)
      const consistent = firstCorrect >= CONSISTENT_FLOOR && retryScore.correct >= CONSISTENT_FLOOR
      picture = retry
      challenge = second
      score = consistent ? { ...retryScore, matched: true, correct: Math.min(firstCorrect, retryScore.correct) } : retryScore
    } else if (retry.status === 'error') {
      picture = retry
      score = undefined
    }
  }
  /** @type {Verdict} */
  let image
  if (picture.status === 'ok' && score?.matched) {
    image = { status: 'supported', source: 'probe', note: `随机色块 ${score.correct}/${challenge.expected.length} 识别正确${needsRetry ? '（两次独立挑战）' : ''}` }
  } else if (picture.status === 'error' && picture.error?.kind === 'image_rejected') {
    image = { status: 'unsupported', source: 'probe', note: `接口拒绝图片输入：${picture.error.excerpt}` }
  } else {
    const noImage = score?.sawNoImage
    image = { status: 'uncertain', source: 'probe', note: noImage
      ? '模型回答未看到图片，尚不足以确认不支持；保留现有配置'
      : '图片探测未得出有效结论；保留现有配置' }
  }

  // --- 3. reasoning efforts ------------------------------------------------
  let reasoning = { status: 'uncertain', levels: [], source: 'none', note: '未探测思考档位' }
  if (limits.probeEfforts) {
    const invalid = await send({ effort: INVALID_EFFORT })
    if (invalid.status === 'error' && invalid.error?.kind === 'effort_rejected') {
      const accepted = []
      for (const level of PROBED_EFFORTS) {
        const outcome = await send({ effort: level })
        if (outcome.status === 'ok') accepted.push(level)
      }
      reasoning = accepted.length
        ? { status: 'confirmed', levels: accepted, source: 'probe', note: '非法档位被拒绝且合法档位通过' }
        : { status: 'uncertain', levels: [], source: 'probe', note: '非法档位被拒绝，但合法档位均未通过' }
    } else if (invalid.status === 'ok' || invalid.status === 'budget-exhausted') {
      reasoning = { status: 'unconfirmed', levels: [], source: 'probe', note: '未验证档位参数生效；保留现有配置' }
    } else {
      reasoning = { status: 'uncertain', levels: [], source: 'probe', note: `档位探测未得出结论（${invalid.error?.excerpt ?? invalid.status}）` }
    }
  }

  // Match pi-ai: non-reasoning models always send system, even when developer is accepted.
  // Validate the chosen image+effort combination as well as their independent probes.
  finalizing = true
  let useImage = image.status === 'supported'
  let useReasoning = reasoning.status === 'confirmed'
  role = useReasoning && developerVerdict !== false ? 'developer' : 'system'
  const finalChallenge = useImage ? newChallenge() : undefined
  let final = await sendWithRoleFallback({
    ...(finalChallenge ? { image: finalChallenge, timeoutMs: limits.imageTimeoutMs } : {}),
    maxOutputTokens: Math.max(textBudget, useImage || useReasoning ? limits.imageRetryOutputTokens : textBudget),
    ...(useReasoning ? { effort: reasoning.levels[0] } : {}),
  })
  let validFinal = final.status === 'ok' && (!finalChallenge || scoreImageAnswer(final.text, finalChallenge).matched)
  if (!validFinal && useImage && useReasoning) {
    // Retain working vision when only the combined reasoning request failed.
    useReasoning = false; role = 'system'
    final = await send({ image: finalChallenge, timeoutMs: limits.imageTimeoutMs, maxOutputTokens: limits.imageRetryOutputTokens })
    validFinal = final.status === 'ok' && scoreImageAnswer(final.text, finalChallenge).matched
  }
  if (!validFinal) {
    useImage = false; useReasoning = false; role = 'system'
    final = await send({ maxOutputTokens: textBudget })
    if (final.status !== 'ok') return fail('uncertain', '未找到可由当前运行时复现的可用配置，请检查模型或提高探测预算', final.http)
  }
  developerVerdict = role === 'developer'
  const compat = { supportsDeveloperRole: developerVerdict,
    ...(route.api === 'openai-completions' ? { maxTokensField, supportsStore: false, supportsUsageInStreaming: false,
      thinkingFormat: 'openai', supportsReasoningEffort: useReasoning, supportsThinkingTokenBudget: false } : {}) }
  const recommended = { input: useImage ? ['text', 'image'] : ['text'],
    reasoningEfforts: useReasoning ? { off: null, ...effortsDict(reasoning.levels) } : false, compat,
    minOutputTokens: Math.max(textBudget, useImage || useReasoning ? limits.imageRetryOutputTokens : textBudget) }
  return {
    id: target.id,
    availability: 'available',
    image,
    reasoning,
    hint,
    recommended,
    ...(compat ? { compat } : {}),
    requests,
    http: 200,
    note: !useImage || !useReasoning ? '已验证可用配置；未通过的图片或思考档位将降级，应用时覆盖旧能力设置' : '图片与思考组合已验证可用',
  }
}
