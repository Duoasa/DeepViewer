import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const manifestPath = join(appRoot, 'package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (!Number.isSafeInteger(manifest.buildNumber) || manifest.buildNumber < 1) {
  throw new Error(`invalid DeepViewer build number: ${String(manifest.buildNumber)}`)
}
manifest.buildNumber += 1
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
process.stdout.write(`DeepViewer build number: ${manifest.buildNumber}\n`)
