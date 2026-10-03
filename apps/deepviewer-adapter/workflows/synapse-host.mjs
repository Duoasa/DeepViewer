import { join } from 'node:path'
import { DeepViewerSynapseStore } from './synapse-projection.mjs'

// No HTTP routes: only the authenticated native connection can reach this service.
export function createSynapseHost({ query, dataFile }) {
  let store, refreshPending, lastRefresh = 0, changeRevision = 0
  const projected = new Set(), dirty = new Map()
  const getStore = () => store ??= new DeepViewerSynapseStore(dataFile)
  async function refresh() {
    if (refreshPending) return refreshPending
    if (dirty.size === 0 && Date.now() - lastRefresh < 1500) return
    refreshPending = (async () => {
      const target = getStore(), records = await query.listSessions()
      await target.ready
      const summaries = []
      for (const { header } of records) {
        if (projected.has(header.id) && !dirty.has(header.id)) {
          const thread = target.state.workspaces.flatMap(w => w.threads).find(t => t.dshSessionId === header.id)
          summaries.push({ id: header.id, title: thread?.dshSessionTitle ?? header.title ?? 'DeepViewer 会话', cwd: header.cwd ?? null, parentId: header.parentSession ?? null }); continue
        }
        const revision = dirty.get(header.id)
        const log = await query.readSession(header.id)
        const titleEvent = [...log.events].reverse().find(event => event.type === 'session/title')
        const title = titleEvent?.data?.title ?? header.title ?? 'DeepViewer 会话'
        const session = { id: header.id, title, header: { ...log.session, seedLength: log.inheritedEventCount }, events: log.events }
        await target.projectSession(session, header.parentSession ? log.inheritedEventCount : 0, 'DeepViewer 会话')
        // Reading/projection can yield while native events append. Consume only
        // the revision this snapshot started with; newer events must be retried.
        if (dirty.get(header.id) === revision) dirty.delete(header.id)
        projected.add(header.id)
        summaries.push({ id: header.id, title, cwd: header.cwd ?? null, parentId: header.parentSession ?? null })
      }
      const ids = new Set(summaries.map(s => s.id))
      const removed = target.state.workspaces.flatMap(w => w.threads).map(t => t.dshSessionId).filter(id => id && !ids.has(id))
      await target.syncSessions(summaries, removed)
      lastRefresh = Date.now()
    })().finally(() => { refreshPending = undefined })
    return refreshPending
  }
  return {
    changed(id) { dirty.set(id, ++changeRevision); lastRefresh = 0 },
    async call(input) {
      if (!input || typeof input !== 'object' || JSON.stringify(input).length > 64 * 1024) throw new Error('Invalid map request')
      const { path, method = 'GET' } = input
      if (typeof path !== 'string') throw new Error('Invalid map path')
      const body = input.body === undefined ? {} : JSON.parse(input.body)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid map body')
      if (path === '/synapse/api/workspaces' && method === 'GET') {
        await refresh(); return { workspaces: await getStore().list() }
      }
      const workspace = /^\/synapse\/api\/workspaces\/([0-9a-f-]{36})$/i.exec(path)
      if (workspace && method === 'GET') { await refresh(); return { workspace: await getStore().get(workspace[1]) } }
      const branch = /^\/synapse\/api\/threads\/([0-9a-f-]{36})\/branch$/i.exec(path)
      if (branch && method === 'POST') {
        // Native fork must exist before a canvas edge can refer to it.
        const log = await query.readSession(body.dshSessionId)
        const parent = getStore().state.workspaces.flatMap(w => w.threads).find(t => t.id === branch[1])
        if (!parent || log.session.parentSession !== parent.dshSessionId) throw new Error('Canvas branch must match the native session parent')
        return { thread: await getStore().branch(branch[1], body) }
      }
      const thread = /^\/synapse\/api\/threads\/([0-9a-f-]{36})$/i.exec(path)
      if (thread && method === 'PATCH') return { thread: await getStore().updateThread(thread[1], body) }
      if (thread && method === 'DELETE') return getStore().removeThread(thread[1])
      throw new Error('Unsupported map operation')
    },
    async dispose() { await refreshPending; if (store) { await store.ready; clearTimeout(store.flushTimer); store.flushTimer = null; await store.flush(); await store.serial } },
  }
}
export function registerSynapse(ctx) {
  let host
  const instance = () => {
    if (!process.env.DSH_HOME) throw new Error('DeepViewer data directory unavailable')
    return host ??= createSynapseHost({ query: ctx.sessionQuery, dataFile: join(process.env.DSH_HOME, 'synapse', 'workspaces.json') })
  }
  ctx.inject(['connection', 'webServer'], scope => scope.connection.rpc.handle('/deepviewer-synapse', async (method, input) => {
    try {
      if (method !== 'request') throw new Error('Unsupported map method')
      return { ok: true, value: await instance().call(input) }
    } catch (error) { return { ok: false, error: { code: 'deepviewer/synapse', message: error.message, details: {} } } }
  }, scope))
  ctx.on('session/event', session => host?.changed(session.id))
  ctx.on('session/created', session => host?.changed(session.id))
  ctx.effect(() => () => host?.dispose())
}
