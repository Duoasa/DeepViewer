/** Materialize installed production dependency graphs. No development hoist or external symlink is shipped. */
import { cpSync, existsSync, globSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
export function locatePackage(name, from) {
  for (const directory of createRequire(join(from, 'package.json')).resolve.paths(name) ?? []) {
    const path = join(directory, name, 'package.json')
    if (existsSync(path)) return realpathSync(dirname(path))
  }
  throw new Error(`Production dependency missing: ${name}`)
}
function supports(manifest, platform, arch) {
  const accepts = (values, value) => values === undefined || (!values.includes(`!${value}`) && (!values.some(item => !item.startsWith('!')) || values.includes(value)))
  return accepts(manifest.os, platform) && accepts(manifest.cpu, arch)
}
export function productionGraph(roots, target = { platform: 'darwin', arch: 'arm64' }) {
  const records = new Map(), rootIds = []
  const visit = directory => {
    const id = realpathSync(directory); if (records.has(id)) return id
    const manifest = JSON.parse(readFileSync(join(id, 'package.json'), 'utf8'))
    if (!supports(manifest, target.platform, target.arch)) throw new Error(`Wrong target dependency: ${manifest.name}`)
    const record = { id, manifest, dependencies: [] }; records.set(id, record)
    const optional = { ...Object.fromEntries(Object.entries(manifest.peerDependenciesMeta ?? {}).filter(([,meta]) => meta.optional).map(([name]) => [name, true])), ...manifest.optionalDependencies }
    for (const name of new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})])) {
      let path
      try { path = locatePackage(name, id) } catch (error) { if (name in optional) continue; throw error }
      const dependency = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
      if (!supports(dependency, target.platform, target.arch) && name in optional) continue
      record.dependencies.push({ name, id: visit(path) })
    }
    return id
  }
  for (const root of roots) rootIds.push(visit(root))
  return { records, rootIds, target }
}
function selectedFiles(record) {
  if (!Array.isArray(record.manifest.files)) return undefined // npm-installed payload already passed its package file policy.
  const roots = globSync(record.manifest.files.filter(pattern => !pattern.startsWith('!')), { cwd: record.id })
  // npm also includes declared entry points even when `files` omits them. The
  // installed @img/colour package exercises this rule (index.cjs vs color.cjs).
  const entryPoints = []
  const visit = value => {
    if (typeof value === 'string') entryPoints.push(value.replace(/^\.\//, ''))
    else if (value && typeof value === 'object') for (const child of Object.values(value)) visit(child)
  }
  for (const field of ['main', 'module', 'browser', 'bin', 'exports']) visit(record.manifest[field])
  for (const path of entryPoints) roots.push(...globSync([path, `${path}.js`, `${path}.cjs`, `${path}.json`], { cwd: record.id }))
  return new Set(['package.json', ...roots, ...readdirSync(record.id).filter(name => /^(license|licence|copying|notice|readme)(\.|$)/iu.test(name))])
}
/** Copy dependency-local version conflicts into nested node_modules; compatible records share the root. */
export function materializeClosure(graph, output, exclude = () => undefined, upstreamLicense) {
  rmSync(output, { recursive: true, force: true }); mkdirSync(join(output, 'node_modules'), { recursive: true })
  const chosen = new Map(), copied = new Set(), inventory = []
  for (const id of [...graph.rootIds, ...graph.records.keys()]) { const record = graph.records.get(id); if (!chosen.has(record.manifest.name)) chosen.set(record.manifest.name, id) }
  function copy(id, destination, ancestors = new Map()) {
    const key = destination; if (copied.has(key)) return; copied.add(key)
    const record = graph.records.get(id), selected = selectedFiles(record)
    const include = name => selected === undefined || selected.has(name) || [...selected].some(root => name.startsWith(root + '/') || root.startsWith(name + '/'))
    mkdirSync(destination, { recursive: true })
    cpSync(record.id, destination, { recursive: true, dereference: true, filter: source => {
      const path = relative(record.id, source).split(sep).join('/'); if (!path) return true
      if (path.split('/').includes('node_modules') || !include(path)) return false
      const resolved = realpathSync(source), child = relative(record.id, resolved)
      if (child === '..' || child.startsWith('../')) throw new Error(`Package contains escaping link: ${record.manifest.name}/${path}`)
      return exclude(`node_modules/${record.manifest.name}/${path}`, graph.target, 'darwin-arm64') === undefined
    } })
    const manifest = { ...record.manifest }
    delete manifest.devDependencies; delete manifest.scripts; delete manifest.private
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) if (manifest[field]) manifest[field] = Object.fromEntries(Object.entries(manifest[field]).map(([name, range]) => [name, typeof range === 'string' && range.startsWith('workspace:') ? graph.records.get(record.dependencies.find(item => item.name === name)?.id)?.manifest.version ?? range : range]))
    writeFileSync(join(destination, 'package.json'), JSON.stringify(manifest, null, 2)+'\n')
    if (manifest.name.startsWith('@deepseek-ai/') && upstreamLicense && !existsSync(join(destination, 'LICENSE'))) writeFileSync(join(destination, 'LICENSE'), upstreamLicense)
    inventory.push({ name: manifest.name, version: manifest.version, license: manifest.license ?? 'SEE PACKAGE', path: relative(output, destination).split(sep).join('/') })
    const current = new Map(ancestors); current.set(manifest.name, id)
    for (const dependency of record.dependencies) {
      if (chosen.get(dependency.name) === dependency.id || current.get(dependency.name) === dependency.id) continue
      copy(dependency.id, join(destination, 'node_modules', dependency.name), current)
    }
  }
  for (const [name, id] of chosen) copy(id, join(output, 'node_modules', name))
  writeFileSync(join(output, 'THIRD-PARTY-PACKAGES.json'), JSON.stringify(inventory, null, 2)+'\n')
  return inventory
}
export function auditRuntime(root) {
  let bytes = 0, files = 0
  for (const path of globSync('**/*', { cwd: root, dot: true })) {
    const absolute = join(root, path), info = lstatSync(absolute)
    if (info.isSymbolicLink()) throw new Error(`Unmaterialized runtime link: ${path}`)
    if (info.isFile()) { files++; bytes += info.size; if (/\.map$/.test(path) || /(?:^|\/)dsh-better-sidebar(?:\/|$)/.test(path)) throw new Error(`Retired/diagnostic payload: ${path}`) }
  }
  const report = { files, bytes, sha256: createHash('sha256').update(readFileSync(join(root, 'THIRD-PARTY-PACKAGES.json'))).digest('hex') }
  return report
}
