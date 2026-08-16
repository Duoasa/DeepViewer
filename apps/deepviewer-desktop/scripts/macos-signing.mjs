import { spawn } from 'node:child_process'
import { closeSync, openSync, readSync } from 'node:fs'
import { open, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsRoot = dirname(fileURLToPath(import.meta.url))
const jitEntitlements = resolve(scriptsRoot, '..', 'entitlements', 'darwin-jit.plist')
const emptyEntitlements = resolve(scriptsRoot, '..', 'entitlements', 'darwin-empty.plist')
const developerIdPrefix = 'Developer ID Application:'
const allowedJitEntitlement = 'com.apple.security.cs.allow-jit'
const forbiddenEntitlements = new Set([
  'com.apple.security.get-task-allow',
  'com.apple.security.cs.allow-unsigned-executable-memory',
  'com.apple.security.cs.disable-library-validation',
  'com.apple.security.cs.allow-dyld-environment-variables',
  'com.apple.security.cs.disable-executable-page-protection',
])
const machoMagics = new Set([
  'cafebabe', 'cafebabf', 'bebafeca', 'bfbafeca',
  'feedface', 'feedfacf', 'cefaedfe', 'cffaedfe',
])

export function runCapture(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      const detail = stderr.trim() || stdout.trim() || `signal=${String(signal)}`
      reject(new Error(`${command} failed with code=${String(code)}: ${detail}`))
    })
  })
}

export function parseDeveloperIdApplicationIdentities(output) {
  const identities = []
  const pattern = /^\s*\d+\)\s+([0-9A-F]{40})\s+"(Developer ID Application:[^"]+)"\s*$/gimu
  for (const match of output.matchAll(pattern)) {
    const hash = match[1]
    const name = match[2]
    if (hash !== undefined && name !== undefined) identities.push({ hash: hash.toUpperCase(), name })
  }
  return identities
}

export async function resolveDeveloperIdApplication({ requestedIdentity, keychain } = {}) {
  const args = ['find-identity', '-v', '-p', 'codesigning']
  if (typeof keychain === 'string' && keychain !== '') args.push(keychain)
  const { stdout } = await runCapture('security', args)
  const identities = parseDeveloperIdApplicationIdentities(stdout)
  if (identities.length === 0) {
    throw new Error('no valid Developer ID Application identity is available in the selected Keychain')
  }
  if (typeof requestedIdentity === 'string' && requestedIdentity !== '') {
    const requested = requestedIdentity.toLowerCase()
    const match = identities.find(identity => (
      identity.name.toLowerCase() === requested || identity.hash.toLowerCase() === requested
    ))
    if (match === undefined) {
      throw new Error('DEEPVIEWER_CODESIGN_IDENTITY does not exactly match an available Developer ID Application identity')
    }
    return match
  }
  if (identities.length !== 1) {
    throw new Error('multiple Developer ID Application identities are available; set DEEPVIEWER_CODESIGN_IDENTITY explicitly')
  }
  return identities[0]
}

export function needsJitEntitlement(filePath) {
  const normalized = filePath.replaceAll('\\', '/')
  return /\/Contents\/MacOS\/DeepViewer(?: Helper(?: \([^)]+\))?)?$/u.test(normalized)
    || normalized.endsWith('/DeepViewer.app')
    || /\/DeepViewer Helper(?: \([^)]+\))?\.app$/u.test(normalized)
}

export function isMacCodePath(filePath) {
  if (/\.(?:app|framework)$/u.test(filePath)) return true
  let descriptor
  try {
    descriptor = openSync(filePath, 'r')
    const header = Buffer.alloc(4)
    return readSync(descriptor, header, 0, header.length, 0) === header.length
      && machoMagics.has(header.toString('hex'))
  } catch {
    return false
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

export function createOsxSignOptions({ identity, keychain }) {
  return {
    identity: identity.hash,
    platform: 'darwin',
    ...(typeof keychain === 'string' && keychain !== '' ? { keychain } : {}),
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
    continueOnError: false,
    ignore: filePath => !isMacCodePath(filePath),
    strictVerify: true,
    optionsForFile: filePath => ({
      entitlements: needsJitEntitlement(filePath) ? jitEntitlements : emptyEntitlements,
      hardenedRuntime: true,
    }),
  }
}

export async function signDiskImage({ dmgPath, identity, arch, keychain }) {
  const args = [
    '--sign', identity.hash,
    '--force',
    '--timestamp',
    '--identifier', `com.deepviewer.desktop.dmg.${arch}`,
  ]
  if (typeof keychain === 'string' && keychain !== '') args.push('--keychain', keychain)
  args.push(dmgPath)
  await runCapture('codesign', args)
}

function detailsText(result) {
  return `${result.stdout}\n${result.stderr}`
}

function assertDeveloperIdDetails(details, displayPath, { requireRuntime = true } = {}) {
  if (!details.includes(`Authority=${developerIdPrefix}`)) {
    throw new Error(`${displayPath}: signature is not from a Developer ID Application authority`)
  }
  if (requireRuntime && !/\bflags=.*\bruntime\b/iu.test(details)) {
    throw new Error(`${displayPath}: hardened runtime flag is missing`)
  }
  if (!/^Timestamp=/mu.test(details)) {
    throw new Error(`${displayPath}: secure timestamp is missing`)
  }
  const team = details.match(/^TeamIdentifier=([^\s]+)$/mu)?.[1]
  if (team === undefined || team === 'not set') {
    throw new Error(`${displayPath}: TeamIdentifier is missing`)
  }
  return team
}

async function isMachO(filePath) {
  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(4)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return bytesRead === 4 && machoMagics.has(header.toString('hex'))
  } finally {
    await handle.close()
  }
}

export async function collectMachOFiles(root) {
  const files = []
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        await visit(path)
      } else if (entry.isFile() && await isMachO(path)) {
        files.push(path)
      }
    }
  }
  await visit(root)
  return files.sort()
}

function entitlementKeys(output) {
  return [...output.matchAll(/<key>([^<]+)<\/key>/gu)]
    .map(match => match[1])
    .filter(key => key !== undefined)
}

async function inspectSignedMachO(filePath) {
  const details = detailsText(await runCapture('codesign', ['--display', '--verbose=4', filePath]))
  const team = assertDeveloperIdDetails(details, filePath)
  const entitlementResult = await runCapture('codesign', ['--display', '--entitlements', ':-', filePath])
  const keys = entitlementKeys(detailsText(entitlementResult))
  for (const key of keys) {
    if (forbiddenEntitlements.has(key)) throw new Error(`${filePath}: forbidden entitlement ${key}`)
  }
  if (needsJitEntitlement(filePath)) {
    if (keys.length !== 1 || keys[0] !== allowedJitEntitlement) {
      throw new Error(`${filePath}: expected only ${allowedJitEntitlement}, found ${keys.join(', ') || 'none'}`)
    }
  } else if (keys.length !== 0) {
    throw new Error(`${filePath}: non-process binary has unexpected entitlements: ${keys.join(', ')}`)
  }
  return team
}

export async function verifySignedApp(appPath) {
  await runCapture('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
  const machos = await collectMachOFiles(resolve(appPath, 'Contents'))
  if (machos.length === 0) throw new Error(`${appPath}: no Mach-O code found`)
  const teams = new Set()
  for (const macho of machos) teams.add(await inspectSignedMachO(macho))
  if (teams.size !== 1) throw new Error(`${appPath}: nested code uses multiple TeamIdentifier values`)
  return { machoCount: machos.length, teamIdentifier: [...teams][0] }
}

export async function verifySignedDiskImage(dmgPath) {
  await runCapture('codesign', ['--verify', '--strict', '--verbose=2', dmgPath])
  const details = detailsText(await runCapture('codesign', ['--display', '--verbose=4', dmgPath]))
  return { teamIdentifier: assertDeveloperIdDetails(details, dmgPath, { requireRuntime: false }) }
}
