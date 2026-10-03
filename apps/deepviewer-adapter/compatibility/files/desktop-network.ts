/** DeepViewer desktop-owned transport. The signed-in desktop authorizes local web targets. */
import { WebError } from '@deepseek-ai/dsh-web'
import type { PinnedResponse } from './network.ts'

export function desktopBridgeUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined
  const url = URL.parse(value)
  if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username !== 'deepviewer'
      || !/^[a-f0-9]{64}$/.test(url.password) || !url.port || url.pathname !== '/web-fetch' || url.search || url.hash) {
    throw new WebError('Invalid desktop network bridge configuration', 'WEB_PROVIDER_ERROR')
  }
  return url
}

export async function requestDesktop(url: URL, signal: AbortSignal, configuredBridge: string | undefined): Promise<PinnedResponse | undefined> {
  const bridge = desktopBridgeUrl(configuredBridge)
  if (!bridge) return undefined
  const token = bridge.password
  bridge.username = ''; bridge.password = ''
  const { Agent, fetch } = await import('undici')
  // This is an authenticated loopback control endpoint, never an arbitrary target.
  // proxy-exempt: the desktop itself owns subsequent routing and authorization.
  const dispatcher = new Agent()
  try {
    const response = await fetch(bridge, { method: 'POST', redirect: 'manual', signal, dispatcher,
      headers: { authorization: `Bearer ${token}`, 'x-deepviewer-target': url.href } })
    const code = response.headers.get('x-deepviewer-error')
    if (code) {
      const detail = await response.json() as { message?: string }
      throw new WebError(detail.message ?? `Desktop network error: ${code}`,
        code === 'LOCAL_ACCESS_DENIED' ? 'WEB_BLOCKED_URL' : 'WEB_PROVIDER_ERROR')
    }
    if (response.status === 401 || response.status === 407) {
      // Target HTTP 401 is valid web content; only the bridge's empty 401 lacks target metadata.
      if (!response.headers.has('x-deepviewer-upstream')) {
        await response.body?.cancel()
        throw new WebError('Desktop network bridge authentication failed', 'WEB_PROVIDER_ERROR')
      }
    }
    return { response, close: async () => { await dispatcher.close() } }
  } catch (error) { await dispatcher.destroy(); throw error }
}
