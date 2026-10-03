/** Normalize sealed dependency manifests with the exact Electron builder transformer. */
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveTransformer() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const builderRequire = createRequire(join(projectRoot, 'upstream/deepseek-harness/apps/desktop/package.json'))
  return builderRequire('app-builder-lib/out/fileTransformer.js').createTransformer
}

/**
 * Normalize before writeDesktopRuntime seals the final bytes. Builder configuration
 * must match the subsequent build; the default preserves its metadata defaults.
 * The injected factory is useful for verifying the real packaging dependency.
 */
export async function normalizeNativePackageMetadata(appPath, {
  runtimeRoot = join(appPath, 'dsh'), configuration = {}, createTransformer = resolveTransformer(),
} = {}) {
  const app = resolve(appPath), runtime = resolve(runtimeRoot), child = relative(app, runtime)
  if (child === '' || isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`)) {
    throw new Error('native package metadata: runtime must be contained in the staged app')
  }
  const rootMetadata = await lstat(runtime)
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error('native package metadata: runtime must be a materialized directory')
  }
  const transform = createTransformer(app, configuration, undefined, null)
  const manifests = []
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (!entry.isFile()) throw new Error('native package metadata: runtime contains an unsupported filesystem entry')
      else if (entry.name === 'package.json' && path.includes(`${sep}node_modules${sep}`)) manifests.push(path)
    }
  }
  await visit(runtime)
  manifests.sort()
  let normalizedManifests = 0
  for (const path of manifests) {
    const display = relative(runtime, path).split(sep).join('/')
    try {
      const manifest = JSON.parse(await readFile(path, 'utf8'))
      if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('invalid object')
    } catch {
      throw new Error(`native package metadata: invalid dependency manifest ${display}`)
    }
    const transformed = await transform(path)
    if (transformed !== null && typeof transformed !== 'string' && !Buffer.isBuffer(transformed)) {
      throw new Error(`native package metadata: transformer failed for ${display}`)
    }
    if (transformed !== null) {
      await writeFile(path, transformed)
      normalizedManifests += 1
    }
    // An undefined result may be a swallowed read/parse failure in the builder.
    // Require its explicit no-change result rather than silently sealing a miss.
    if (await transform(path) !== null) {
      throw new Error(`native package metadata: transformer is not idempotent for ${display}`)
    }
  }
  return { packageManifests: manifests.length, normalizedManifests }
}
