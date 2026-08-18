import { readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import {
  listPreviewDirectory,
  PreviewCapabilities,
  readPreviewFile,
  injectPreviewNavigationBridge,
  resolveCapabilityAsset,
} from './host-files.ts'

export const name = 'deepviewer-preview'
export const inject = ['connection', 'webServer', 'workspaceRegistry']

const RPC_CHANNEL = '/deepviewer-preview'
const STATIC_PREFIX = '/deepviewer-preview-static'
const MAX_STATIC_ASSET_BYTES = 16 * 1024 * 1024

interface RpcResult {
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: { code: 'bad-request' | 'workspace-not-found' | 'internal'; message: string; details: unknown }
}

interface HostConnection {
  readonly rpc: {
    handle(
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult>,
      options: { authority: 'loopback' },
    ): () => Promise<void>
  }
}

interface HostWebServer {
  register(route: {
    kind: 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

interface HostWorkspace {
  readonly path: string
}

interface PreviewHostContext {
  readonly connection: HostConnection
  readonly webServer: HostWebServer
  readonly workspaceRegistry: { get(id: never): HostWorkspace | undefined }
  effect(callback: () => (() => void) | (() => Promise<void>), label: string): () => void
}

interface PreviewRequest {
  readonly workspaceId: string
  readonly path: string
}

function parseRequest(payload: unknown): PreviewRequest {
  if (typeof payload !== 'object' || payload === null) throw new Error('preview request must be an object')
  const value = payload as Partial<PreviewRequest>
  if (typeof value.workspaceId !== 'string' || value.workspaceId === '') {
    throw new Error('preview request requires workspaceId')
  }
  if (typeof value.path !== 'string') throw new Error('preview request requires path')
  return { workspaceId: value.workspaceId, path: value.path }
}

function failure(code: 'bad-request' | 'workspace-not-found' | 'internal', message: string, details: unknown = {}): RpcResult {
  return { ok: false, error: { code, message, details } }
}

function securityHeaders(contentType: string, size: number): Record<string, string | number> {
  return {
    'Content-Type': contentType,
    'Content-Length': size,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
}

/** Mount the loopback-only RPC plane and token-gated static preview route. */
export function apply(ctx: Context): void {
  const host = ctx as unknown as PreviewHostContext
  const capabilities = new PreviewCapabilities()

  host.effect(() => host.connection.rpc.handle(
    RPC_CHANNEL,
    async (endpoint, payload) => {
      let request: PreviewRequest
      try {
        request = parseRequest(payload)
      } catch (error) {
        return failure('bad-request', error instanceof Error ? error.message : 'invalid preview request', { issues: [] })
      }
      const workspace = host.workspaceRegistry.get(request.workspaceId as never)
      if (workspace === undefined) {
        return failure('workspace-not-found', 'The selected workspace is no longer available.', {
          workspaceId: request.workspaceId,
        })
      }
      try {
        switch (endpoint) {
          case 'list':
            return { ok: true, value: { entries: await listPreviewDirectory(workspace.path, request.path) } }
          case 'read':
            return { ok: true, value: await readPreviewFile(workspace.path, request.path) }
          case 'site': {
            const capability = await capabilities.create(workspace.path, request.path)
            return {
              ok: true,
              value: {
                url: `${STATIC_PREFIX}/${capability.token}/${encodeURIComponent(capability.entry)}`,
                expiresAt: capability.expiresAt,
              },
            }
          }
          default:
            return failure('bad-request', `Unknown preview endpoint: ${endpoint}`, { issues: [] })
        }
      } catch (error) {
        return failure('internal', error instanceof Error ? error.message : 'Preview request failed.')
      }
    },
    { authority: 'loopback' },
  ), 'deepviewer-preview: loopback RPC')

  host.effect(() => host.webServer.register({
    kind: 'prefix',
    path: STATIC_PREFIX,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' })
        res.end()
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://preview.invalid').pathname
      const suffix = pathname.startsWith(`${STATIC_PREFIX}/`)
        ? pathname.slice(STATIC_PREFIX.length + 1)
        : ''
      const slash = suffix.indexOf('/')
      const token = slash === -1 ? suffix : suffix.slice(0, slash)
      const assetPath = slash === -1 ? '' : suffix.slice(slash + 1)
      const capability = capabilities.get(token)
      if (capability === undefined) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      try {
        const asset = await resolveCapabilityAsset(capability, assetPath)
        const info = await stat(asset.path)
        if (info.size > MAX_STATIC_ASSET_BYTES) throw new Error('preview asset exceeds the 16 MiB limit')
        const fileContent = await readFile(asset.path)
        const content = asset.contentType.startsWith('text/html')
          ? injectPreviewNavigationBridge(fileContent)
          : fileContent
        const headers = securityHeaders(asset.contentType, content.byteLength)
        res.writeHead(200, headers)
        if (req.method === 'HEAD') res.end()
        else res.end(content)
      } catch {
        res.writeHead(404, {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        res.end('not found')
      }
    },
  }), 'deepviewer-preview: static capability route')
}
