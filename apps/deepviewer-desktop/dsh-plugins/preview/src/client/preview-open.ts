export interface PreviewOpenRequest {
  readonly revision: number
  readonly absolutePath: string | null
}

let currentRequest: PreviewOpenRequest = { revision: 0, absolutePath: null }
const requestListeners = new Set<() => void>()

export const previewOpenRequests = {
  subscribe(listener: () => void): () => void {
    requestListeners.add(listener)
    return () => { requestListeners.delete(listener) }
  },
  getSnapshot(): PreviewOpenRequest {
    return currentRequest
  },
}

export function requestPreviewFile(absolutePath: string): void {
  currentRequest = { revision: currentRequest.revision + 1, absolutePath }
  for (const listener of requestListeners) listener()
}

export function previewFilePathFromEvent(event: Event): string | undefined {
  const detail = (event as Event & { detail?: unknown }).detail
  return typeof detail === 'string' && detail.trim() !== '' ? detail : undefined
}

/** Convert an absolute native target to the path accepted by the workspace-scoped preview Host. */
export function workspaceRelativePreviewPath(
  workspaceRoot: string | undefined,
  absolutePath: string | null,
): string | undefined {
  if (workspaceRoot === undefined || absolutePath === null) return undefined
  const root = workspaceRoot.replaceAll('\\', '/').replace(/\/+$/u, '')
  const target = absolutePath.replaceAll('\\', '/')
  if (root === '' || !target.startsWith(`${root}/`)) return undefined
  const relative = target.slice(root.length + 1)
  if (relative === '') return undefined
  const segments = relative.split('/')
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) return undefined
  return segments.join('/')
}

/** Directories that must be listed and expanded to reveal a nested file in the tree. */
export function previewParentDirectories(path: string): readonly string[] {
  const directories = ['']
  const parts = path.split('/').slice(0, -1)
  let current = ''
  for (const part of parts) {
    current = current === '' ? part : `${current}/${part}`
    directories.push(current)
  }
  return directories
}
