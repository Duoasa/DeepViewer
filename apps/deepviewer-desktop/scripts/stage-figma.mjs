/** Stage the pinned public plugin, never a generated/private paired companion. */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { locatePackage } from './native-package-closure.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export function stageFigmaPlugin() {
  const source = join(root, 'vendor/dsh-to-figma'), upstream = join(root, 'upstream/deepseek-harness')
  const provenance = JSON.parse(readFileSync(join(source, 'UPSTREAM.json'), 'utf8'))
  if (provenance.commit !== 'ffc4d3a1c59d8c9e53261e4e9d8a5e8e6e174412') throw new Error('Unexpected Figma source revision')
  for (const [file, hash] of Object.entries(provenance.files)) {
    if (createHash('sha256').update(readFileSync(join(source, file))).digest('hex') !== hash) throw new Error(`Figma source differs from pinned release: ${file}`)
  }
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  if (manifest.name !== 'dsh-to-figma' || manifest.version !== '0.2.1' || manifest.license !== 'MIT') throw new Error('Invalid Figma manifest')
  const semver = createRequire(join(upstream, 'apps/desktop/package.json'))('semver')
  const dependencies = Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies }).map(([name, range]) => {
    const directory = locatePackage(name, name in (manifest.dependencies ?? {}) ? join(root, 'apps/deepviewer-desktop') : join(upstream, 'node_modules/.pnpm'))
    const actual = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    if (!semver.satisfies(actual.version, range)) throw new Error(`Incompatible Figma dependency: ${name}@${actual.version}`)
    return [name, directory]
  })
  const target = join(upstream, 'node_modules/dsh-to-figma')
  rmSync(target, { recursive: true, force: true }); mkdirSync(target, { recursive: true })
  // Documentation/screenshots/test fixtures remain in source control, not in the runtime.
  manifest.files = ['index.mjs', 'cli.mjs', 'lib', 'companion', 'skills', 'locale', 'assets/icon.svg', 'LICENSE', 'codex-tool-baseline.json']
  for (const file of manifest.files) { mkdirSync(dirname(join(target, file)), { recursive: true }); cpSync(join(source, file), join(target, file), { recursive: true }) }
  delete manifest.devDependencies; delete manifest.scripts; delete manifest.dsh.bundle
  writeFileSync(join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  for (const [name, directory] of dependencies) {
    const link = join(target, 'node_modules', name); mkdirSync(dirname(link), { recursive: true }); symlinkSync(directory, link, 'dir')
  }
  if (!existsSync(join(target, 'companion/code.js'))) throw new Error('Missing public companion entry')
  console.info('Staged native dsh-to-figma@0.2.1 with pinned Harness peers')
  return target
}
