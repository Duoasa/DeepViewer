/** Exact, request-scoped redaction. Secrets never leave the network boundary. */
export function createRedactor(apiKey, headers = {}) {
  const values = [apiKey, ...Object.values(headers)].filter(value => typeof value === 'string' && value.length)
  const needles = [...new Set(values.flatMap(value => [value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)]))].sort((a, b) => b.length - a.length)
  return value => {
    let text = String(value ?? '')
    for (const secret of needles) text = text.split(secret).join('[redacted]')
    return text.replace(/\b(?:sk-[\w.-]{8,}|bearer\s+[^\s"'<>]+)/giu, '[redacted]')
  }
}
