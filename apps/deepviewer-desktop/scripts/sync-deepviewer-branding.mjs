import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Apply DeepViewer's brand overlay to the already-restored, pinned Harness source.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const upstream = resolve(appRoot, '../../upstream/deepseek-harness')
const app = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'))
const core = JSON.parse(readFileSync(resolve(upstream, 'package.json'), 'utf8'))
const stamp = resolve(appRoot, '.desktop/deepviewer-branding.sha256')
const entries = new Map()
const read = path => readFileSync(resolve(appRoot, path), 'utf8')

// Persist DeepViewer's file-protection presentation over the pinned Harness UI.
for (const path of [
  'src/client/tool/models/tool-call-model.ts',
  'src/client/tool/components/ToolRow.tsx',
  'src/client/tool/components/ToolRow.module.css',
  'src/client/tool/toolviews/file-mutation-row.tsx',
  'src/client/tool/toolviews/GenericToolCard.tsx',
  'tests/file-protection-tone.client.spec.tsx',
]) {
  entries.set(`packages/client/ui-tool/${path}`, read(`upstream-overrides/ui-tool/${path}`))
}

const skeleton = 'packages/client/ui-conversation/src/client/skeleton'
for (const name of ['EmptyHero.tsx', 'ConversationContent.tsx', 'DeepViewerMascot.tsx', 'mascot-motion.ts']) {
  entries.set(`${skeleton}/${name}`, read(`upstream-overrides/ui-conversation/${name}`))
}
for (const [file, marker, override] of [
  ['HeroShell.module.css', 'hide-empty-hero-branding', 'HideEmptyHeroBranding.module.css'],
  ['ConversationRoot.module.css', 'bottom-align-empty-composer', 'CenteredWelcome.module.css'],
]) {
  const source = readFileSync(resolve(upstream, skeleton, file), 'utf8')
  const start = `/* DeepViewer override:start ${marker} */`
  const end = `/* DeepViewer override:end ${marker} */`
  const from = source.indexOf(start)
  const to = source.indexOf(end)
  if (from < 0 || to <= from) throw new Error(`Missing welcome overlay boundary: ${file}`)
  entries.set(`${skeleton}/${file}`, source.slice(0, from + start.length) + '\n'
    + read(`upstream-overrides/ui-conversation/${override}`).trim() + '\n' + source.slice(to))
}
const conversationLocalePath = 'packages/client/ui-conversation/src/client/locales.ts'
entries.set(conversationLocalePath, readFileSync(resolve(upstream, conversationLocalePath), 'utf8')
  .replace("'hero.headline': '让我们做点什么'", "'hero.headline': '今天想做点什么？'")
  .replace("'hero.headline': 'What shall we build?'", "'hero.headline': 'What would you like to do today?'"))
for (const path of ['packages/client/ui-chat/src/client/locale.ts',
  'packages/client/ui-chat/tests/chat-view.client.spec.tsx']) {
  entries.set(path, readFileSync(resolve(upstream, path), 'utf8')
    .replaceAll('深度求索中', '深度求索中'))
}
entries.set('packages/client/ui-deliverables/src/file-delivery-prompt.ts',
  read('upstream-overrides/ui-deliverables/file-delivery-prompt.ts'))
for (const path of ['packages/client/ui-workspace/src/client/locales.ts',
  'packages/client/ui-chat/src/client/apply.ts']) {
  entries.set(path, readFileSync(resolve(upstream, path), 'utf8')
    .replaceAll('DeepViewer/Projects', 'DeepViewer/Projects')
    .replaceAll("'DeepViewer: native file preview'", "'DeepViewer: native file preview'"))
}
const projectsCommandPath = 'packages/api/workspace-controller/src/commands.ts'
entries.set(projectsCommandPath, readFileSync(resolve(upstream, projectsCommandPath), 'utf8')
  .replace('const root = process.env.DEEPVIEWER_PROJECTS_ROOT',
    'const root = process.env.DEEPVIEWER_PROJECTS_ROOT ?? process.env.DEEPVIEWER_PROJECTS_ROOT'))
entries.set('apps/web/public/deepviewer-mascot.png',
  readFileSync(resolve(appRoot, 'assets/deepviewer-mascot-portrait.png')))
// Keep the existing resident-input regression suite aligned with the brand
// overlay; all editor identity and draft-survival assertions remain intact.
const heroTestPath = 'packages/client/ui-conversation/tests/skeleton.client.spec.tsx'
entries.set(heroTestPath, readFileSync(resolve(upstream, heroTestPath), 'utf8')
  .replaceAll('What shall we build?', 'What would you like to do today?')
  .replaceAll('让我们做点什么', '今天想做点什么？')
  .replace("expect(view.container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 150.374 160')",
    "expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/deepviewer-mascot.png')"))

entries.set('packages/client/ui-settings-general/src/client/AboutSection.tsx',
  read('upstream-overrides/ui-settings-general/AboutSection.tsx')
    .replaceAll('__DEEPVIEWER_VERSION__', app.version)
    .replaceAll('__DEEPVIEWER_BUILD_NUMBER__', String(app.buildNumber))
    .replaceAll('__DEEPSEEK_HARNESS_VERSION__', core.version))
entries.set('packages/client/ui-brand-official/src/client/Brand.tsx',
  read('upstream-overrides/ui-brand-official/Brand.tsx'))
entries.set('packages/client/ui-settings-general/src/client/AboutSection.module.css',
  read('upstream-overrides/ui-settings-general/AboutSection.module.css'))

const localePath = 'packages/client/ui-settings-general/src/client/locales.ts'
let locales = readFileSync(resolve(upstream, localePath), 'utf8')
for (const language of ['zh', 'en']) {
  const start = `/* DeepViewer override:start about-deepviewer-locales-${language} */`
  const end = `/* DeepViewer override:end about-deepviewer-locales-${language} */`
  const from = locales.indexOf(start)
  const to = locales.indexOf(end)
  if (from < 0 || to <= from || locales.indexOf(start, from + start.length) >= 0) {
    throw new Error(`Cannot locate the pinned About locale block: ${language}`)
  }
  const fragment = read(`upstream-overrides/ui-settings-general/AboutLocales.${language}.fragment`)
    .trim().split('\n').map(line => `  ${line}`).join('\n')
  locales = locales.slice(0, from + start.length) + '\n' + fragment + '\n  ' + locales.slice(to)
}
entries.set(localePath, locales)
entries.set('apps/web/public/deepviewer-icon.png',
  readFileSync(resolve(appRoot, 'assets/deepviewer-icon-macos26-1024.png')))
entries.set('apps/web/public/deepviewer-icon-dark.png',
  readFileSync(resolve(appRoot, 'assets/deepviewer-icon-dark-1024.png')))

let changed = false
const hash = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url)))
for (const [relative, content] of entries) {
  const target = resolve(upstream, relative)
  const bytes = Buffer.from(content)
  hash.update(relative).update(bytes)
  if (!existsSync(target) || !readFileSync(target).equals(bytes)) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    changed = true
  }
}
const digest = hash.digest('hex')
const built = ['packages/client/ui-settings-general/lib/client.js',
  'packages/client/ui-brand-official/lib/client.js', 'apps/web/dist/deepviewer-icon.png',
  'apps/web/dist/deepviewer-icon-dark.png', 'apps/web/dist/deepviewer-mascot.png']
const needsBuild = changed || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== digest
  || built.some(path => !existsSync(resolve(upstream, path)))
if (process.argv.includes('--build') && needsBuild) {
  const result = spawnSync('pnpm', ['run', 'build:official'], { cwd: upstream, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`DeepViewer client build failed: ${result.status}`)
  mkdirSync(dirname(stamp), { recursive: true })
  writeFileSync(stamp, digest)
}
console.log(`DeepViewer branding ${app.version} (${app.buildNumber}): ${needsBuild ? 'synchronized' : 'current'}`)
