/** Include transport error codes without leaking endpoint URLs, proxy credentials or headers. */
export function searchNetworkError(error: unknown): string {
  const codes = new Set<string>()
  const visited = new Set<unknown>()
  function inspect(value: unknown, depth: number): void {
    if (!value || typeof value !== 'object' || visited.has(value) || depth > 5) return
    visited.add(value)
    const record = value as { code?: unknown; cause?: unknown; errors?: unknown }
    if (typeof record.code === 'string' && /^(E[A-Z0-9_]+|UND_ERR_[A-Z0-9_]+|CERT_[A-Z0-9_]+|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_[A-Z_]+)$/.test(record.code)) codes.add(record.code)
    inspect(record.cause, depth + 1)
    if (Array.isArray(record.errors)) for (const child of record.errors.slice(0, 8)) inspect(child, depth + 1)
  }
  inspect(error, 0)
  const suffix = [...codes].join(', ')
  return `Network request failed${suffix ? ` [${suffix}]` : ''}. Check the active network/proxy route. / 网络请求失败，请检查当前网络或代理连接。`
}
