import { cpSync, existsSync, globSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { productionGraph } from '../../deepviewer-desktop/scripts/native-package-closure.mjs'
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function stageAdapter(upstream) {
  const target = join(upstream, 'node_modules', '@deepviewer', 'adapter')
  mkdirSync(target, { recursive: true })
  for (const dir of ['src', 'lib', 'assets']) rmSync(join(target, dir), { recursive: true, force: true })
  mkdirSync(join(target, 'src'), { recursive: true })
  cpSync(join(source, 'client'), join(target, 'src', 'client'), { recursive: true })
  const product = JSON.parse(readFileSync(join(source, '../deepviewer-desktop/package.json'), 'utf8'))
  writeFileSync(join(target, 'src/client/build-info.ts'), `export const buildInfo = ${JSON.stringify({ version: product.version, build: String(product.buildNumber), kernel: '0.2.0-rc.2' })}\n`)
  cpSync(join(source, 'workflows'), join(target, 'src', 'workflows'), { recursive: true })
  cpSync(join(source, 'index.ts'), join(target, 'src', 'index.ts'))
  cpSync(join(source, 'assets'), join(target, 'assets'), { recursive: true })
  for (const file of ['package.json', 'cordis.patch.yml', 'UPSTREAM-LICENSE']) cpSync(join(source, file), join(target, file))
  const packages = new Map()
  for (const file of globSync(['packages/*/*/package.json', 'apps/*/package.json', 'vendor/*/package.json'], { cwd: upstream })) {
    const path = join(upstream, file), manifest = JSON.parse(readFileSync(path, 'utf8'))
    packages.set(manifest.name, dirname(path))
  }
  for (const [name, directory] of packages) {
    const link = join(target, 'node_modules', name)
    mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(directory, link)
  }
  for (const [name, path] of [['react', 'packages/client/ui-renderer/node_modules/react'], ['@types/react', 'packages/client/ui-renderer/node_modules/@types/react'], ['@types/node', 'node_modules/@types/node']]) {
    const link = join(target, 'node_modules', name)
    mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(join(upstream, path), link)
  }
  for (const name of ['state', 'view', 'commands', 'search', 'language', 'lang-javascript', 'lang-json', 'lang-markdown', 'lang-python', 'lang-html', 'lang-css']) {
    const link = join(target, 'node_modules/@codemirror', name)
    mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(join(source, '../../node_modules/@codemirror', name), link)
  }
  const bundled = productionGraph(['state', 'view', 'commands', 'search', 'language', 'lang-javascript', 'lang-json', 'lang-markdown', 'lang-python', 'lang-html', 'lang-css'].map(name => join(source, '../../node_modules/@codemirror', name)))
  const licenses = []
  for (const record of bundled.records.values()) {
    const paths = globSync(['LICENSE*', 'LICENCE*', 'COPYING*'], { cwd: record.id })
    if (paths.length === 0) throw new Error(`Bundled dependency license missing: ${record.manifest.name}`)
    licenses.push(`${record.manifest.name}@${record.manifest.version}\n${paths.map(path => readFileSync(join(record.id, path), 'utf8')).join('\n')}`)
  }
  writeFileSync(join(target, 'THIRD-PARTY-LICENSES.txt'), licenses.join('\n\n---\n\n'))
  writeFileSync(join(target, 'src', 'client', 'index.ts'), "export { apply, inject } from './index.tsx'\n")
  writeFileSync(join(target, 'src', 'client', 'assets.d.ts'), "declare module '*.module.css' { const css: Record<string,string>; export default css }\ndeclare module '*.css?inline' { const css: string; export default css }\n")
  writeFileSync(join(target, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2023', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true, types: ['node'], lib: ['ES2023', 'DOM', 'DOM.Iterable'] }, include: ['src/client/**/*'] }))
  const typecheck = spawnSync(process.execPath, [join(upstream, 'node_modules/typescript/bin/tsc'), '-p', join(target, 'tsconfig.json')], { cwd: target, stdio: 'inherit' })
  if (typecheck.status !== 0) throw new Error('DeepViewer adapter typecheck failed')
  const hostConfig = JSON.parse(readFileSync(join(target, 'tsconfig.json'), 'utf8')); hostConfig.include = ['src/index.ts', 'src/workflows/**/*']; hostConfig.compilerOptions.lib = ['ES2023']; writeFileSync(join(target, 'tsconfig.host.json'), JSON.stringify(hostConfig))
  const hostCheck = spawnSync(process.execPath, [join(upstream, 'node_modules/typescript/bin/tsc'), '-p', join(target, 'tsconfig.host.json')], { cwd: target, stdio: 'inherit' })
  if (hostCheck.status !== 0) throw new Error('DeepViewer adapter host typecheck failed')
  cpSync(join(source, 'workflows/vendor/BETTER-SIDEBAR-LICENSE'), join(target, 'BETTER-SIDEBAR-LICENSE'))
  const config = join(target, 'tsdown.config.mjs')
  writeFileSync(config, `import { clientBundle } from ${JSON.stringify(join(upstream, 'packages/client/tsdown.client.ts'))}\nexport default clientBundle('@deepviewer/adapter', ['src/index.ts', 'src/workflows/chat-guard.ts'])\n`)
  const built = spawnSync(join(upstream, 'node_modules/.bin/tsdown'), ['--config', config], { cwd: target, stdio: 'inherit', env: { ...process.env, DSH_EXTERNAL_WORKSPACE_MANIFEST: join(target, 'package.json') } })
  if (built.status !== 0 || !existsSync(join(target, 'lib/client.js'))) throw new Error('DeepViewer adapter bundle failed')
  return target
}
