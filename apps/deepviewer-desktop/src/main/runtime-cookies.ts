import { createHash } from 'node:crypto'
import type { Cookies } from 'electron'

/** Cookies ignore ports, while DSH's cookie names include the runtime authority.
 * Retired ephemeral ports otherwise accumulate enough auth cookies to cause 431.
 * Run only before a token-authenticated local launch, in the main UI session.
 */
export async function pruneRetiredRuntimeCookies(cookies: Pick<Cookies, 'get' | 'remove'>, launchUrl: string): Promise<void> {
  const url = new URL(launchUrl)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.searchParams.get('token')) return
  const currentName = 'dsh-auth-' + createHash('sha256').update(url.host).digest('base64url')
  const existing = await cookies.get({ url: url.origin })
  for (const cookie of existing) {
    if (cookie.domain !== '127.0.0.1' || cookie.path !== '/' || !cookie.httpOnly
      || !/^dsh-auth-[A-Za-z0-9_-]{43}$/.test(cookie.name) || cookie.name === currentName) continue
    await cookies.remove(url.origin, cookie.name)
  }
}
