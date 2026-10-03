import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/index.ts'
import { provideBrowserCredentials } from './browser-credentials.ts'
import type { WebRoute, WebServer } from '@deepseek-ai/dsh-host-webserver'
describe('DeepViewer dedicated RPC owner', () => {
  it('keeps the consumer channel alive and removes it when that consumer unloads', async () => {
    const ctx = new Context(), routes = new Map<string, WebRoute>()
    provideBrowserCredentials(ctx)
    ctx.provide('webServer', { register(route: WebRoute) { routes.set(route.path, route); return () => { routes.delete(route.path) } }, port: 0, host: '127.0.0.1' } as unknown as WebServer)
    const connection = ctx.plugin({ inject, apply }); await connection.await()
    const consumer = ctx.plugin({ inject: ['connection', 'webServer'], apply(owner: Context) {
      owner.connection.rpc.handle('/deepviewer-fixture', async () => ({ ok: true, value: 'fixture' }), owner)
    } })
    await consumer.await(); expect(routes.has('/deepviewer-fixture')).toBe(true)
    await consumer.dispose(); expect(routes.has('/deepviewer-fixture')).toBe(false); expect(routes.has('/api')).toBe(true)
    await connection.dispose()
  })
})
