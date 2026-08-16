import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The release helper is intentionally plain ESM so it can run before TypeScript build output exists.
// @ts-expect-error The checked JavaScript helper has no separate declaration file.
const signingModule = await import('../scripts/macos-signing.mjs')
const {
  createOsxSignOptions,
  isMacCodePath,
  needsJitEntitlement,
  parseDeveloperIdApplicationIdentities,
} = signingModule

const scriptsRoot = resolve(import.meta.dirname, '../scripts')
const appRoot = resolve(import.meta.dirname, '..')
const packageScript = readFileSync(resolve(scriptsRoot, 'package.mjs'), 'utf8')
const notarizeScript = readFileSync(resolve(scriptsRoot, 'notarize.mjs'), 'utf8')
const jitEntitlements = readFileSync(resolve(appRoot, 'entitlements/darwin-jit.plist'), 'utf8')
const emptyEntitlements = readFileSync(resolve(appRoot, 'entitlements/darwin-empty.plist'), 'utf8')

describe('macOS Developer ID release gate (DV-0007)', () => {
  it('accepts only Developer ID Application identities from security output', () => {
    const output = [
      '  1) AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA "Apple Development: Example (TEAM123456)"',
      '  2) BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB "Developer ID Application: Example (TEAM123456)"',
      '     2 valid identities found',
    ].join('\n')
    expect(parseDeveloperIdApplicationIdentities(output)).toEqual([
      {
        hash: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        name: 'Developer ID Application: Example (TEAM123456)',
      },
    ])
  })

  it('grants JIT only to DeepViewer process executables and app bundles', () => {
    expect(needsJitEntitlement('/tmp/DeepViewer.app')).toBe(true)
    expect(needsJitEntitlement('/tmp/DeepViewer.app/Contents/MacOS/DeepViewer')).toBe(true)
    expect(needsJitEntitlement('/tmp/DeepViewer Helper (Renderer).app/Contents/MacOS/DeepViewer Helper (Renderer)')).toBe(true)
    expect(needsJitEntitlement('/tmp/DeepViewer.app/Contents/Resources/harness/native.node')).toBe(false)
    const options = createOsxSignOptions({
      identity: { hash: 'B'.repeat(40), name: 'Developer ID Application: Example (TEAM123456)' },
    })
    expect(options.identity).toBe('B'.repeat(40))
    expect(options.preAutoEntitlements).toBe(false)
    expect(options.preEmbedProvisioningProfile).toBe(false)
    expect(options.continueOnError).toBe(false)
    expect(options.ignore('/tmp/font.woff2')).toBe(true)
    expect(options.ignore('/tmp/DeepViewer.app')).toBe(false)
    expect(isMacCodePath('/tmp/not-present.bin')).toBe(false)
    expect(options.optionsForFile('/tmp/DeepViewer.app/Contents/MacOS/DeepViewer').entitlements).toContain('darwin-jit.plist')
    expect(options.optionsForFile('/tmp/DeepViewer.app/Contents/Resources/harness/native.node').entitlements).toContain('darwin-empty.plist')
  })

  it('keeps the entitlement files minimal', () => {
    expect(jitEntitlements.match(/<key>/gu)).toHaveLength(1)
    expect(jitEntitlements).toContain('com.apple.security.cs.allow-jit')
    expect(jitEntitlements).not.toContain('get-task-allow')
    expect(jitEntitlements).not.toContain('allow-unsigned-executable-memory')
    expect(jitEntitlements).not.toContain('disable-library-validation')
    expect(emptyEntitlements.match(/<key>/gu)).toBeNull()
  })

  it('requires explicit signing and uses only a notarytool Keychain profile', () => {
    expect(packageScript).toContain("process.argv.includes('--sign')")
    expect(packageScript).toContain('resolveDeveloperIdApplication')
    expect(packageScript).toContain('signDiskImage')
    expect(notarizeScript).toContain("'--keychain-profile', keychainProfile")
    expect(notarizeScript).toContain("'notarytool', 'submit'")
    expect(notarizeScript).toContain("'notarytool', 'wait', submitted.id")
    expect(notarizeScript).toContain("'--timeout', '2h'")
    expect(notarizeScript).toContain("'stapler', 'staple'")
    expect(notarizeScript).toContain("'spctl'")
    expect(notarizeScript).not.toContain("'--apple-id',")
    expect(notarizeScript).not.toContain("'--password',")
  })
})
