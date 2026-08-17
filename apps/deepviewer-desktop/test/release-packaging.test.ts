import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// @ts-expect-error The checked JavaScript release helper has no separate declaration file.
const { normalizeCopiedRuntimeSymlinks } = await import('../scripts/release-audit.mjs')

const scriptsRoot = resolve(import.meta.dirname, '../scripts')
const packageScript = readFileSync(resolve(scriptsRoot, 'package.mjs'), 'utf8')
const runtimeScript = readFileSync(resolve(scriptsRoot, 'build-runtime.mjs'), 'utf8')
const auditScript = readFileSync(resolve(scriptsRoot, 'release-audit.mjs'), 'utf8')

describe('public release privacy gate (DV-0003 AC-011)', () => {
  it('packages only a newly created allowlist staging directory', () => {
    expect(packageScript).toContain("const releaseStagingRoot = resolve(outputRoot, '.release-staging')")
    expect(packageScript).toContain('await rm(stagingAppRoot, { recursive: true, force: true })')
    expect(packageScript).toContain('await rm(appOutputRoot, { recursive: true, force: true })')
    expect(packageScript).toContain('await rm(dmgPath, { force: true })')
    expect(packageScript).not.toContain("await cp(resolve(appRoot, '.desktop')")
    expect(packageScript).not.toContain("await cp(resolve(appRoot, 'assets')")
    expect(packageScript).toContain("'.desktop/build/main.js'")
    expect(packageScript).toContain("'.desktop/build/preload.cjs'")
    expect(packageScript).toContain("'.desktop/renderer/index.html'")
    expect(packageScript).toContain("'assets/DeepViewer.icns'")
    expect(packageScript).toContain("'assets/licenses/Figtree-OFL.txt'")
    expect(packageScript).toContain('rendererAssetPattern')
    expect(packageScript).toContain("resolve(stagingAppRoot, 'package.json')")
    expect(packageScript).toContain('await writeFile(')
    expect(packageScript).toContain('dir: stagingAppRoot')
    expect(packageScript).toContain("await run('xattr', ['-cr', temporaryAppPath])")
  })

  it('removes package-manager metadata and normalizes developer paths', () => {
    expect(runtimeScript).toContain("'.pnpm-workspace-state-v1.json'")
    expect(runtimeScript).toContain("'.modules.yaml'")
    expect(runtimeScript).toContain("'/__DEEPVIEWER_SOURCE__'")
    expect(runtimeScript).toContain("'/__DEEPVIEWER_HOME__'")
  })

  it('uses the verified Koffi prebuild during cross-architecture assembly', () => {
    expect(runtimeScript).toContain("const skipKoffiInstall = arch !== process.arch")
    expect(runtimeScript).toContain("name === 'koffi' && skipKoffiInstall ? 'false' : 'true'")
    expect(runtimeScript).toContain("@koromix', `koffi-darwin-${arch}`")
    expect(runtimeScript).toContain('verifySelectedNativeBinary(path, arch)')
  })

  it('audits final application content before creating the DMG', () => {
    expect(packageScript.indexOf('await auditPackagedApp')).toBeLessThan(
      packageScript.indexOf("await run('hdiutil'"),
    )
    expect(auditScript).toContain("'.desktop/build/main.js'")
    expect(auditScript).toContain("'assets/DeepViewer.icns'")
    expect(auditScript).toContain('isAllowedAsarPath')
    expect(auditScript).toContain('SENSITIVE_ENVIRONMENT_NAME')
    expect(auditScript).toContain('contains a developer-machine path')
    expect(auditScript).toContain('absolute symbolic link target')
    expect(auditScript).not.toContain('console.log(environment.value)')
  })

  it('verifies DMG integrity before applying its final signature', () => {
    const verifyIndex = packageScript.indexOf("await run('hdiutil', ['verify', dmgPath])")
    expect(verifyIndex).toBeGreaterThan(packageScript.indexOf("'create',"))
    expect(verifyIndex).toBeLessThan(packageScript.indexOf('await signDiskImage'))
  })

  it('rewrites copied Runtime links as self-contained relative links', async () => {
    const root = await mkdtemp(join(tmpdir(), 'deepviewer-runtime-links-'))
    try {
      const sourceRoot = join(root, 'source')
      const copiedRoot = join(root, 'copied')
      const sourceTarget = join(sourceRoot, 'node_modules', 'pkg', 'cli.js')
      const copiedTarget = join(copiedRoot, 'node_modules', 'pkg', 'cli.js')
      const copiedLink = join(copiedRoot, 'node_modules', '.bin', 'pkg-cli')
      await mkdir(join(sourceRoot, 'node_modules', 'pkg'), { recursive: true })
      await mkdir(join(copiedRoot, 'node_modules', '.bin'), { recursive: true })
      await mkdir(join(copiedRoot, 'node_modules', 'pkg'), { recursive: true })
      await writeFile(sourceTarget, 'source')
      await writeFile(copiedTarget, 'copied')
      await symlink(sourceTarget, copiedLink)

      await expect(normalizeCopiedRuntimeSymlinks({ sourceRoot, copiedRoot })).resolves.toBe(1)
      await expect(readlink(copiedLink)).resolves.toBe('../pkg/cli.js')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
