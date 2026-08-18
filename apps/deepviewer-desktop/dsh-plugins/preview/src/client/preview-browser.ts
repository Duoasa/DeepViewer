export const PREVIEW_BROWSER_MESSAGE_SOURCE = 'deepviewer-preview-browser'
export const PREVIEW_EXTERNAL_QUERY = 'deepviewerExternalPreview'

const STATIC_PREFIX = '/deepviewer-preview-static/'

export interface PreviewBrowserLocation {
  readonly href: string
  readonly title: string
}

export interface PreviewBrowserState {
  readonly entries: readonly PreviewBrowserLocation[]
  readonly index: number
}

export function parsePreviewBrowserLocation(value: unknown): PreviewBrowserLocation | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const message = value as Record<string, unknown>
  if (message.source !== PREVIEW_BROWSER_MESSAGE_SOURCE || message.type !== 'location') return undefined
  if (typeof message.href !== 'string' || typeof message.title !== 'string') return undefined
  return { href: message.href, title: message.title }
}

export function updatePreviewBrowserState(
  state: PreviewBrowserState,
  location: PreviewBrowserLocation,
  pendingIndex: number | null,
): PreviewBrowserState {
  if (pendingIndex !== null && pendingIndex >= 0 && pendingIndex < state.entries.length) {
    const entries = [...state.entries]
    entries[pendingIndex] = location
    return { entries, index: pendingIndex }
  }
  if (state.index >= 0 && state.entries[state.index]?.href === location.href) {
    const entries = [...state.entries]
    entries[state.index] = location
    return { entries, index: state.index }
  }
  const entries = [...state.entries.slice(0, state.index + 1), location]
  return { entries, index: entries.length - 1 }
}

function absoluteUrl(value: string, documentUrl: string): URL | undefined {
  try {
    return new URL(value, documentUrl)
  } catch {
    return undefined
  }
}

export function previewSiteRoot(siteUrl: string, documentUrl: string): string | undefined {
  const url = absoluteUrl(siteUrl, documentUrl)
  if (url === undefined || !url.pathname.startsWith(STATIC_PREFIX)) return undefined
  const suffix = url.pathname.slice(STATIC_PREFIX.length)
  const tokenEnd = suffix.indexOf('/')
  if (tokenEnd <= 0) return undefined
  url.pathname = `${STATIC_PREFIX}${suffix.slice(0, tokenEnd + 1)}`
  url.search = ''
  url.hash = ''
  return url.href
}

export function previewDisplayAddress(href: string): string {
  const url = absoluteUrl(href, 'http://preview.invalid')
  if (url === undefined || !url.pathname.startsWith(STATIC_PREFIX)) return href
  const suffix = url.pathname.slice(STATIC_PREFIX.length)
  const tokenEnd = suffix.indexOf('/')
  if (tokenEnd < 0) return ''
  const encodedPath = suffix.slice(tokenEnd + 1)
  let path = encodedPath
  try {
    path = decodeURIComponent(encodedPath)
  } catch {
    // Keep the encoded path visible rather than hiding an invalid address.
  }
  return `${path}${url.search}${url.hash}`
}

export function resolvePreviewAddress(
  siteRoot: string,
  input: string,
  documentUrl: string,
): string | undefined {
  const value = input.trim()
  if (value === '' || value.startsWith('/') || value.startsWith('\\') || value.includes('\\')) return undefined
  if (/^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//')) return undefined
  const path = value.split(/[?#]/u, 1)[0] ?? ''
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(path)
  } catch {
    return undefined
  }
  if (decodedPath.split('/').some(segment => segment === '..')) return undefined
  const root = absoluteUrl(siteRoot, documentUrl)
  const resolved = absoluteUrl(value, root?.href ?? documentUrl)
  if (root === undefined || resolved === undefined) return undefined
  if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname)) return undefined
  return resolved.href
}

export function externalPreviewUrl(href: string, documentUrl: string): string | undefined {
  const url = absoluteUrl(href, documentUrl)
  if (url === undefined || !url.pathname.startsWith(STATIC_PREFIX)) return undefined
  url.searchParams.set(PREVIEW_EXTERNAL_QUERY, '1')
  return url.href
}
