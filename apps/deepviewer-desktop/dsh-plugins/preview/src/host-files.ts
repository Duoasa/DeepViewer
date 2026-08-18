import { randomBytes } from 'node:crypto'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

export const MAX_PREVIEW_FILE_BYTES = 1024 * 1024
export const MAX_DIRECTORY_ENTRIES = 1000
const CAPABILITY_TTL_MS = 30 * 60 * 1000
const MAX_CAPABILITIES = 32

export const PREVIEW_NAVIGATION_BRIDGE = `<script>(()=>{const s='deepviewer-preview-browser';const report=()=>parent.postMessage({source:s,type:'location',href:location.href,title:document.title},'*');addEventListener('message',event=>{if(event.source!==parent||event.data?.source!==s||event.data?.type!=='command')return;switch(event.data.command){case'back':history.back();break;case'forward':history.forward();break;case'reload':location.reload();break}});addEventListener('pageshow',report);addEventListener('popstate',report);addEventListener('hashchange',report);const push=history.pushState.bind(history);history.pushState=(...args)=>{push(...args);queueMicrotask(report)};const replace=history.replaceState.bind(history);history.replaceState=(...args)=>{replace(...args);queueMicrotask(report)};queueMicrotask(report)})()</script>`

export interface PreviewEntry {
  readonly name: string
  readonly path: string
  readonly kind: 'file' | 'directory'
}

export interface PreviewFile {
  readonly path: string
  readonly content: string
  readonly size: number
  readonly mtimeMs: number
  readonly language: string
}

export interface StaticCapability {
  readonly token: string
  readonly root: string
  readonly entry: string
  readonly expiresAt: number
}

const BLOCKED_NAMES = new Set([
  '.git', '.hg', '.svn', 'node_modules', '.npmrc', '.pypirc',
  'id_rsa', 'id_ed25519',
])
const BLOCKED_EXTENSIONS = new Set(['.key', '.pem', '.p12', '.pfx', '.crt', '.cer'])

function segments(path: string): string[] {
  if (path.includes('\\') || path.includes('\0') || isAbsolute(path)) {
    throw new Error('preview path must be a workspace-relative POSIX path')
  }
  const values = path === '' ? [] : path.split('/')
  if (values.some(value => value === '' || value === '.' || value === '..')) {
    throw new Error('preview path contains an invalid segment')
  }
  return values
}

export function isBlockedPreviewPath(path: string): boolean {
  return segments(path).some((segment) => {
    const lower = segment.toLowerCase()
    return BLOCKED_NAMES.has(lower)
      || lower === '.env'
      || lower.startsWith('.env.')
      || BLOCKED_EXTENSIONS.has(extname(lower))
  })
}

function isWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))
}

/** Resolve an existing path only after both lexical and realpath containment checks. */
export async function resolvePreviewPath(workspaceRoot: string, path: string): Promise<{ root: string; path: string }> {
  if (isBlockedPreviewPath(path)) throw new Error('preview access to this path is blocked')
  const root = await realpath(workspaceRoot)
  const lexical = resolve(root, ...segments(path))
  if (!isWithin(root, lexical)) throw new Error('preview path escapes its workspace')
  const canonical = await realpath(lexical)
  if (!isWithin(root, canonical)) throw new Error('preview symlink escapes its workspace')
  return { root, path: canonical }
}

export async function listPreviewDirectory(workspaceRoot: string, path: string): Promise<PreviewEntry[]> {
  const target = await resolvePreviewPath(workspaceRoot, path)
  if (!(await stat(target.path)).isDirectory()) throw new Error('preview path is not a directory')
  const entries = await readdir(target.path, { withFileTypes: true })
  const output: PreviewEntry[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (output.length >= MAX_DIRECTORY_ENTRIES) break
    const childPath = path === '' ? entry.name : `${path}/${entry.name}`
    if (isBlockedPreviewPath(childPath)) continue
    try {
      const resolved = await resolvePreviewPath(workspaceRoot, childPath)
      const info = await stat(resolved.path)
      if (!info.isFile() && !info.isDirectory()) continue
      output.push({ name: entry.name, path: childPath, kind: info.isDirectory() ? 'directory' : 'file' })
    } catch {
      // Broken links, unreadable entries, and links leaving the workspace are invisible.
    }
  }
  return output.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name)
  })
}

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.c': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.cs': 'csharp', '.css': 'css',
  '.go': 'go', '.html': 'html', '.java': 'java', '.js': 'javascript', '.jsx': 'jsx',
  '.json': 'json', '.md': 'markdown', '.mjs': 'javascript', '.py': 'python',
  '.rb': 'ruby', '.rs': 'rust', '.sh': 'bash', '.sql': 'sql', '.swift': 'swift',
  '.toml': 'toml', '.ts': 'typescript', '.tsx': 'tsx', '.vue': 'vue', '.xml': 'xml',
  '.yaml': 'yaml', '.yml': 'yaml',
}

export function languageForPath(path: string): string {
  return LANGUAGE_BY_EXTENSION[extname(path).toLowerCase()] ?? 'text'
}

export async function readPreviewFile(workspaceRoot: string, path: string): Promise<PreviewFile> {
  const target = await resolvePreviewPath(workspaceRoot, path)
  const info = await stat(target.path)
  if (!info.isFile()) throw new Error('preview path is not a file')
  if (info.size > MAX_PREVIEW_FILE_BYTES) throw new Error('preview file exceeds the 1 MiB limit')
  const bytes = await readFile(target.path)
  if (bytes.includes(0)) throw new Error('binary files cannot be previewed as code')
  return {
    path,
    content: bytes.toString('utf8'),
    size: info.size,
    mtimeMs: info.mtimeMs,
    language: languageForPath(path),
  }
}

export class PreviewCapabilities {
  readonly #entries = new Map<string, StaticCapability>()

  async create(workspaceRoot: string, entryPath: string, now = Date.now()): Promise<StaticCapability> {
    const target = await resolvePreviewPath(workspaceRoot, entryPath)
    const info = await stat(target.path)
    if (!info.isFile() || !['.html', '.htm'].includes(extname(target.path).toLowerCase())) {
      throw new Error('web preview requires an HTML entry file')
    }
    this.prune(now)
    while (this.#entries.size >= MAX_CAPABILITIES) {
      const oldest = this.#entries.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
    const capability: StaticCapability = {
      token: randomBytes(24).toString('base64url'),
      root: dirname(target.path),
      entry: basename(target.path),
      expiresAt: now + CAPABILITY_TTL_MS,
    }
    this.#entries.set(capability.token, capability)
    return capability
  }

  get(token: string, now = Date.now()): StaticCapability | undefined {
    const value = this.#entries.get(token)
    if (value === undefined) return undefined
    if (value.expiresAt <= now) {
      this.#entries.delete(token)
      return undefined
    }
    return value
  }

  prune(now = Date.now()): void {
    for (const [token, value] of this.#entries) {
      if (value.expiresAt <= now) this.#entries.delete(token)
    }
  }
}

export function mimeType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.css': return 'text/css; charset=utf-8'
    case '.gif': return 'image/gif'
    case '.html': case '.htm': return 'text/html; charset=utf-8'
    case '.ico': return 'image/x-icon'
    case '.jpeg': case '.jpg': return 'image/jpeg'
    case '.js': case '.mjs': return 'text/javascript; charset=utf-8'
    case '.json': case '.map': return 'application/json; charset=utf-8'
    case '.png': return 'image/png'
    case '.svg': return 'image/svg+xml'
    case '.txt': return 'text/plain; charset=utf-8'
    case '.wasm': return 'application/wasm'
    case '.webp': return 'image/webp'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    default: return 'application/octet-stream'
  }
}

/** Add navigation controls without granting the sandboxed document a same-origin identity. */
export function injectPreviewNavigationBridge(content: Buffer): Buffer {
  return Buffer.concat([content, Buffer.from(PREVIEW_NAVIGATION_BRIDGE)])
}

export async function resolveCapabilityAsset(
  capability: StaticCapability,
  requestPath: string,
): Promise<{ path: string; contentType: string }> {
  let decoded: string
  try {
    decoded = decodeURIComponent(requestPath)
  } catch {
    throw new Error('invalid preview asset encoding')
  }
  const requested = decoded === '' ? capability.entry : decoded
  try {
    const target = await resolvePreviewPath(capability.root, requested)
    const info = await stat(target.path)
    if (!info.isFile()) throw new Error('preview asset is not a file')
    return { path: target.path, contentType: mimeType(target.path) }
  } catch (error) {
    if (extname(requested) !== '') throw error
    const fallback = await resolvePreviewPath(capability.root, capability.entry)
    return { path: fallback.path, contentType: 'text/html; charset=utf-8' }
  }
}
