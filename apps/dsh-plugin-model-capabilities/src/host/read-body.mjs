export class BodyLimitError extends Error {
  constructor() { super('Response exceeded the byte limit'); this.name = 'BodyLimitError' }
}

/** Bound received bytes, including error replies and model listings; cancel on every exit. */
export async function* bodyChunks(response, cap) {
  if (!response.body) return
  const reader = response.body.getReader()
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > cap) throw new BodyLimitError()
      yield value
    }
  } finally { await reader.cancel().catch(() => {}) }
}

export async function boundedText(response, cap) {
  const decoder = new TextDecoder()
  let result = ''
  for await (const chunk of bodyChunks(response, cap)) result += decoder.decode(chunk, { stream: true })
  return result + decoder.decode()
}
