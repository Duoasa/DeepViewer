import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { adaptBetterSidebarUI } from './adapt-better-sidebar-ui.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const betterSidebarName = 'dsh-better-sidebar'
export const betterSidebarVersion = '0.19.1'
export const betterSidebarAdapter = 'deepviewer-dsh015-sidebar-management-v2'
export const betterSidebarFiles = ['package.json', 'LICENSE', 'cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/client-terminal.js', 'lib/client-editor.js', 'lib/client-mermaid.js']

export function validateBetterSidebar(root) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  if (manifest.name !== betterSidebarName || manifest.version !== betterSidebarVersion || manifest.license !== 'MIT'
    || manifest.dsh?.bundle?.patch !== './cordis.patch.yml'
    || manifest.dsh?.client?.platform !== 'web'
    || !manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right')) {
    throw new Error('Better Sidebar package identity or native sidebar contract mismatch')
  }
  for (const file of betterSidebarFiles) {
    if (!existsSync(resolve(root, file))) throw new Error(`Better Sidebar missing ${file}`)
  }
  return manifest
}

function adaptHost(root) {
  const path = resolve(root, 'lib/index.js')
  let content = readFileSync(path, 'utf8')
  const replacements = [
    ['...buildSidechatApi(ctx, assistantLive)', '...{} /* DeepViewer: side conversation removed by maintainer */'],
    ['const MEDIA_TYPES = {', 'const MEDIA_TYPES = {\n' + Object.entries({
      '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
      '.json': 'application/json', '.wasm': 'application/wasm', '.woff': 'font/woff',
      '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    }).map(([extension, type]) => `\t${JSON.stringify(extension)}: ${JSON.stringify(type)},`).join('\n')],
    ['const inject = [\n\t"webServer",', 'const inject = [\n\t"connection",\n\t"webServer",'],
    ['const fence = (req) => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts);',
      'const fence = (req) => ctx.connection.requestRejection(req) === undefined && isTrustedApiRequest(req, ctx.webRuntime.trustedHosts);'],
    ['"content-security-policy": "sandbox allow-scripts allow-popups allow-downloads allow-modals; object-src \'none\'"',
      '"content-security-policy": "object-src \'none\'"'],
  ]
  for (const [before, after] of replacements) {
    if (content.includes(after)) continue
    if (content.split(before).length !== 2) throw new Error('Better Sidebar auth adapter anchor mismatch')
    content = content.replace(before, after)
  }
  writeFileSync(path, content)
  const manifestPath = resolve(root, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.deepviewerAdapter = betterSidebarAdapter
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

export function stageBetterSidebar(upstream = resolve(project, 'upstream/deepseek-harness')) {
  const source = resolve(project, 'node_modules', betterSidebarName)
  const manifest = validateBetterSidebar(source)
  const app = JSON.parse(readFileSync(resolve(project, 'apps/deepviewer-desktop/package.json'), 'utf8'))
  if (app.dependencies?.[betterSidebarName] !== betterSidebarVersion) throw new Error('Better Sidebar must be version-pinned')
  const target = resolve(upstream, 'node_modules', betterSidebarName)
  const digest = createHash('sha256')
  for (const file of betterSidebarFiles) digest.update(readFileSync(resolve(source, file)))
  digest.update(readFileSync(fileURLToPath(import.meta.url)))
  digest.update(readFileSync(new URL('./adapt-better-sidebar-ui.mjs', import.meta.url)))
  digest.update(readFileSync(new URL('./sidebar-browser-client.js', import.meta.url)))
  const stamp = digest.digest('hex')
  if (!existsSync(resolve(target, '.deepviewer-stage')) || readFileSync(resolve(target, '.deepviewer-stage'), 'utf8') !== stamp) {
    rmSync(target, { recursive: true, force: true })
    cpSync(source, target, { recursive: true, filter: path => !path.includes('/node_modules/dsh-better-sidebar/node_modules') })
  }
  // Resolve peers from the pinned official workspace, never from a second npm DSH.
  const workspaces = []
  for (const base of ['vendor', 'packages']) {
    for (const entry of readdirSync(resolve(upstream, base), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const first = resolve(upstream, base, entry.name)
      if (existsSync(resolve(first, 'package.json'))) workspaces.push(first)
      else for (const child of readdirSync(first, { withFileTypes: true })) {
        if (child.isDirectory() && existsSync(resolve(first, child.name, 'package.json'))) workspaces.push(resolve(first, child.name))
      }
    }
  }
  const peers = new Map(workspaces.map(path => [JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8')).name, path]))
  for (const name of Object.keys(manifest.peerDependencies ?? {}).filter(name => name.startsWith('@deepseek-ai/'))) {
    const path = peers.get(name)
    if (!path) throw new Error(`Pinned DSH peer missing: ${name}`)
    const peer = JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'))
    if (peer.version !== (name === '@deepseek-ai/cordis' ? '4.0.2' : '0.1.5-rc.2')) throw new Error(`Pinned DSH peer mismatch: ${name}`)
    const link = resolve(target, 'node_modules', name)
    mkdirSync(dirname(link), { recursive: true })
    rmSync(link, { force: true, recursive: true })
    symlinkSync(path, link, 'dir')
  }
  adaptHost(target)
  adaptBetterSidebarUI(target)
  writeFileSync(resolve(target, '.deepviewer-stage'), stamp)
  return target
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) stageBetterSidebar()
