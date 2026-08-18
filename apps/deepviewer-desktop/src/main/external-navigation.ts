export type ExternalUrlOpener = (url: string) => Promise<void>

const PREVIEW_EXTERNAL_QUERY = 'deepviewerExternalPreview'
const PREVIEW_STATIC_PREFIX = '/deepviewer-preview-static/'

export function getExternalWebUrl(targetUrl: string): string | undefined {
  try {
    const url = new URL(targetUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    return url.href
  } catch {
    return undefined
  }
}

export function getExternalPreviewUrl(
  targetUrl: string,
  runtimeOrigin: string | undefined,
): string | undefined {
  if (runtimeOrigin === undefined) return undefined
  try {
    const url = new URL(targetUrl)
    if (url.origin !== runtimeOrigin || !url.pathname.startsWith(PREVIEW_STATIC_PREFIX)) return undefined
    if (url.searchParams.get(PREVIEW_EXTERNAL_QUERY) !== '1') return undefined
    url.searchParams.delete(PREVIEW_EXTERNAL_QUERY)
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
