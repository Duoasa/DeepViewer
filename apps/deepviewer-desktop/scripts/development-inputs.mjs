import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, normalize } from 'node:path'

const watchedDirectories = ['src/main', 'assets']
const watchedFiles = new Set([
  'package.json',
  'tsconfig.json',
  'vite.main.config.ts',
  'vite.preload.config.ts',
  'vite.renderer.config.ts',
  'scripts/sync-deepviewer-branding.mjs',
  'scripts/sync-upstream-overrides.mjs',
  'scripts/stage-subscriptions.mjs',
  'scripts/adapt-subscriptions-plugin.mjs',
  'scripts/subscriptions-v4-messages.mjs',
  'scripts/prepare-subscriptions-client.mjs',
  'scripts/build-native-desktop.mjs',
  'scripts/bootstrap-native-upstream.mjs',
  'scripts/build-model-capabilities-plugin.mjs',
  'scripts/native-app-icon.mjs',
  'scripts/development-shell.mjs',
])

function isTemporaryName(name) {
  return name.startsWith('.') || name.endsWith('~') || /\.(?:swp|swx|tmp)$/u.test(name)
}

export function shouldRestartForDevelopmentPath(path) {
  if (typeof path !== 'string' || path === '') return false
  const relative = normalize(path).replaceAll('\\', '/')
  if (relative.split('/').some(isTemporaryName)) return false
  return watchedFiles.has(relative)
    || watchedDirectories.some(directory => relative === directory || relative.startsWith(`${directory}/`))
}

function snapshot(root, directories = watchedDirectories, inputs = watchedFiles) {
  const files = new Map()
  const record = relative => {
    let content = readFileSync(join(root, relative))
    if (relative === 'package.json') {
      const manifest = JSON.parse(content.toString('utf8'))
      delete manifest.buildNumber
      content = JSON.stringify(manifest)
    }
    files.set(relative, createHash('sha256').update(content).digest('hex'))
  }
  const visit = relative => {
    let entries
    try {
      entries = readdirSync(join(root, relative), { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      if (isTemporaryName(entry.name)) continue
      const child = `${relative}/${entry.name}`
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) record(child)
    }
  }
  for (const directory of directories) visit(directory)
  for (const relative of inputs) {
    try {
      record(relative)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return files
}

// Directory events can represent atomic saves. Rescan inputs instead of dropping
// those events, while ignoring metadata-only changes and identical rewrites.
export function createDevelopmentChangeDetector(root, { directories = watchedDirectories, files = watchedFiles } = {}) {
  let previous = snapshot(root, directories, files)
  return () => {
    // An incomplete read must not replace the last valid snapshot.
    const current = snapshot(root, directories, files)
    const changed = [...new Set([...previous.keys(), ...current.keys()])]
      .filter(path => previous.get(path) !== current.get(path)).sort()
    previous = current
    return changed
  }
}
