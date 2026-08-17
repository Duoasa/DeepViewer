import { readdir, readFile, readlink, realpath, rm, stat, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'

const MAX_TEXT_BYTES = 8 * 1024 * 1024
const TEXT_EXTENSIONS = new Set([
  '', '.cjs', '.css', '.html', '.js', '.json', '.map', '.md', '.mjs',
  '.sh', '.toml', '.ts', '.txt', '.xml', '.yaml', '.yml',
])
const SENSITIVE_ENVIRONMENT_NAME = /(?:API_?KEY|AUTHORIZATION|CREDENTIAL|PASSWORD|PRIVATE_?KEY|SECRET|TOKEN)/iu

function normalizedPath(path) {
  return path.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '')
}

function isContainedPath(root, candidate) {
  const path = relative(root, candidate)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

export async function normalizeCopiedRuntimeSymlinks({ sourceRoot, copiedRoot }) {
  const resolvedSourceRoot = await realpath(resolve(sourceRoot))
  const resolvedCopiedRoot = await realpath(resolve(copiedRoot))
  let normalizedCount = 0

  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        const originalTarget = await readlink(path)
        let copiedTarget = resolve(dirname(path), originalTarget)
        if (isAbsolute(originalTarget)) {
          const resolvedOriginalTarget = await realpath(originalTarget)
          if (!isContainedPath(resolvedSourceRoot, resolvedOriginalTarget)) {
            throw new Error(`${path}: copied symbolic link points outside its source Runtime`)
          }
          copiedTarget = resolve(resolvedCopiedRoot, relative(resolvedSourceRoot, resolvedOriginalTarget))
          const relativeTarget = relative(dirname(path), copiedTarget)
          await rm(path)
          await symlink(relativeTarget, path)
          normalizedCount += 1
        }
        if (!isContainedPath(resolvedCopiedRoot, copiedTarget)) {
          throw new Error(`${path}: symbolic link escapes the copied Runtime`)
        }
        const realTarget = await realpath(path)
        if (!isContainedPath(resolvedCopiedRoot, realTarget)) {
          throw new Error(`${path}: symbolic link resolves outside the copied Runtime`)
        }
        continue
      }
      if (entry.isDirectory()) await visit(path)
    }
  }

  await visit(resolvedCopiedRoot)
  return normalizedCount
}

function hasSensitivePath(path) {
  const normalized = normalizedPath(path).toLowerCase()
  const parts = normalized.split('/')
  const name = parts.at(-1) ?? ''
  if (name === '.env' || name.startsWith('.env.')) return true
  if (['.npmrc', '.pnpmrc', '.yarnrc', '.ds_store', 'id_rsa', 'id_ed25519'].includes(name)) return true
  return parts.includes('.ssh')
    || (parts.includes('.aws') && name === 'credentials')
    || (parts.includes('.config') && parts.includes('gcloud'))
}

function isTextCandidate(path, buffer) {
  return buffer.length <= MAX_TEXT_BYTES
    && TEXT_EXTENSIONS.has(extname(path).toLowerCase())
    && !buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0)
}

function sensitiveEnvironmentValues() {
  return Object.entries(process.env)
    .filter(([name, value]) => SENSITIVE_ENVIRONMENT_NAME.test(name) && typeof value === 'string' && value.length >= 8)
    .map(([name, value]) => ({ name, value }))
}

function inspectText(path, buffer, forbiddenRoots, environmentValues, findings) {
  if (!isTextCandidate(path, buffer)) return
  const content = buffer.toString('utf8')
  for (const root of forbiddenRoots) {
    if (root !== '' && content.includes(root)) findings.push(`${path}: contains a developer-machine path`)
  }
  for (const environment of environmentValues) {
    if (content.includes(environment.value)) {
      findings.push(`${path}: contains the value of sensitive environment variable ${environment.name}`)
    }
  }
}

async function inspectDirectory(root, forbiddenRoots, environmentValues, findings) {
  const resolvedRoot = await realpath(root)
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const displayPath = relative(resolvedRoot, path)
      if (hasSensitivePath(displayPath)) findings.push(`${displayPath}: sensitive file path`)
      if (entry.isSymbolicLink()) {
        const target = await readlink(path)
        const resolvedTarget = resolve(dirname(path), target)
        if (isAbsolute(target)) findings.push(`${displayPath}: absolute symbolic link target`)
        if (!isContainedPath(resolvedRoot, resolvedTarget)) {
          findings.push(`${displayPath}: symbolic link escapes the packaged Runtime`)
        } else {
          try {
            const realTarget = await realpath(path)
            if (!isContainedPath(resolvedRoot, realTarget)) {
              findings.push(`${displayPath}: symbolic link resolves outside the packaged Runtime`)
            }
          } catch {
            findings.push(`${displayPath}: broken symbolic link`)
          }
        }
        continue
      }
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile()) continue
      const metadata = await stat(path)
      if (metadata.size > MAX_TEXT_BYTES || !TEXT_EXTENSIONS.has(extname(path).toLowerCase())) continue
      inspectText(displayPath, await readFile(path), forbiddenRoots, environmentValues, findings)
    }
  }
  await visit(resolvedRoot)
}

function isAllowedAsarPath(path) {
  const allowedExactPaths = new Set([
    '.desktop',
    '.desktop/build',
    '.desktop/build/main.js',
    '.desktop/build/preload.cjs',
    '.desktop/renderer',
    '.desktop/renderer/assets',
    '.desktop/renderer/index.html',
    'assets',
    'assets/DeepViewer.icns',
    'assets/deepviewer-icon-macos26-1024.png',
    'assets/licenses',
    'assets/licenses/Figtree-OFL.txt',
    'package.json',
  ])
  return allowedExactPaths.has(path)
    || /^\.desktop\/renderer\/assets\/[A-Za-z0-9._-]+\.(?:css|js|ttf)$/u.test(path)
}

function inspectAsar(archivePath, forbiddenRoots, environmentValues, findings) {
  const entries = listPackage(archivePath, { isPack: false })
  for (const entry of entries) {
    const path = normalizedPath(entry)
    if (!isAllowedAsarPath(path)) findings.push(`${path}: outside the application ASAR allowlist`)
    if (hasSensitivePath(path)) findings.push(`${path}: sensitive file path`)
    try {
      const buffer = extractFile(archivePath, path)
      inspectText(path, buffer, forbiddenRoots, environmentValues, findings)
    } catch {
      // ASAR directories and links do not contain text payloads.
    }
  }
  return entries.length
}

export async function auditPackagedApp({ appPath, projectRoot, expectedAppName = 'DeepViewer.app' }) {
  const resolvedAppPath = resolve(appPath)
  const contentsRoot = join(resolvedAppPath, 'Contents')
  const resourcesRoot = join(contentsRoot, 'Resources')
  const archivePath = join(resourcesRoot, 'app.asar')
  const runtimeRoot = join(resourcesRoot, 'harness')
  const forbiddenRoots = [...new Set([resolve(projectRoot), homedir()])]
    .sort((left, right) => right.length - left.length)
  const environmentValues = sensitiveEnvironmentValues()
  const findings = []

  if (basename(resolvedAppPath) !== expectedAppName) findings.push('unexpected application bundle name')
  const asarEntries = inspectAsar(archivePath, forbiddenRoots, environmentValues, findings)
  await inspectDirectory(runtimeRoot, forbiddenRoots, environmentValues, findings)

  if (findings.length > 0) {
    throw new Error(`release privacy audit failed:\n${findings.map(finding => `- ${finding}`).join('\n')}`)
  }
  process.stdout.write(
    `Package privacy audit passed: ${relative(projectRoot, resolvedAppPath)} (${asarEntries} allowlisted ASAR entries, no personal paths or credential values)\n`,
  )
}
