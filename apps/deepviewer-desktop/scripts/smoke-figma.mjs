/** Run upstream security/companion fixtures and native services against the shipped plugin. */
import { cpSync, mkdtempSync, rmSync, symlinkSync, readdirSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { locatePackage } from './native-package-closure.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const runtime = process.env.DEEPVIEWER_RUNTIME_OVERRIDE ?? join(root, 'upstream/deepseek-harness/node_modules/.pnpm')
const plugin = process.env.DEEPVIEWER_RUNTIME_OVERRIDE ? join(runtime, 'node_modules/dsh-to-figma') : join(root, 'upstream/deepseek-harness/node_modules/dsh-to-figma')
const fixture = mkdtempSync(join(tmpdir(), 'deepviewer-figma-tests-'))
try {
  cpSync(join(root, 'vendor/dsh-to-figma'), fixture, { recursive: true })
  const manifest = JSON.parse(readFileSync(join(plugin, 'package.json'), 'utf8'))
  for (const name of Object.keys({...manifest.dependencies, ...manifest.peerDependencies})) { const link = join(fixture, 'node_modules', name); mkdirSync(dirname(link), {recursive:true}); symlinkSync(locatePackage(name, plugin), link, 'dir') }
  for (const args of [
    ['--test', ...readdirSync(join(fixture, 'test')).filter(name => name.endsWith('.test.mjs')).map(name => join(fixture, 'test', name))],
    [join(fixture, 'test/native.mjs')],
  ]) {
    const run = spawnSync(process.execPath, args, { stdio: 'inherit', timeout: 120000, env: { ...process.env, DSH_FIGMA_TEST_ENTRY: join(plugin, 'index.mjs'), DSH_FIGMA_TEST_RUNTIME: runtime } })
    if (run.status !== 0) throw new Error('Figma fixture/native smoke failed')
  }
} finally { rmSync(fixture, { recursive: true, force: true }) }
