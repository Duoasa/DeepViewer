import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const modelCapabilitiesPluginName = '@deepviewer/dsh-plugin-model-capabilities'
export const modelCapabilitiesPluginVersion = '1.0.2'
const sourceFiles = ['package.json', 'cordis.patch.yml', 'LICENSE', 'UPSTREAM.md', 'tsconfig.json']

export function buildModelCapabilitiesPlugin(upstream = resolve(project, 'upstream/deepseek-harness')) {
  const source = resolve(project, 'apps/dsh-plugin-model-capabilities')
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  if (manifest.name !== modelCapabilitiesPluginName || manifest.version !== modelCapabilitiesPluginVersion) throw new Error('Model capabilities plugin identity mismatch')
  const target = resolve(upstream, 'node_modules', modelCapabilitiesPluginName)
  const hash = createHash('sha256')
  const scan = relative => {
    for (const entry of readdirSync(join(source, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(relative, entry.name)
      if (entry.isDirectory()) scan(child)
      else if (entry.isFile()) hash.update(child).update(readFileSync(join(source, child)))
      else throw new Error('Plugin source must contain regular files only')
    }
  }
  scan('src')
  for (const file of sourceFiles) hash.update(file).update(readFileSync(join(source, file)))
  hash.update(readFileSync(fileURLToPath(import.meta.url)))
  hash.update(readFileSync(join(upstream, 'packages/client/tsdown.client.ts')))
  const digest = hash.digest('hex'), stamp = join(target, '.build-stamp')
  const outputs = ['lib/index.js', 'lib/client.js', 'lib/client.js.map', 'cordis.patch.yml', 'LICENSE']
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === digest && outputs.every(file => existsSync(join(target, file)))) return target

  mkdirSync(target, { recursive: true })
  for (const directory of ['lib', 'src']) rmSync(join(target, directory), { recursive: true, force: true })
  cpSync(join(source, 'src'), join(target, 'src'), { recursive: true })
  for (const file of sourceFiles) cpSync(join(source, file), join(target, file))
  const peers = {
    '@deepseek-ai/cordis': 'vendor/cordis', '@deepseek-ai/schemastery': 'vendor/schemastery',
    '@deepseek-ai/dsh-api-remotes': 'packages/api/remotes', '@deepseek-ai/dsh-credentials': 'packages/credentials/credentials',
    '@deepseek-ai/dsh-home-paths': 'packages/util/home-paths', '@deepseek-ai/dsh-llm-pi-ai': 'packages/llm/llm-pi-ai',
    react: 'packages/client/ui-renderer/node_modules/react', '@types/react': 'packages/client/ui-renderer/node_modules/@types/react',
    '@types/node': 'node_modules/@types/node',
  }
  for (const name of ['ui-settings', 'ui-settings-models', 'ui-slots', 'locale']) peers['@deepseek-ai/dsh-client-' + name] = 'packages/client/' + name
  for (const [name, directory] of Object.entries(peers)) {
    const link = join(target, 'node_modules', name)
    mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(resolve(upstream, directory), link, 'dir')
  }
  const checked = spawnSync(process.execPath, [join(upstream, 'node_modules/typescript/bin/tsc'), '-p', join(target, 'tsconfig.json'), '--noEmit'], { cwd: target, stdio: 'inherit' })
  if (checked.status !== 0) throw new Error('Model capabilities RC2 typecheck failed')
  // Use the pinned DSH bundler for native staging; no registry or temporary toolchain dependency.
  const config = join(target, 'tsdown.config.mjs')
  writeFileSync(config, `import { clientBundle } from ${JSON.stringify(join(upstream, 'packages/client/tsdown.client.ts'))}\nexport default clientBundle('${modelCapabilitiesPluginName}', ['src/index.mjs'])\n`)
  const result = spawnSync(join(upstream, 'node_modules/.bin/tsdown'), ['--config', config], {
    cwd: target, stdio: 'inherit', env: { ...process.env, DSH_EXTERNAL_WORKSPACE_MANIFEST: join(target, 'package.json') },
  })
  if (result.status !== 0 || outputs.some(file => !existsSync(join(target, file)))) throw new Error('Model capabilities native build failed')
  writeFileSync(stamp, digest)
  return target
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildModelCapabilitiesPlugin()
