/** Offline production-Host smoke: generation -> workspace -> card -> sidebar media URL. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Script } from 'node:vm'
import { createRequire } from 'node:module'
import { stageBetterSidebar } from './stage-better-sidebar.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const upstream = join(project, 'upstream/deepseek-harness')
const sidebar = stageBetterSidebar(upstream)
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'deepviewer-delivery-smoke-')))
const workspace = join(scratch, 'workspace')
const home = join(scratch, 'home')
const fixture = join(scratch, 'fixture')
for (const dir of [workspace, join(home, 'profiles/node_modules'), fixture]) mkdirSync(dir, { recursive: true })
const sharp = createRequire(join(upstream, 'packages/attachment/attachment-local/package.json'))('sharp')
const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ee7733' } }).png().toBuffer()
const source = join(scratch, 'generated-car.png')
const hashSource = join(scratch, 'd'.repeat(64))
writeFileSync(source, png)
writeFileSync(hashSource, png)
writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'dsh-delivery-smoke', version: '1.0.0', type: 'module', main: 'index.mjs' }))
const toolsUrl = pathToFileURL(join(upstream, 'packages/core/tools/lib/index.js')).href
writeFileSync(join(fixture, 'index.mjs'), `
import { defineTool } from ${JSON.stringify(toolsUrl)};
export const inject = ['tools', 'agents', 'attachments', 'connection', 'sessionProjections'];
export function apply(ctx) {
  const source = ${JSON.stringify(source)};
  const bytes = Buffer.from(${JSON.stringify(png.toString('base64'))}, 'base64');
  ctx.tools.register(defineTool({
    name: 'image_generate', description: 'Offline smoke image producer', parameters: {},
    output: { schema: { type: 'object', additionalProperties: true, properties: { paths: { type: 'array', items: { type: 'string' }, required: true } } }, render: (_args, value) => [{ type: 'text', text: 'Saved ' + value.paths.join(', ') }] },
    execute: async () => ({ paths: [source], images: [await ctx.attachments.saveImage({ data: bytes, mediaType: 'image/png', name: 'generated-car.png' })] }),
  }));
  ctx.connection.fetch.register({ path: '/api/deepviewer-delivery-smoke', methods: ['POST'], requestBody: 'buffered', fetch: async request => {
    const { sessionId } = await request.json();
    const agent = ctx.agents.get(sessionId);
    if (!agent) return Response.json({ error: 'Missing smoke agent' }, { status: 500 });
    agent.session.append('sandbox/mode', { mode: 'workspace-write' });
    agent.session.append('turn/start', { turn: 1 });
    const run = (name, args, id) => ctx.tools.execute({ name, arguments: args, callId: id, agent, signal: request.signal });
    const generated = await run('image_generate', {}, 'smoke-image');
    if (generated.isError) return Response.json({ error: generated.error }, { status: 500 });
    const object = ctx.attachments.imageHostPath(generated.value.images[0]);
    const explicit = await run('present', { files: [{ path: object, description: 'Original image' }] }, 'smoke-present');
    const hash = await run('present', { files: [{ path: ${JSON.stringify(hashSource)} }] }, 'smoke-hash');
    const deliveries = agent.session.snapshotEvents().filter(event => event.type === 'deliverables/presented').map(event => ({ seq: event.seq, files: event.data.files }));
    return Response.json({ generated, explicit, hash, deliveries });
  }});
}
`)
symlinkSync(fixture, join(home, 'profiles/node_modules/dsh-delivery-smoke'), 'dir')
symlinkSync(sidebar, join(home, 'profiles/node_modules/dsh-better-sidebar'), 'dir')
const patch = join(scratch, 'smoke.patch.yml')
writeFileSync(patch, '- insert:\n    - id: delivery-smoke\n      name: dsh-delivery-smoke\n')
const child = spawn(process.execPath, ['--expose-internals', join(upstream, 'apps/cli/lib/bin.js'), 'web', '--patch', join(sidebar, 'cordis.patch.yml'), '--patch', patch, '--port', '0', '--no-open'], {
  cwd: workspace, env: { PATH: process.env.PATH, HOME: scratch, SHELL: '/bin/sh', DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', bytes => { output += bytes })
child.stderr.on('data', bytes => { output += bytes })
try {
  const deadline = Date.now() + 45000
  let match
  while (!(match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/))) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(output.replace(/token=\S+/g, 'token=[REDACTED]').slice(-4000))
    await new Promise(r => setTimeout(r, 100))
  }
  const url = new URL(match[1])
  const bootstrap = await fetch(url, { redirect: 'manual' })
  assert.equal(bootstrap.status, 303)
  const cookie = bootstrap.headers.getSetCookie().map(v => v.split(';')[0]).join('; ')
  await bootstrap.body?.cancel()
  const headers = { cookie, origin: url.origin, 'content-type': 'application/json' }
  const created = await fetch(url.origin + '/api/session/create', { method: 'POST', headers, body: JSON.stringify({ type: 'client-request', rpcId: 'delivery-smoke-create', method: 'session/create', payload: { args: { request: { cwd: workspace } } } }) })
  const session = await created.json()
  assert.equal(session.result?.ok, true, JSON.stringify(session))
  const sessionId = session.result.value.sessionId
  const response = await fetch(url.origin + '/api/deepviewer-delivery-smoke', { method: 'POST', headers, body: JSON.stringify({ sessionId }) })
  const result = await response.json()
  assert.equal(response.status, 200, JSON.stringify(result))
  assert.equal(result.explicit.isError, false, JSON.stringify(result.explicit))
  assert.equal(result.hash.isError, false, JSON.stringify(result.hash))
  assert.equal(result.deliveries.length, 3)
  const canonical = result.generated.value.paths[0]
  assert.equal(result.explicit.value.files[0].path, canonical, 'Cache alias must retain original-quality workspace output')
  assert.equal(result.deliveries[0].files[0].path, canonical)
  const client = readFileSync(join(sidebar, 'lib/client.js'), 'utf8')
  const functions = ['isAbsolutePath$1', 'resolveSidebarPath', 'fileUrl', 'createNativeTabRecords'].map(name => {
    const start = client.indexOf('function ' + name + '(')
    assert.ok(start >= 0)
    return client.slice(start, client.indexOf('\n\t\t}', start) + 5)
  }).join('\n')
  const { records, fileUrl } = new Script(functions + '\n({ records: createNativeTabRecords(), fileUrl })').runInNewContext({ URLSearchParams })
  const scope = { sessionId, cwd: workspace }
  for (const path of [canonical, result.hash.value.files[0].path]) {
    assert.ok(path.startsWith(workspace + '/outputs/'))
    assert.match(path, /\.png$/)
    assert.deepEqual(readFileSync(path), png)
    for (const input of [path, relative(workspace, path)]) {
      const view = records.ensure({ id: input, kind: 'editor', params: { path: input }, scope })
      const address = fileUrl(scope, view.tab.path, false)
      const preview = await fetch(url.origin + address, { headers })
      assert.equal(preview.status, 200, address)
      assert.equal(preview.headers.get('content-type'), 'image/png')
      assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png)
      const anonymous = await fetch(url.origin + address)
      assert.ok([401, 403].includes(anonymous.status))
      await anonymous.body?.cancel()
    }
  }
  const outside = await fetch(url.origin + fileUrl(scope, source, false), { headers })
  assert.equal(outside.status, 403, 'Workspace fence must remain enabled')
  await outside.body?.cancel()
  console.log('FILE_DELIVERY_SMOKE_OK: generated and hash inputs land in workspace with .png; model/card/cache alias paths agree; sidebar absolute/relative requests return identical PNG bytes; anonymous and outside-workspace requests remain blocked.')
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    await exited
    clearTimeout(timer)
  }
  rmSync(scratch, { recursive: true, force: true })
}
