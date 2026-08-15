import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, join, relative, resolve } from 'node:path'
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
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const displayPath = relative(root, path)
      if (hasSensitivePath(displayPath)) findings.push(`${displayPath}: sensitive file path`)
      if (entry.isSymbolicLink()) continue
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
  await visit(root)
}

function inspectAsar(archivePath, forbiddenRoots, environmentValues, findings) {
  const entries = listPackage(archivePath, { isPack: false })
  const allowedRoots = new Set(['.desktop', 'assets', 'package.json'])
  for (const entry of entries) {
    const path = normalizedPath(entry)
    const root = path.split('/')[0]
    if (!allowedRoots.has(root)) findings.push(`${path}: outside the application ASAR allowlist`)
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

export async function auditPackagedApp({ appPath, projectRoot }) {
  const resolvedAppPath = resolve(appPath)
  const contentsRoot = join(resolvedAppPath, 'Contents')
  const resourcesRoot = join(contentsRoot, 'Resources')
  const archivePath = join(resourcesRoot, 'app.asar')
  const runtimeRoot = join(resourcesRoot, 'harness')
  const forbiddenRoots = [...new Set([resolve(projectRoot), homedir()])]
    .sort((left, right) => right.length - left.length)
  const environmentValues = sensitiveEnvironmentValues()
  const findings = []

  if (basename(resolvedAppPath) !== 'DeepViewer.app') findings.push('unexpected application bundle name')
  const asarEntries = inspectAsar(archivePath, forbiddenRoots, environmentValues, findings)
  await inspectDirectory(runtimeRoot, forbiddenRoots, environmentValues, findings)

  if (findings.length > 0) {
    throw new Error(`release privacy audit failed:\n${findings.map(finding => `- ${finding}`).join('\n')}`)
  }
  process.stdout.write(
    `Release privacy audit passed: ${relative(projectRoot, resolvedAppPath)} (${asarEntries} ASAR entries, no personal paths or credential values)\n`,
  )
}
