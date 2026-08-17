export type ExternalUrlOpener = (url: string) => Promise<void>

export function getExternalWebUrl(targetUrl: string): string | undefined {
  try {
    const url = new URL(targetUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    return url.href
  } catch {
    return undefined
  }
}

export async function openExternalWebUrl(
  targetUrl: string,
  openExternal: ExternalUrlOpener,
): Promise<boolean> {
  const externalUrl = getExternalWebUrl(targetUrl)
  if (externalUrl === undefined) return false
  await openExternal(externalUrl)
  return true
}
