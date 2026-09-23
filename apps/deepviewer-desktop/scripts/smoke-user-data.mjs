// Node 24, after build:official. Synthetic Work/Chat histories only; no models or accounts.
// Historical event shapes follow DSH's v2-system-migration persistence contract (MIT).
import assert from 'node:assert/strict'
import { constants, zstdCompressSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { prepareUserData } from '../src/main/user-data-migration.ts'

const repo = fileURLToPath(new URL('../../..', import.meta.url))
const persistenceRoot = join(repo, 'upstream/deepseek-harness/packages/session/session-persistence-jsonl')
const require = createRequire(join(persistenceRoot, 'package.json'))
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')))
const { default: JsonlSessionPersistence } = await import(pathToFileURL(join(persistenceRoot, 'lib/index.js')))
const root = await mkdtemp(join(tmpdir(), 'deepviewer-data-e2e-'))
const userData = join(root, 'DeepViewer Dev')
const oldHome = join(userData, 'dsh-0.1.5-rc.2/harness-home')
const cases = [
  { mode: 'work', id: 'work-history', project: '--fixture-work--', cwd: '/fixture-work', agentPreset: 'standard' },
  { mode: 'chat', id: 'chat-history', project: '_no-cwd', agentPreset: 'deepviewer-chat' },
]
const hash = value => createHash('sha256').update(value).digest('hex')
async function readHistories(home, access) {
  const ctx = new Context()
  try {
    await ctx.plugin(JsonlSessionPersistence, { root: join(home, 'sessions'), compression: 'zstd' })
    const listed = await ctx.sessionPersistence.list()
    assert.equal(listed.length, 2)
    const histories = {}
    for (const fixture of cases) {
      const handle = await ctx.sessionPersistence.open(fixture.id, access)
      try {
        const result = await handle.read()
        assert.equal(handle.header.agentPreset, fixture.agentPreset)
        assert.equal(handle.header.cwd, fixture.cwd)
        histories[fixture.mode] = { count: result.events.length, digest: hash(JSON.stringify(result.events)) }
      } finally { await handle.close() }
    }
    await ctx.sessionPersistence.flush()
    return histories
  } finally { await ctx.fiber.dispose() }
}
try {
  const originals = []
  for (const fixture of cases) {
    const rows = [
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'step/start', data: { turn: 1, step: 1 } },
      { type: 'user/message', surfaceOp: 'append', data: { id: 'question', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: `preserve this ${fixture.mode} conversation` }] } },
      { type: 'request/header', data: { header: { config: { provider: 'mock', model: 'mock' }, system: 'fixture system' }, reason: 'change' } },
      { type: 'step/end', data: { turn: 1, step: 1 } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]
    const header = { type: 'session', version: 2, id: fixture.id, createdAt: 1, isSeeded: false, delegationDepth: 0, agentPreset: fixture.agentPreset, ...(fixture.cwd ? { cwd: fixture.cwd } : {}) }
    const lines = [header, ...rows.map((row, seq) => ({ ...row, seq, time: seq + 10 }))].map(row => JSON.stringify(row))
    const bytes = Buffer.concat(lines.map(line => zstdCompressSync(Buffer.from(line + '\n'), { params: { [constants.ZSTD_c_checksumFlag]: 1 } })))
    const path = join(oldHome, 'sessions', fixture.project, fixture.id, 'session.v2.jsonl.zstd')
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, bytes)
    originals.push({ path, bytes })
  }
  const before = await readHistories(oldHome, 'read')
  assert.ok(before.work.count > 0 && before.chat.count > 0)
  prepareUserData({ appData: root, userData, development: true })
  const home = join(userData, 'harness-home')
  assert.deepEqual(await readHistories(home, 'write'), before)
  for (const fixture of cases) assert.ok((await readFile(join(home, 'sessions', fixture.project, fixture.id, 'session.v3.jsonl.zstd'))).length > 0)
  assert.equal(prepareUserData({ appData: root, userData, development: true }).migrated, false)
  assert.deepEqual(await readHistories(home, 'read'), before)
  for (const original of originals) assert.deepEqual(await readFile(original.path), original.bytes)
  console.log(JSON.stringify({ passed: true, workEvents: before.work.count, chatEvents: before.chat.count, modesAndWorkspacePreserved: true, semanticHistoryUnchanged: true, dshFormat: 'v2 -> v3 zstd', sourceUnchanged: true, restartRead: true }))
} finally { await rm(root, { recursive: true, force: true }) }
