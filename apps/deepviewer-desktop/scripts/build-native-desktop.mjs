import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { stageAdapter } from '../../deepviewer-adapter/scripts/stage.mjs'
import { buildModelCapabilitiesPlugin } from './build-model-capabilities-plugin.mjs'
import { stageSubscriptionsPlugin } from './stage-subscriptions.mjs'
import { compileNativeAppIcon } from './native-app-icon.mjs'
import { stageNativeModules } from '../../deepviewer-adapter/scripts/stage-native-modules.mjs'
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(appRoot, '../..'), upstream = join(root, 'upstream/deepseek-harness')
const product = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
function run(command, args, cwd = appRoot) { const r = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env }); if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`) }
if (!existsSync(join(upstream, '.git'))) throw new Error('Initialize the pinned DSH checkout with scripts/bootstrap-native-upstream.mjs')
run(process.execPath, [join(root, 'apps/deepviewer-adapter/scripts/prepare-upstream.mjs')], root)
if (!process.argv.includes('--skip-core-build')) run('pnpm', ['run', 'build'], upstream)
const adapter = stageAdapter(upstream)
buildModelCapabilitiesPlugin(upstream)
stageSubscriptionsPlugin()
const nativeCli = stageNativeModules(upstream, join(appRoot, '.desktop/native-cli'))
if (process.argv.includes('--core-only')) { console.info('DeepViewer core and adapter/plugin bundles prepared'); process.exit(0) }
const { register } = await import(createRequire(join(upstream, 'package.json')).resolve('tsx/esm/api'))
register()
const { prepareDevelopmentProject } = await import(join(upstream, 'apps/desktop/scripts/development-project.ts'))
const desktopRequire = createRequire(join(upstream, 'apps/desktop/package.json'))
const electron = createRequire(join(appRoot, 'package.json'))('electron')
const nodeVersion = spawnSync(electron, ['-p', 'process.versions.node'], { encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }).stdout.trim()
const projectDir = join(appRoot, '.desktop/native-runtime')
const version = JSON.parse(readFileSync(join(upstream, 'apps/cli/package.json'), 'utf8')).version
const pnpmVersion = JSON.parse(readFileSync(join(root, 'node_modules/pnpm/package.json'), 'utf8')).version
prepareDevelopmentProject({ projectDir, cliDir: nativeCli, hostDir: join(upstream, 'apps/desktop-host'), dependencyDir: join(upstream, 'node_modules/.pnpm/node_modules'), release: { schemaVersion: 1, version, hostProtocolVersion: 4, nodeVersion, pnpmVersion }, target: 'mac-arm64' })
const descriptorPath = join(projectDir, 'desktop-runtime.json'), descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'))
for (const name of ['@deepviewer/adapter', '@deepviewer/dsh-plugin-model-capabilities', 'dsh-plugin-subscriptions']) {
  const link = join(projectDir, 'node_modules', name); mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(join(upstream, 'node_modules', name), link)
  const manifest = JSON.parse(readFileSync(join(link, 'package.json'), 'utf8')); descriptor.sharedPackages.push({ name, version: manifest.version, path: `node_modules/${name}` })
}
writeFileSync(descriptorPath, JSON.stringify(descriptor, null, 2)+'\n')
for (const name of ['electron-updater', 'semver', 'ws', '@deepseek-ai/cordis', '@deepseek-ai/dsh-api-gateway', 'pnpm']) {
  const link = join(appRoot, 'node_modules', name), directory = name === 'pnpm' ? join(root, 'node_modules/pnpm') : dirname(desktopRequire.resolve(`${name}/package.json`))
  mkdirSync(dirname(link), { recursive: true }); rmSync(link, { recursive: true, force: true }); symlinkSync(directory, link)
}
run('pnpm', ['exec', 'vite', 'build', '--config', 'vite.main.config.ts'])
mkdirSync(join(appRoot, 'lib'), { recursive: true })
cpSync(join(appRoot, '.desktop/build/main.js'), join(appRoot, 'lib/main.js'))
// The official bundle reads its adjacent manifest via ../package.json.
cpSync(join(appRoot, 'package.json'), join(appRoot, 'lib/package.json'))
rmSync(join(appRoot, 'lib/official'), { recursive: true, force: true })
cpSync(join(upstream, 'apps/desktop/lib'), join(appRoot, 'lib/official'), { recursive: true })
rmSync(join(appRoot, 'renderer'), { recursive: true, force: true })
cpSync(join(upstream, 'apps/desktop/renderer'), join(appRoot, 'renderer'), { recursive: true })
appendFileSync(join(appRoot, 'lib/official/preload-app.cjs'), '\n' + readFileSync(join(root, 'apps/deepviewer-adapter/desktop/preload-state.cjs'), 'utf8'))
cpSync(join(upstream, 'apps/desktop/lib/preload-platform-account.cjs'), join(appRoot, 'lib/preload-platform-account.cjs'))
const assets = join(upstream, 'apps/web/dist/assets/deepviewer'); mkdirSync(assets, { recursive: true }); cpSync(join(adapter, 'assets'), assets, { recursive: true })
cpSync(join(upstream, 'apps/desktop/scripts/node-bin'), join(appRoot, 'scripts/node-bin'), { recursive: true })
await compileNativeAppIcon(appRoot)
if (process.argv.includes('--runtime')) {
  const { preparePrimaryRuntime } = await import(join(upstream, 'scripts/primary-runtime/prepare.ts'))
  await preparePrimaryRuntime({ target: 'mac-arm64', output: join(appRoot, '.desktop/runtime'), cache: join(appRoot, '.desktop/downloads'), version: product.version })
  const link = join(appRoot, '.desktop/primary-runtime'); rmSync(link, { recursive: true, force: true }); symlinkSync(join(appRoot, '.desktop/runtime/primary-runtime'), link)
} else if (!existsSync(join(appRoot, '.desktop/primary-runtime/runtime.json'))) {
  // Build our own payload by default. An explicit existing runtime is only a development smoke fixture.
  const fixture = process.env.DSH_DESKTOP_PRIMARY_RUNTIME_DIR
  if (fixture) { if (!existsSync(join(fixture, 'runtime.json'))) throw new Error('Invalid primary-runtime fixture') }
  else { const { preparePrimaryRuntime } = await import(join(upstream, 'scripts/primary-runtime/prepare.ts')); await preparePrimaryRuntime({ target: 'mac-arm64', output: join(appRoot, '.desktop/runtime'), cache: join(appRoot, '.desktop/downloads'), version: product.version }); symlinkSync(join(appRoot, '.desktop/runtime/primary-runtime'), join(appRoot, '.desktop/primary-runtime')) }
}
console.info(`DeepViewer ${product.version} official DesktopHost staged, core=${version}`)
