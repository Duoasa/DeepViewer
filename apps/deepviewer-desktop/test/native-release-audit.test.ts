import { createPackageWithOptions } from '@electron/asar'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// @ts-expect-error The release audit is a directly executable JavaScript helper.
const { auditNativePackagedApp } = await import('../scripts/release-audit.mjs')

const fixtures: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  for (const path of fixtures.splice(0)) await rm(path, { recursive: true, force: true })
})

async function put(root: string, path: string, content: string | Buffer) {
  const target = join(root, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

async function fixture(entries: Record<string, string | Buffer> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'deepviewer-native-audit-'))
  fixtures.push(root)
  const appPath = join(root, 'DeepViewer.app'), source = join(root, 'archive-source')
  const projectRoot = join(root, 'private-project'), resources = join(appPath, 'Contents/Resources')
  const archive = join(resources, 'app.asar')
  await mkdir(resources, { recursive: true })
  for (const [path, content] of Object.entries({
    'lib/main.js': 'export const names = ["API_KEY", "PASSWORD", "TOKEN", "SECRET", "-----BEGIN PRIVATE KEY-----"];\n',
    'renderer/index.html': '<!doctype html><title>DeepViewer</title>',
    'package.json': JSON.stringify({ name: '@deepviewer/desktop', version: '0.5.0' }),
    'THIRD-PARTY-SHELL.json': JSON.stringify([{ name: 'public-dependency', license: 'MIT' }]),
    'node_modules/public-dependency/LICENSE': 'MIT License\nCopyright Public Authors\n',
    'node_modules/public-dependency/docs/authentication.md': 'Configure API_KEY and PASSWORD names. No credentials are included.',
    'dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.2.0-rc.2' }),
    'dsh/node_modules/public-package/profiles/README.md': 'Public profile implementation documentation.',
    'dsh/node_modules/public-package/native.node': Buffer.from([0, 1, 2, 3]),
    ...entries,
  })) await put(source, path, content)
  await createPackageWithOptions(source, archive, { dot: true, unpack: '**/*.node' })
  await put(resources, 'runtime/license/LICENSE', 'Public runtime license\n')
  await put(resources, 'runtime/primary-runtime/runtime.json', JSON.stringify({ platform: 'darwin', arch: 'arm64' }))
  await put(resources, 'icon.png', Buffer.from([0, 1, 2, 3]))
  return { root, source, appPath, projectRoot, resources, archive }
}

describe('native final-package privacy audit', () => {
  it('accepts public dependencies, documentation, licenses, key names and unpacked native payloads', async () => {
    const f = await fixture()
    const result = await auditNativePackagedApp(f)
    expect(result.asarEntries).toBeGreaterThan(8)
    expect(result.resourceFiles).toBeGreaterThan(3)
  })

  it('accepts only installed Undici cookie source directories in ASAR, unpacked code and runtime', async () => {
    const f = await fixture({ 'dsh/node_modules/undici/lib/web/cookies/index.js': 'exports.getCookies = () => [];\n' })
    await put(f.resources, 'app.asar.unpacked/dsh/node_modules/undici/lib/web/cookies/util.js', 'exports.parseCookie = () => ({});\n')
    await put(f.resources, 'runtime/primary-runtime/node_modules/undici/lib/web/cookies/index.js', 'exports.getCookies = () => [];\n')
    await expect(auditNativePackagedApp(f)).resolves.toHaveProperty('asarEntries')
  })

  it.each([
    'dsh/node_modules/undici/lib/web/Cookies',
    'dsh/node_modules/undici/lib/web/Cookies-journal',
    'dsh/node_modules/public-package/lib/web/cookies/index.js',
  ])('rejects a private cookie file or unrelated cookie directory at %s', async path => {
    const f = await fixture({ [path]: 'private cookie payload' })
    await expect(auditNativePackagedApp(f)).rejects.toThrow('sensitive private file or data directory')
  })

  it.each(['Cookies', 'Cookies-journal'])('rejects actual %s databases in resources', async name => {
    const f = await fixture()
    await put(f.resources, `runtime/primary-runtime/node_modules/undici/lib/web/${name}`, Buffer.from([0, 1, 2, 3]))
    await expect(auditNativePackagedApp(f)).rejects.toThrow('sensitive private file or data directory')
  })

  it.each(['home', 'project'])('rejects the current developer %s in packed text without exposing private values', async kind => {
    const f = await fixture()
    const value = kind === 'home' ? homedir() : f.projectRoot
    await put(f.source, 'lib/private.py', `# private build origin: ${value}\n`)
    await createPackageWithOptions(f.source, f.archive, { dot: true, unpack: '**/*.node' })
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/developer-machine path|developer account name/u)
    expect(error.message).not.toContain(value)
    expect(error.message).not.toContain(f.root)
  })

  const username = userInfo().username
  it.skipIf(!/^[A-Za-z0-9_.-]{6,}$/u.test(username) || ['runner', 'developer', 'administrator', 'username'].includes(username.toLowerCase()))('rejects a distinctive developer account name without exposing it', async () => {
    const f = await fixture({ 'lib/account.py': `# compiled by ${username}\n` })
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('developer account name')
    expect(error.message).not.toContain(username)
  })

  it('rejects packed text outside the ASAR root allowlist', async () => {
    const f = await fixture({ 'unrelated-private-copy.txt': 'Unintended build input' })
    await expect(auditNativePackagedApp(f)).rejects.toThrow('outside the native application allowlist')
  })

  it.each(['packed', 'unpacked', 'runtime'])('rejects sensitive environment values in %s text without printing them', async location => {
    const secret = 'dv-audit-fixture-9a22b8a7952d4ab890c15cf59f10dd54'
    vi.stubEnv('DEEPVIEWER_NATIVE_AUDIT_API_KEY', secret)
    const f = await fixture(location === 'packed' ? { 'lib/key.js': `export const leaked = ${JSON.stringify(secret)}` } : {})
    if (location === 'unpacked') await put(f.resources, 'app.asar.unpacked/dsh/node_modules/public-package/native.node', secret)
    if (location === 'runtime') await put(f.resources, 'runtime/primary-runtime/conf/runtime.cfg', secret)
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('sensitive environment value')
    expect(error.message).not.toContain(secret)
    expect(error.message).not.toContain(f.root)
  })

  it('does not skip text after the legacy 8 MiB limit or in an unknown extension', async () => {
    const secret = 'dv-audit-late-text-47d329924c4e4884ba5163cdc7f14a3c'
    vi.stubEnv('DEEPVIEWER_NATIVE_AUDIT_TOKEN', secret)
    const f = await fixture({ 'lib/large.js': ' '.repeat(8 * 1024 * 1024 + 1) + secret })
    await put(f.resources, 'runtime/documentation.custom-format', homedir())
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error.message).toContain('sensitive environment value')
    expect(error.message).toContain('developer-machine path')
    expect(error.message).not.toContain(secret)
  })

  it.each(['node_modules/public-dependency/.env', 'dsh/.credentials.yaml', 'dsh/sessions/private/session.json'])('rejects private ASAR data at %s', async path => {
    const f = await fixture({ [path]: '{}' })
    await expect(auditNativePackagedApp(f)).rejects.toThrow('sensitive private file or data directory')
  })

  it('rejects private resources and embedded private key material', async () => {
    const f = await fixture()
    await put(f.resources, 'runtime/harness-home/sessions/session.json', '{}')
    await put(f.resources, 'runtime/credential-material.pem', `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(96)}\n-----END PRIVATE KEY-----`)
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error.message).toContain('sensitive private file or data directory')
    expect(error.message).toContain('private key material')
  })

  it('accepts contained relative resource links, and rejects absolute or escaping links', async () => {
    const f = await fixture()
    await mkdir(join(f.resources, 'links'))
    await symlink('../runtime/license/LICENSE', join(f.resources, 'links/relative'))
    await expect(auditNativePackagedApp(f)).resolves.toHaveProperty('asarEntries')
    await symlink(join(f.resources, 'runtime/license/LICENSE'), join(f.resources, 'links/absolute'))
    await symlink('../../../../outside-file', join(f.resources, 'links/escaping'))
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error.message).toContain('absolute symbolic link target')
    expect(error.message).toContain('symbolic link escapes the packaged resources')
    expect(error.message).not.toContain(f.root)
  })

  it('inspects UTF-16 text in resources and fails closed on an unreadable archive', async () => {
    const f = await fixture()
    await put(f.resources, 'runtime/strings.strings', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(homedir(), 'utf16le')]))
    await expect(auditNativePackagedApp(f)).rejects.toThrow('developer-machine path')
    await rm(f.archive)
    const error = await auditNativePackagedApp(f).catch((failure: Error) => failure)
    expect(error.message).toContain('cannot inspect the native application archive')
    expect(error.message).not.toContain(f.root)
    expect(await readFile(join(f.resources, 'runtime/license/LICENSE'), 'utf8')).toContain('Public runtime license')
  })
})
