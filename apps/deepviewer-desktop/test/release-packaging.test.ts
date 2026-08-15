import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    expect(packageScript).toContain("await cp(resolve(appRoot, '.desktop')")
    expect(packageScript).toContain("await cp(resolve(appRoot, 'assets')")
    expect(packageScript).toContain("await cp(resolve(appRoot, 'package.json')")
    expect(packageScript).toContain('dir: stagingAppRoot')
  })

  it('removes package-manager metadata and normalizes developer paths', () => {
    expect(runtimeScript).toContain("'.pnpm-workspace-state-v1.json'")
    expect(runtimeScript).toContain("'.modules.yaml'")
    expect(runtimeScript).toContain("'/__DEEPVIEWER_SOURCE__'")
    expect(runtimeScript).toContain("'/__DEEPVIEWER_HOME__'")
  })

  it('audits final application content before creating the DMG', () => {
    expect(packageScript.indexOf('await auditPackagedApp')).toBeLessThan(
      packageScript.indexOf("await run('hdiutil'"),
    )
    expect(auditScript).toContain("new Set(['.desktop', 'assets', 'package.json'])")
    expect(auditScript).toContain('SENSITIVE_ENVIRONMENT_NAME')
    expect(auditScript).toContain('contains a developer-machine path')
    expect(auditScript).not.toContain('console.log(environment.value)')
  })
})
