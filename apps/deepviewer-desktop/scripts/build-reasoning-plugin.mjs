import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const reasoningPluginName = '@deepviewer/dsh-plugin-reasoning'
export function buildReasoningPlugin(upstream = resolve(project, 'upstream/deepseek-harness')) {
  const source = resolve(project, 'apps/dsh-plugin-reasoning')
  const target = resolve(upstream, 'node_modules', reasoningPluginName)
  const hash = createHash('sha256')
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) scan(path)
      else hash.update(path.slice(source.length)).update(readFileSync(path))
    }
  }
  scan(source)
  hash.update(readFileSync(fileURLToPath(import.meta.url)))
  const digest = hash.digest('hex')
  const stamp = resolve(target, '.build-stamp')
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === digest && ['lib/client.js', 'lib/index.js'].every(file => existsSync(resolve(target, file)))) return target
  mkdirSync(target, { recursive: true })
  rmSync(resolve(target, 'lib'), { recursive: true, force: true })
  cpSync(source, target, { recursive: true })
  const peers = { '@deepseek-ai/cordis': 'vendor/cordis', '@deepseek-ai/dsh-api-remotes': 'packages/api/remotes', '@deepseek-ai/dsh-settings': 'packages/settings/settings', '@deepseek-ai/dsh-credentials': 'packages/credentials/credentials', '@deepseek-ai/dsh-home-paths': 'packages/util/home-paths' }
  for (const name of ['ui-settings', 'ui-settings-models', 'ui-slots', 'ui-renderer', 'locale', 'connection']) peers['@deepseek-ai/dsh-client-' + name] = 'packages/client/' + name
  peers.react = 'packages/client/ui-renderer/node_modules/react'
  peers['@types/react'] = 'packages/client/ui-renderer/node_modules/@types/react'
  for (const [name, directory] of Object.entries(peers)) {
    const link = resolve(target, 'node_modules', name)
    mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(resolve(upstream, directory), link, 'dir')
  }
  // Typecheck the external Client against the built RC2 contract, not just tsdown's transpilation.
  writeFileSync(resolve(target, 'deepviewer-client-globals.d.ts'), 'declare module "*.module.css" { const classes: Record<string, string>; export default classes }\n')
  writeFileSync(resolve(target, 'deepviewer-client.tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true,
      noEmit: true, allowImportingTsExtensions: true, allowJs: true, checkJs: false, types: ['react', 'node'], lib: ['ES2022', 'DOM'] },
    include: ['src/client/**/*', 'deepviewer-client-globals.d.ts'], exclude: [],
  }, null, 2))
  const checked = spawnSync(process.execPath, [resolve(upstream, 'node_modules/typescript/bin/tsc'), '-p', resolve(target, 'deepviewer-client.tsconfig.json')], { cwd: target, stdio: 'inherit' })
  if (checked.status !== 0) throw new Error('Reasoning plugin RC2 Client typecheck failed')
  writeFileSync(resolve(target, 'tsdown.config.mjs'), `import { clientBundle } from ${JSON.stringify(resolve(upstream, 'packages/client/tsdown.client.ts'))}\nexport default clientBundle('${reasoningPluginName}', ['src/index.ts'])\n`)
  // Invoke the checked-in workspace binary directly. `pnpm exec` may trigger a
  // registry-backed dependency reconciliation when this nested package is
  // linked into the upstream workspace, which makes an offline dev build hang.
  const tsdown = resolve(upstream, 'node_modules', '.bin', 'tsdown')
  const command = existsSync(tsdown) ? tsdown : 'pnpm'
  const args = existsSync(tsdown) ? ['--config', resolve(target, 'tsdown.config.mjs')] : ['exec', 'tsdown', '--config', resolve(target, 'tsdown.config.mjs')]
  const result = spawnSync(command, args, { cwd: target, stdio: 'inherit', env: { ...process.env, DSH_EXTERNAL_WORKSPACE_MANIFEST: resolve(target, 'package.json') } })
  if (result.status !== 0) throw new Error('Reasoning plugin build failed')
  writeFileSync(stamp, digest)
  return target
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildReasoningPlugin()
