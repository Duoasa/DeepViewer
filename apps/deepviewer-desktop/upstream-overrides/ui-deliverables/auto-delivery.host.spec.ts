/** Explicit deliveries commit only after a successful final tool result. */
import { mkdtemp, rm, writeFile, symlink, readFile, mkdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import { unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { createScope, type Scope } from '@deepseek-ai/dsh-scope'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { turnBoundaryProjectionDefinition } from '@deepseek-ai/dsh-agent-loop'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import * as Present from '@deepseek-ai/dsh-tool-present'
import { isPresentedFile } from '../src/presented.ts'
import { generatedPaths, registerAutoDelivery } from '../src/auto-delivery.ts'

const cleanups: Array<() => Promise<unknown>> = []
let callNumber = 0
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup()
  cleanups.length = 0
  vi.restoreAllMocks()
})
async function agent(ctx: Context, cwd: string | undefined): Promise<Agent> {
  const id = SessionId(`present-owner-${++callNumber}`)
  let scope: Scope
  const session = Session.create(id, [], {
    version: SESSION_FORMAT_VERSION, id, createdAt: 0, ...cwd === undefined ? {} : { cwd }, isSeeded: false,
  })
  const value: Agent = {
    id,
    options: {},
    session,
    inbox: unsupportedInbox(),
    status: 'idle',
    get ctx() { return scope.ctx },
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  await ctx.plugin(Object.assign((inner: Context) => { scope = createScope(inner, value) }, { inject: ['tools'] }))
  ctx.agents.register(value)
  return value
}


async function setup() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-present-minimal-')))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LocalFileSystem, { cwd: root })
  await ctx.plugin(SessionProjectionRegistry)
  ctx.sessionProjections.register(turnBoundaryProjectionDefinition)
  await ctx.plugin(SandboxPolicy, { mode: 'workspace-write', workspaceRoot: root })
  await ctx.plugin(Present)
  registerAutoDelivery(ctx)
  const owner = await agent(ctx, root)
  owner.session.append('turn/start', { turn: 1 })
  const generated: { paths: string[]; images?: Array<{ attachmentId: string; mediaType: string; bytes: number; width: number; height: number }> } = { paths: [join(root, 'generated.png')] }
  ctx.tools.register(defineTool({
    name: 'image_generate', description: 'Fixture generation', parameters: {},
    output: { schema: { type: 'object', additionalProperties: true, properties: { paths: { type: 'array', items: { type: 'string' }, required: true } } }, render: () => [] },
    execute: async () => generated,
  }))
  const execute = () => ctx.tools.execute({
    signal: new AbortController().signal, callId: ToolCallId(`call-${++callNumber}`),
    name: 'image_generate', arguments: {}, agent: owner,
  })
  const deliveries = () => owner.session.snapshotEvents().filter(event => event.type === 'deliverables/presented')
  const present = (path: string) => ctx.tools.execute({ signal: new AbortController().signal, callId: ToolCallId(`present-${++callNumber}`), name: 'present', arguments: { files: [{ path }] }, agent: owner })
  return { ctx, owner, root, execute, deliveries, generated, present }
}

describe('DeepViewer automatic final file delivery', () => {
  it('registers a real generated image before the final reply without present or copying bytes', async () => {
    const { ctx, root, execute, deliveries } = await setup()
    await writeFile(join(root, 'generated.png'), Uint8Array.of(137, 80, 78, 71))
    const read = vi.spyOn(ctx.fs, 'readBytes')
    const result = await execute()
    expect(result.isError).toBe(false)
    expect(deliveries()).toHaveLength(1)
    expect(deliveries()[0]?.data).toMatchObject({ turn: 1, files: [{ path: join(root, 'generated.png') }] })
    expect(read).not.toHaveBeenCalled()
  })
  it('skips missing outputs and symlinks', async () => {
    const { root, execute, deliveries } = await setup()
    await execute()
    expect(deliveries()).toEqual([])
    await writeFile(join(root, 'input.png'), 'input')
    await symlink(join(root, 'input.png'), join(root, 'generated.png'))
    await execute()
    expect(deliveries()).toEqual([])
  })
  it('does not publish when post policy blocks an otherwise successful generation', async () => {
    const { ctx, root, execute, deliveries } = await setup()
    await writeFile(join(root, 'generated.png'), 'image')
    ctx.on('tools/post-execute', async () => ({ kind: 'block', feedback: [{ type: 'text', text: 'Blocked' }] }))
    expect((await execute()).isError).toBe(true)
    expect(deliveries()).toEqual([])
  })
  it('does not publish cancelled results', async () => {
    const { ctx, owner, root, deliveries } = await setup()
    await writeFile(join(root, 'generated.png'), 'image')
    const abort = new AbortController()
    const stat = ctx.fs.stat.bind(ctx.fs)
    vi.spyOn(ctx.fs, 'stat').mockImplementation(async (...args) => { const value = await stat(...args); abort.abort(); return value })
    const result = await ctx.tools.execute({ signal: abort.signal, callId: ToolCallId('cancelled'), name: 'image_generate', arguments: {}, agent: owner })
    expect(result.isError).toBe(true)
    expect(deliveries()).toEqual([])
  })
  it('materializes an external original image and resolves a normalized cache alias to the same original bytes', async () => {
    const { ctx, root, generated, execute, present, deliveries } = await setup()
    const outside = await mkdtemp(join(tmpdir(), 'deepviewer-delivery-source-'))
    cleanups.push(() => rm(outside, { recursive: true, force: true }))
    const original = join(outside, 'image-output.png')
    const object = join(outside, 'a'.repeat(64))
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
    await writeFile(original, png)
    await writeFile(object, 'normalized bytes are deliberately different')
    ctx.provide('attachments', { imageHostPath: () => object } as never)
    generated.paths = [original]
    generated.images = [{ attachmentId: 'sha256:' + 'a'.repeat(64), mediaType: 'image/png', bytes: png.length, width: 1, height: 1 }]
    const result = await execute()
    expect(result.isError).toBe(false)
    const file = deliveries()[0]?.data.files[0]
    expect(file?.path).toMatch(new RegExp('^' + root + '/outputs/.*\\.png$'))
    expect(file?.sourcePaths).toContain(object)
    expect(result.value).toMatchObject({ paths: [file?.path] })
    expect(await readFile(file!.path)).toEqual(png)
    const repeated = await present(object)
    expect(repeated.isError).toBe(false)
    expect(deliveries()[1]?.data.files[0]?.path).toBe(file?.path)
    expect(await readFile(file!.path)).toEqual(png)
    expect(await readFile(object, 'utf8')).toBe('normalized bytes are deliberately different')
  })
  it('repairs extensionless and misleading filenames from byte signatures without overwriting existing files', async () => {
    const { ctx, root, present, deliveries } = await setup()
    const outside = await mkdtemp(join(tmpdir(), 'deepviewer-delivery-hash-'))
    cleanups.push(() => rm(outside, { recursive: true, force: true }))
    const source = join(outside, 'b'.repeat(64))
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    await writeFile(source, png)
    expect((await present(source)).isError).toBe(false)
    const first = deliveries()[0]!.data.files[0]!.path
    expect(first).toMatch(/outputs\/image-[a-f0-9]+\.png$/)
    expect(await readFile(first)).toEqual(png)
    // A different Session has no alias and must not overwrite an occupied output filename.
    await writeFile(first, 'user-owned contents')
    const other = await agent(ctx, root)
    other.session.append('turn/start', { turn: 1 })
    const collision = await ctx.tools.execute({ signal: new AbortController().signal, callId: ToolCallId('collision'), name: 'present', arguments: { files: [{ path: source }] }, agent: other })
    expect(collision.isError).toBe(false)
    const colliding = other.session.snapshotEvents().find(event => event.type === 'deliverables/presented')
    expect(colliding?.data.files[0]?.path).toBe(first.replace('.png', '-1.png'))
    expect(await readFile(colliding!.data.files[0]!.path)).toEqual(png)
    const misleading = join(root, 'wrong.jpg')
    await writeFile(misleading, png)
    expect((await present(misleading)).isError).toBe(false)
    expect(deliveries().at(-1)?.data.files[0]?.path).toMatch(/\.png$/)
    expect(await readFile(first, 'utf8')).toBe('user-owned contents')
  })
  it('fails delivery explicitly for read-only workspaces and outputs-directory symlink escapes', async () => {
    const { ctx, root, generated, execute, deliveries } = await setup()
    const outside = await mkdtemp(join(tmpdir(), 'deepviewer-delivery-denied-'))
    cleanups.push(() => rm(outside, { recursive: true, force: true }))
    const source = join(outside, 'image.png')
    await writeFile(source, 'original')
    generated.paths = [source]
    const policy = vi.spyOn(ctx.sandboxPolicy, 'resolve').mockReturnValue({ mode: 'read-only', workspaceRoot: root })
    expect((await execute()).isError).toBe(true)
    expect(deliveries()).toEqual([])
    policy.mockRestore()
    await mkdir(join(outside, 'escape'))
    await symlink(join(outside, 'escape'), join(root, 'outputs'))
    expect((await execute()).isError).toBe(true)
    expect(deliveries()).toEqual([])
  })
  it('validates persisted delivery aliases before rendering them', () => {
    expect(isPresentedFile({ path: 'image.png', sourcePaths: ['cache'] })).toBe(true)
    expect(isPresentedFile({ path: 'image.png', sourcePaths: 42 })).toBe(false)
    expect(isPresentedFile({ path: 'image.png', sourcePaths: [null] })).toBe(false)
  })
  it('supports real producer contracts, dedupes paths and never guesses from prose or reads', () => {
    expect(generatedPaths('image_generate', {}, { paths: ['a.png', 'a.png', '', null, 'b.png'] })).toEqual(['a.png', 'b.png'])
    expect(generatedPaths('write', { file_path: 'report.txt', content: '' }, {})).toEqual(['report.txt'])
    expect(generatedPaths('str_replace_editor', { command: 'create', path: 'report.md', file_text: 'report' }, {})).toEqual(['report.md'])
    expect(generatedPaths('read_image', { file_path: 'input.png' }, { paths: ['input.png'] })).toEqual([])
    expect(generatedPaths('bash', { command: 'echo output.png' }, { text: 'Saved output.png' })).toEqual([])
    expect(generatedPaths('write', { file_path: 'missing.txt' }, {})).toEqual([])
  })
})
