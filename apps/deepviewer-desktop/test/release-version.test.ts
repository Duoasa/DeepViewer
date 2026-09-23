import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Plain ESM release helper.
import { verifyRuntimeVersion } from '../scripts/release-version.mjs'
const roots: string[] = []
const expected = { version: '0.3.0', buildNumber: 54 }
async function fixture(runtime = expected, about = expected) {
  const root = await mkdtemp(join(tmpdir(), 'dv-version-'))
  roots.push(root)
  const dir = join(root, 'node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib')
  await mkdir(dir, { recursive: true })
  await writeFile(join(root, 'deepviewer-runtime.json'), JSON.stringify({ deepviewerVersion: runtime.version, deepviewerBuildNumber: runtime.buildNumber }))
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: expected.version }))
  await writeFile(join(dir, 'client.js'), `const DEEPVIEWER_VERSION = "${about.version}"; const DEEPVIEWER_BUILD_NUMBER = '${about.buildNumber}';`)
  return root
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
describe('release version gate', () => {
  it('accepts matching Runtime and compiled About metadata', async () => {
    await expect(verifyRuntimeVersion(await fixture(), expected)).resolves.toBeUndefined()
  })
  it('rejects a stale About page even when Runtime is current', async () => {
    await expect(verifyRuntimeVersion(await fixture(expected, { version: '0.2.9', buildNumber: 53 }), expected)).rejects.toThrow('Release version mismatch')
  })
  it('rejects a mismatched Runtime build', async () => {
    await expect(verifyRuntimeVersion(await fixture({ ...expected, buildNumber: 53 }), expected)).rejects.toThrow('Release version mismatch')
  })
})
