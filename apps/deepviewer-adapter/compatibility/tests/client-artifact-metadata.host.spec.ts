/** Regression through the real Host poll/SSE and browser entry lifecycle. */
import { EventEmitter } from 'node:events'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { WebRoute, WebServer } from '@deepseek-ai/dsh-host-webserver'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientModuleRegistry } from '@deepseek-ai/dsh-client-modules'
import { apply as provideModules, createClientModuleSystem } from '@deepseek-ai/dsh-client-modules/client'
import type { ClientModuleLoaderTarget } from '@deepseek-ai/dsh-client-modules/client'
import { apply as applyHostHmr, inject as hostHmrInject } from '../src/index.ts'
import { apply as applyClientHmr, inject as clientHmrInject } from '../src/client/index.ts'
import type { PluginsEventFrame } from '../src/events.ts'

const ID = 'deepviewer-artifact-metadata-fixture'
const FIXED_MTIME = new Date('2020-09-13T12:26:40.000Z')
const contexts: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) {
    await ctx.fiber.dispose()
    await ctx.fiber.await()
  }
  vi.unstubAllGlobals()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** The fixture executes the bytes advertised and served by the Host registry. */
function fixtureBundle(generation: string): string {
  return `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: () => ({
  apply(ctx) {
    ctx.effect(() => {
      effects.mounted++;
      effects.generations.push(${JSON.stringify(generation)});
      return () => { effects.disposed++; };
    });
  }
}) });\n`
}

async function bench() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'deepviewer-artifact-metadata-')))
  roots.push(root)
  const packageRoot = join(root, 'node_modules', ID)
  const clientPath = join(packageRoot, 'lib', 'client.js')
  mkdirSync(dirname(clientPath), { recursive: true })
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({
    name: ID,
    exports: { './client': './lib/client.js', './package.json': './package.json' },
    dsh: { client: { platform: 'web' } },
  }))
  writeFileSync(clientPath, fixtureBundle('A'))
  utimesSync(clientPath, FIXED_MTIME, FIXED_MTIME)

  const host = new Context()
  contexts.push(host)
  host.baseUrl = pathToFileURL(root).href + '/'
  host.provide('loader', {
    *entries() {
      yield {
        options: { name: ID }, fiber: {}, disabled: false,
        parent: { tree: { ctx: { baseUrl: host.baseUrl } } },
      }
    },
  })
  const routes = new Map<string, WebRoute>()
  host.provide('webServer', {
    port: 0,
    register(route: WebRoute) {
      routes.set(route.path, route)
      return () => { routes.delete(route.path) }
    },
    tapIndex: () => () => {},
  } as unknown as WebServer)
  const registry = new ClientModuleRegistry(host)
  const initialGraph = registry.graph()
  expect(initialGraph.entries.map(row => row.id)).toEqual([ID])

  const client = new Context()
  contexts.push(client)
  const effects = { mounted: 0, disposed: 0, generations: [] as string[] }
  const fetched: string[] = []
  const target: ClientModuleLoaderTarget = {
    mode: 'queue', pendingQueue: [], load: () => {},
    create: options => createClientModuleSystem(target, {
      id: 'bootstrap', exports: { inject: ['loader'], apply: provideModules },
    }, options),
  }
  const modules = target.create({
    boot: initialGraph,
    staticModules: {},
    loadBundle: async (url) => {
      fetched.push(url)
      const response = await registry.fetchBundle(new Request(new URL(url, 'http://fixture.invalid')))
      expect(response.status).toBe(200)
      runInNewContext(await response.text(), { window: { __ModuleLoader__: target }, effects })
    },
  })
  await client.plugin(Loader)
  client.loader.internal = modules as never
  await modules.entries.start(client.loader, modules.manifest)
  client.provide('modules', modules)
  expect(effects).toEqual({ mounted: 1, disposed: 0, generations: ['A'] })

  // Only the network boundary is simulated. Both SSE producers/consumers,
  // revision decisions, served scripts and plugin replacement are production code.
  let source: FixtureEventSource | undefined
  class FixtureEventSource {
    listener: ((event: MessageEvent<string>) => void) | undefined
    constructor(_url: string) { source = this }
    addEventListener(_type: string, listener: (event: MessageEvent<string>) => void) {
      this.listener = listener
    }
    close() { this.listener = undefined }
  }
  vi.stubGlobal('EventSource', FixtureEventSource)
  await client.plugin({ inject: clientHmrInject, apply: applyClientHmr })
  await host.plugin({ inject: hostHmrInject, apply: applyHostHmr }, { pollIntervalMs: 10 })
  const frames: PluginsEventFrame[] = []
  const response = new EventEmitter() as EventEmitter & {
    writeHead: () => unknown
    write: (line: string) => boolean
    destroy: () => unknown
  }
  response.writeHead = () => response
  response.write = (line) => {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim()
      frames.push(JSON.parse(data) as PluginsEventFrame)
      source!.listener!({ data } as MessageEvent<string>)
    }
    return true
  }
  response.destroy = () => { response.emit('close'); return response }
  const route = routes.get('/plugins/events')!
  expect(route).toBeDefined()
  await route.handler({ method: 'GET' } as IncomingMessage, response as unknown as ServerResponse)
  expect(frames.map(frame => frame.type)).toEqual(['graph'])
  // Allow an observable ctime increment even on coarse host filesystems.
  await new Promise(resolve => setTimeout(resolve, 25))
  return { clientPath, registry, initialGraph, effects, fetched, frames }
}

describe('DeepViewer executable artifact metadata', () => {
  it('keeps a live browser plugin when metadata changes but mtime, size and bytes do not', async () => {
    const b = await bench()
    const before = statSync(b.clientPath)
    const bytes = readFileSync(b.clientPath)
    chmodSync(b.clientPath, 0o400)
    const after = statSync(b.clientPath)
    expect(after.ctimeMs).not.toBe(before.ctimeMs)
    expect(after.mtimeMs).toBe(before.mtimeMs)
    expect(after.size).toBe(before.size)
    expect(readFileSync(b.clientPath)).toEqual(bytes)

    await expect.poll(() => b.registry.artifactBaseline(ID)?.ctimeMs).toBe(after.ctimeMs)
    // Subsequent polls must also remain quiet after refreshing the baseline.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(b.registry.graph()).toBe(b.initialGraph)
    expect(b.frames.map(frame => frame.type)).toEqual(['graph'])
    expect(b.effects).toEqual({ mounted: 1, disposed: 0, generations: ['A'] })
    expect(b.fetched).toHaveLength(1)
  })

  it('replaces the browser plugin for changed bytes even with unchanged mtime and size', async () => {
    const b = await bench()
    const before = statSync(b.clientPath)
    writeFileSync(b.clientPath, fixtureBundle('B'))
    utimesSync(b.clientPath, FIXED_MTIME, FIXED_MTIME)
    const after = statSync(b.clientPath)
    expect(after.ctimeMs).not.toBe(before.ctimeMs)
    expect(after.mtimeMs).toBe(before.mtimeMs)
    expect(after.size).toBe(before.size)

    await expect.poll(() => b.effects.generations).toEqual(['A', 'B'])
    expect(b.effects).toEqual({ mounted: 2, disposed: 1, generations: ['A', 'B'] })
    expect(b.frames.map(frame => frame.type)).toEqual(['graph', 'rebuilt', 'graph'])
    expect(b.registry.graph().entries[0]!.rev).not.toBe(b.initialGraph.entries[0]!.rev)
    expect(b.fetched).toHaveLength(2)
  })

  it('honors mtime build stamps for identical entry bytes so sibling chunk builds reload', async () => {
    const b = await bench()
    const before = statSync(b.clientPath)
    const bytes = readFileSync(b.clientPath)
    utimesSync(b.clientPath, FIXED_MTIME, new Date(FIXED_MTIME.getTime() + 1000))
    expect(statSync(b.clientPath).mtimeMs).not.toBe(before.mtimeMs)
    expect(readFileSync(b.clientPath)).toEqual(bytes)

    await expect.poll(() => b.effects.mounted).toBe(2)
    expect(b.effects).toEqual({ mounted: 2, disposed: 1, generations: ['A', 'A'] })
    expect(b.frames.map(frame => frame.type)).toEqual(['graph', 'rebuilt', 'graph'])
    expect(b.registry.graph().entries[0]!.rev).not.toBe(b.initialGraph.entries[0]!.rev)
    expect(b.fetched).toHaveLength(2)
  })
})
