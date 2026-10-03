import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const nativeModuleNames = ['@deepviewer/adapter', '@deepviewer/dsh-plugin-model-capabilities', 'dsh-plugin-subscriptions']
/** Retain standalone source packaging, but ship integrated modules without installable bundle metadata. */
export function stageNativeModules(upstream, cliTarget) {
  const versions = {}
  for (const name of nativeModuleNames) {
    const path = join(upstream, 'node_modules', name, 'package.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    if (manifest.name !== name || !manifest.dsh?.client) throw new Error(`Native module manifest mismatch: ${name}`)
    delete manifest.dsh.bundle
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
    versions[name] = manifest.version
  }
  // Generate the application-owned CLI package. Keep upstream's manifest/lockfile unchanged,
  // so repeated bootstrap still uses its original frozen dependency installation.
  const source = join(upstream, 'apps/cli')
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  manifest.dependencies = { ...manifest.dependencies, ...versions }
  rmSync(cliTarget, { recursive: true, force: true }); mkdirSync(cliTarget, { recursive: true })
  cpSync(join(source, 'lib'), join(cliTarget, 'lib'), { recursive: true })
  writeFileSync(join(cliTarget, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  for (const name of Object.keys(manifest.dependencies)) {
    const directory = nativeModuleNames.includes(name) ? join(upstream,'node_modules',name) : join(source,'node_modules',name)
    if (!existsSync(join(directory,'package.json'))) throw new Error(`Missing native CLI dependency: ${name}`)
    const link = join(cliTarget,'node_modules',name); mkdirSync(dirname(link),{recursive:true}); symlinkSync(directory,link,'dir')
  }
  return cliTarget
}
