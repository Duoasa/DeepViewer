import { lstat, open, readdir, readFile, readlink, realpath, rm, stat, symlink } from 'node:fs/promises'
import { homedir, userInfo } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { extractFile, listPackage, statFile } from '@electron/asar'

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
    'assets/deepviewer-icon-macos26-1024.png',
    'assets/deepviewer-icon-dark-1024.png',
    'assets/licenses',
    'assets/licenses/Figtree-OFL.txt',
    'assets/licenses/ip-address-LICENSE.txt',
    'assets/licenses/ipaddr.js-LICENSE.txt',
    'assets/licenses/smart-buffer-LICENSE.txt',
    'assets/licenses/socks-LICENSE.txt',
    'package.json',
  ])
  return allowedExactPaths.has(path)
    || /^\.desktop\/renderer\/assets\/[A-Za-z0-9._-]+\.(?:css|js|ttf|png)$/u.test(path)
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

const NATIVE_ASAR_ROOTS = new Set(['lib', 'renderer', 'node_modules', 'dsh', 'package.json', 'THIRD-PARTY-SHELL.json'])
const NATIVE_TEXT_EXTENSIONS = new Set([...TEXT_EXTENSIONS,
  '.cfg', '.conf', '.csv', '.h', '.c', '.cpp', '.ini', '.jsx', '.pem', '.plist',
  '.properties', '.py', '.pyi', '.rb', '.rs', '.sql', '.strings', '.svg', '.tsx', '.zsh',
])
const PRIVATE_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.ssh', '.aws', '.codex', '.agents', 'harness-home',
  'migration-backups', 'data-migrations', 'local storage', 'session storage', 'indexeddb',
])
const PRIVATE_FILES = new Set([
  '.credentials.yaml', '.credentials.yml', '.credentials.json', '.netrc', '.pypirc',
  'cookies', 'login data', 'web data', 'singletonlock', 'singletonsocket', 'singletoncookie',
  'deepviewer.log',
])

function hasNativeSensitivePath(path) {
  if (hasSensitivePath(path)) return true
  const normalized = normalizedPath(path).toLowerCase(), parts = normalized.split('/')
  const name = parts.at(-1) ?? ''
  if (parts.some(part => PRIVATE_DIRECTORIES.has(part)) || PRIVATE_FILES.has(name)) return true
  if (/^\.deepviewer-(?:layout|profile|desktop-migration|web-state[^/]*|model[^/]*scans)\.json$/u.test(name)) return true
  if (/^(?:deepviewer-)?model(?:-capability)?-scans\.json$/u.test(name)) return true
  if (/\.(?:p12|pfx|keychain|keychain-db)$/u.test(name) || /^authkey_[^/]+\.p8$/u.test(name)) return true
  // The kernel package can contain public session/profile implementation files;
  // only actual home-shaped roots are private data directories.
  return /^(?:dsh\/)?(?:sessions|profiles|storages)(?:\/|$)/u.test(normalized)
    || /^(?:runtime\/(?:primary-runtime\/)?)?(?:sessions|profiles|storages)(?:\/|$)/u.test(normalized)
    || /^(?:dsh\/|runtime\/(?:primary-runtime\/)?)?settings\.ya?ml$/u.test(normalized)
}

function nativeSensitiveEnvironmentValues() {
  return sensitiveEnvironmentValues().filter(({ value }) => {
    const trimmed = value.trim()
    return trimmed.length >= 12
      && !/^(?:undefined|null|false|true|fixture[-_ ]only|test[-_ ](?:key|token|secret)|example|placeholder)$/iu.test(trimmed)
      && new Set(trimmed).size >= 6
  })
}

function nativeTextContent(path, buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le')
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const bytes = Buffer.from(buffer.subarray(2))
    if (bytes.length % 2 === 0) return bytes.swap16().toString('utf16le')
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192))
  const textExtension = extname(path) !== '' && NATIVE_TEXT_EXTENSIONS.has(extname(path).toLowerCase())
  if (!textExtension && sample.includes(0)) return undefined
  // Sniff extensionless LICENSE/readme files and unknown text formats, while
  // avoiding scanning native binary payloads as source text.
  if (!textExtension && sample.some(byte => byte < 0x20 && ![9, 10, 13].includes(byte))) return undefined
  return buffer.toString('utf8')
}

/** Audit the final native carrier, including its unpacked code and external runtime. */
export async function auditNativePackagedApp({ appPath, projectRoot }) {
  const resourceInput = join(resolve(appPath), 'Contents', 'Resources')
  let resources
  try {
    const metadata = await lstat(resourceInput)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error('invalid resource root')
    resources = await realpath(resourceInput)
  } catch {
    throw new Error('native release privacy audit failed:\n- Resources: invalid packaged resource root')
  }
  const archive = join(resources, 'app.asar')
  const privateRoots = [...new Set([resolve(projectRoot), homedir()])].filter(Boolean)
  const environmentValues = nativeSensitiveEnvironmentValues()
  const username = userInfo().username
  // Generic CI/account names are meaningful only as part of their home path;
  // scanning the word "root" or "runner" would reject ordinary dependency code.
  const privateUsername = /^[A-Za-z0-9_.-]{6,}$/u.test(username)
    && !['runner', 'developer', 'administrator', 'username'].includes(username.toLowerCase()) ? username : undefined
  const usernamePattern = privateUsername
    ? new RegExp(`(?<![A-Za-z0-9_.-])${privateUsername.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![A-Za-z0-9_.-])`, 'u') : undefined
  const findings = new Set()
  let resourceFiles = 0, asarEntries = 0
  const redact = value => {
    for (const token of [...privateRoots, ...(privateUsername ? [privateUsername] : []), ...environmentValues.map(item => item.value)]) {
      value = value.replaceAll(token, '[private]')
    }
    return value
  }
  const finding = (path, reason) => findings.add(`${redact(path)}: ${reason}`)
  const inspect = (path, buffer) => {
    const content = nativeTextContent(path, buffer)
    if (content === undefined) return
    if (privateRoots.some(root => content.includes(root))) finding(path, 'contains a developer-machine path')
    if (usernamePattern?.test(content)) {
      finding(path, 'contains the developer account name')
    }
    if (environmentValues.some(({ value }) => content.includes(value)
      || content.includes(JSON.stringify(value).slice(1, -1)))) finding(path, 'contains a sensitive environment value')
    // Cryptography dependencies legitimately name PEM delimiters in source;
    // require an actual multiline encoded key block rather than a label alone.
    if (/-----BEGIN ((?:[A-Z]+ )?PRIVATE KEY)-----\r?\n(?:[A-Za-z0-9+/=]{16,}\r?\n)+-----END \1-----/u.test(content)) {
      finding(path, 'contains private key material')
    }
  }
  const inspectPath = path => {
    if (hasNativeSensitivePath(path)) finding(path, 'sensitive private file or data directory')
    if (privateRoots.some(root => path.includes(root))) finding(path, 'contains a developer-machine path')
    if (usernamePattern?.test(path)) finding(path, 'contains the developer account name')
    if (environmentValues.some(({ value }) => path.includes(value))) finding(path, 'contains a sensitive environment value')
  }
  try {
    const entries = listPackage(archive, { isPack: false })
    asarEntries = entries.length
    for (const entry of entries) {
      const path = normalizedPath(entry)
      if (!NATIVE_ASAR_ROOTS.has(path.split('/')[0])) finding(`ASAR/${path}`, 'outside the native application allowlist')
      inspectPath(path)
      const metadata = statFile(archive, path, false)
      if ('files' in metadata) continue
      if ('link' in metadata) {
        const target = metadata.link
        if (isAbsolute(target)) finding(`ASAR/${path}`, 'absolute symbolic link target')
        if (!isContainedPath('/__native_archive__', resolve('/__native_archive__', target))) {
          finding(`ASAR/${path}`, 'symbolic link escapes the archive')
        } else {
          try { statFile(archive, path, true) } catch { finding(`ASAR/${path}`, 'broken or circular symbolic link') }
        }
        continue
      }
      // Unpacked payloads are scanned from disk below, rather than following
      // ASAR metadata to an unchecked filesystem path.
      if (!metadata.unpacked) inspect(`ASAR/${path}`, extractFile(archive, path, false))
    }
  } catch {
    finding('ASAR', 'cannot inspect the native application archive')
  }
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), display = relative(resources, path).split(sep).join('/')
      inspectPath(display.replace(/^app\.asar\.unpacked\//u, ''))
      if (entry.isSymbolicLink()) {
        const target = await readlink(path), resolvedTarget = resolve(dirname(path), target)
        if (isAbsolute(target)) finding(display, 'absolute symbolic link target')
        if (!isContainedPath(resources, resolvedTarget)) finding(display, 'symbolic link escapes the packaged resources')
        else {
          try {
            if (!isContainedPath(resources, await realpath(path))) finding(display, 'symbolic link resolves outside the packaged resources')
          } catch { finding(display, 'broken symbolic link') }
        }
      } else if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) {
        resourceFiles += 1
        if (display === 'app.asar') continue
        const file = await open(path, 'r')
        try {
          const sample = Buffer.alloc(8192), { bytesRead } = await file.read(sample, 0, sample.length, 0)
          if (nativeTextContent(display, sample.subarray(0, bytesRead)) !== undefined) inspect(display, await file.readFile())
        } finally { await file.close() }
      } else finding(display, 'unsupported special file')
    }
  }
  try {
    if ((await lstat(resources)).isSymbolicLink()) finding('Resources', 'symbolic link resource root')
    else await visit(resources)
  } catch {
    finding('Resources', 'cannot inspect packaged resources')
  }
  if (findings.size) throw new Error(`native release privacy audit failed:\n${[...findings].map(value => `- ${value}`).join('\n')}`)
  const result = { asarEntries, resourceFiles }
  process.stdout.write(`Native package privacy audit passed (${asarEntries} ASAR entries, ${resourceFiles} resource files)\n`)
  return result
}
