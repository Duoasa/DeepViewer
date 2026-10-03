/** Exercise the production closure in a temporary ASAR; no app, DMG or user profile is created. */
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'), upstream = resolve(appRoot, '../../upstream/deepseek-harness')
const require = createRequire(join(appRoot, 'package.json'))
const { register } = await import(createRequire(join(upstream, 'package.json')).resolve('tsx/esm/api')); register()
const { smokePreparedRuntime } = await import(join(upstream, 'apps/desktop/scripts/smoke-prepared-runtime.ts'))
const { officePackageDirectories } = await import(join(upstream, 'scripts/libreoffice-packages.mjs'))
const stage = resolve(process.argv.slice(2).find(value => value.startsWith('--stage='))?.slice(8) ?? join(appRoot, '.desktop/package-stage'))
const descriptor = JSON.parse(readFileSync(join(stage, 'app/dsh/desktop-runtime.json'), 'utf8'))
const fixture = mkdtempSync(join(tmpdir(), 'deepviewer-070-asar-')), archive = join(fixture, 'app.asar')
// Equivalent native binary and Office unpack policy to package-native.mjs.
const { createPackageWithOptions } = require('@electron/asar')
const stdout = process.stdout.write.bind(process.stdout)
process.stdout.write = (chunk, ...args) => stdout(chunk.toString().replace(/([?&]token=)[^&\s]+/gu, '$1[REDACTED]'), ...args)
try {
  const office = await officePackageDirectories(join(stage, 'app/dsh'), { platform: 'darwin', arch: 'arm64' })
  const unpackDirectories = office.map(path => `dsh/${path.slice(join(stage, 'app/dsh').length + 1)}`)
  await createPackageWithOptions(join(stage, 'app'), archive, {
    // asar matches absolute paths; spell out the source prefix so hidden worktree
    // ancestors do not suppress minimatch's native-file pattern.
    unpack: `${join(stage, 'app')}/**/{*.node,*.dylib,*.dll,*.so,*.so.*,*.exe,spawn-helper,rg}`,
    unpackDir: `{${unpackDirectories.join(',')}}`,
  })
  // The upstream smoke checks inventory, actual PTY/ripgrep/Koffi/sharp loading,
  // isolated Host composition and DOCX/XLSX/PPTX conversion, with shipped interpreters.
  const environment = { ...process.env }, isolated = { ...environment }
  for (const key of Object.keys(isolated)) if (/KEY|TOKEN|SECRET|PASSWORD/iu.test(key)) delete isolated[key]
  // DSH_HOME alone does not isolate the Office engine's user-font discovery/cache.
  // Keep all verification-owned user locations inside the disposable fixture.
  for (const key of ['HOME','XDG_CACHE_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','TMPDIR']) {
    const directory = join(fixture, key.toLowerCase())
    mkdirSync(directory, { recursive: true, mode: 0o700 }); isolated[key] = directory
  }
  delete isolated.FONTCONFIG_PATH; delete isolated.FONTCONFIG_FILE
  process.env = { ...isolated, DSH_TELEMETRY_MODE: 'DISABLED', DEEPVIEWER_HOST_PORT: '0' }
  try { await smokePreparedRuntime(join(archive, 'dsh'), require('electron'), join(stage, 'resources/runtime'), descriptor) }
  finally { process.env = environment }
  console.info(JSON.stringify({ result: 'PASS', productionASAR: true, inventory: true, nativePayloads: true, officeConversion: true, userProfile: false }))
} finally { rmSync(fixture, { recursive: true, force: true }) }
