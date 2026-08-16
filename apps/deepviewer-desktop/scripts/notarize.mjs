import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { runCapture, verifySignedDiskImage } from './macos-signing.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = resolve(appRoot, '..', '..', 'out')
const manifest = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8'))
const appVersion = manifest.version
const architectureOption = process.argv.find(argument => argument.startsWith('--arch='))?.slice('--arch='.length)
if (architectureOption !== undefined && architectureOption !== 'arm64' && architectureOption !== 'x64') {
  throw new Error(`unsupported macOS architecture: ${architectureOption}`)
}
const profileOption = process.argv.find(argument => argument.startsWith('--keychain-profile='))
  ?.slice('--keychain-profile='.length)
const keychainProfile = profileOption ?? process.env.DEEPVIEWER_NOTARY_PROFILE
if (typeof keychainProfile !== 'string' || keychainProfile.trim() === '') {
  throw new Error('set DEEPVIEWER_NOTARY_PROFILE or --keychain-profile to a notarytool Keychain profile name')
}
if (process.argv.some(argument => argument.startsWith('--apple-id') || argument.startsWith('--password'))) {
  throw new Error('plaintext Apple ID and password arguments are not supported; use a notarytool Keychain profile')
}
const architectures = architectureOption === undefined ? ['arm64', 'x64'] : [architectureOption]
const evidenceRoot = resolve(outputRoot, 'notarization', `v${appVersion}`)
await mkdir(evidenceRoot, { recursive: true })

async function assessMountedApplication(dmgPath, arch) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), `deepviewer-${arch}-notary-`))
  const mountPoint = join(temporaryRoot, 'mounted')
  await mkdir(mountPoint)
  let attached = false
  try {
    await runCapture('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath])
    attached = true
    await runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=4', join(mountPoint, 'DeepViewer.app')])
  } finally {
    if (attached) await runCapture('hdiutil', ['detach', mountPoint])
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

for (const arch of architectures) {
  const dmgPath = resolve(outputRoot, `DeepViewer-${appVersion}-macos-${arch}.dmg`)
  await verifySignedDiskImage(dmgPath)
  const submission = await runCapture('xcrun', [
    'notarytool', 'submit', dmgPath,
    '--keychain-profile', keychainProfile,
    '--output-format', 'json',
  ])
  const submissionPath = resolve(evidenceRoot, `${arch}-submission.json`)
  await writeFile(submissionPath, submission.stdout, { encoding: 'utf8', mode: 0o600 })
  const submitted = JSON.parse(submission.stdout)
  if (typeof submitted.id !== 'string' || submitted.id === '') throw new Error(`${arch}: notarytool returned no submission id`)
  const waited = await runCapture('xcrun', [
    'notarytool', 'wait', submitted.id,
    '--keychain-profile', keychainProfile,
    '--timeout', '2h',
    '--output-format', 'json',
  ])
  const waitPath = resolve(evidenceRoot, `${arch}-wait.json`)
  await writeFile(waitPath, waited.stdout, { encoding: 'utf8', mode: 0o600 })
  const result = JSON.parse(waited.stdout)
  const logPath = resolve(evidenceRoot, `${arch}-notary-log.json`)
  await runCapture('xcrun', [
    'notarytool', 'log', submitted.id,
    '--keychain-profile', keychainProfile,
    logPath,
  ])
  const log = JSON.parse(await readFile(logPath, 'utf8'))
  const blockingIssues = Array.isArray(log.issues)
    ? log.issues.filter(issue => issue?.severity === 'error')
    : []
  if (result.status !== 'Accepted' || blockingIssues.length > 0) {
    throw new Error(`${arch}: notarization ${submitted.id} was ${String(result.status)} with ${blockingIssues.length} blocking issue(s)`)
  }
  await runCapture('xcrun', ['stapler', 'staple', dmgPath])
  await runCapture('xcrun', ['stapler', 'validate', dmgPath])
  await runCapture('hdiutil', ['verify', dmgPath])
  await verifySignedDiskImage(dmgPath)
  await runCapture('spctl', [
    '--assess', '--type', 'open',
    '--context', 'context:primary-signature',
    '--verbose=4', dmgPath,
  ])
  await assessMountedApplication(dmgPath, arch)
  process.stdout.write(`${arch}: notarization Accepted (${submitted.id}); ticket stapled and Gatekeeper assessment passed\n`)
}
