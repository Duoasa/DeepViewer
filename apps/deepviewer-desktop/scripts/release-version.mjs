import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function verifyRuntimeVersion(runtimeRoot, expected) {
  const runtime = JSON.parse(await readFile(join(runtimeRoot, 'deepviewer-runtime.json'), 'utf8'))
  const pkg = JSON.parse(await readFile(join(runtimeRoot, 'package.json'), 'utf8'))
  const about = await readFile(join(runtimeRoot, 'node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js'), 'utf8')
  const version = about.match(/\bDEEPVIEWER_VERSION\s*=\s*["']([^"']+)["']/u)?.[1]
  const build = about.match(/\bDEEPVIEWER_BUILD_NUMBER\s*=\s*["']([^"']+)["']/u)?.[1]
  if (runtime.deepviewerVersion !== expected.version
    || runtime.deepviewerBuildNumber !== expected.buildNumber
    || pkg.version !== expected.version
    || version !== expected.version || build !== String(expected.buildNumber)) {
    throw new Error(`Release version mismatch: expected ${expected.version} (${expected.buildNumber}), Runtime ${runtime.deepviewerVersion} (${runtime.deepviewerBuildNumber}), package ${pkg.version}, About ${version} (${build})`)
  }
  process.stdout.write(`Runtime and About verified: ${version} (${build})\n`)
}
