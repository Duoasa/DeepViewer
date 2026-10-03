import { createHash } from 'node:crypto'
import { presentationStyles } from '../presentation/contracts.mjs'
import { execFileSync } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contracts } from '../compatibility/contracts.mjs'

export const harnessVersion = '0.2.0-rc.2'
export const harnessCommit = '639ed015397290b3745d163aafe02ffee4aa3f84'
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const upstreamRoot = resolve(projectRoot, 'upstream/deepseek-harness')

export function prepareUpstream(root = upstreamRoot) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  if (head !== harnessCommit || JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version !== harnessVersion) {
    throw new Error(`DeepViewer requires ${harnessVersion} at ${harnessCommit}; no source was replaced`)
  }
  // Validate every anchor before writing any source. Unknown edits never trigger a reset.
  const files = new Map()
  for (const contract of contracts) {
    const path = resolve(root, contract.file)
    let source = files.get(path) ?? readFileSync(path, 'utf8')
    // Retire the Build 25 mode position before applying the new presentation seam.
    if (contract.id === 'deepviewer-mode-29') source = source.replace(
      "      {renderSlot('sidebar.mode', { wide, expandSidebar: () => { if (collapsed) toggleSidebar() } })}\n      <div className={css.regionArea}>",
      '      <div className={css.regionArea}>')
    const expected = contract.count ?? 1
    if (contract.previousAfter && source.split(contract.previousAfter).length - 1 === expected) source = source.replaceAll(contract.previousAfter, contract.before)
    if (source.includes(contract.after) && !source.includes(contract.before)) { files.set(path, source); continue }
    // Some insertions contain the original anchor; their exact full replacement is the idempotent contract.
    if (source.includes(contract.after) && contract.after.includes(contract.before)) { files.set(path, source); continue }
    if (source.split(contract.before).length - 1 !== expected) throw new Error(`Upstream contract changed: ${contract.id}`)
    files.set(path, source.replaceAll(contract.before, contract.after))
  }
  for (const style of presentationStyles) {
    const path = resolve(root, style.file)
    const source = files.get(path) ?? readFileSync(path, 'utf8')
    if (source !== style.content && createHash('sha256').update(source).digest('hex') !== style.sha256) {
      throw new Error(`Upstream presentation changed: ${style.id}; review against the pinned source`)
    }
    files.set(path, style.content)
  }
  for (const [path, source] of files) writeFileSync(path, source)
  writeFileSync(resolve(root, 'packages/bundle/web-app/deepviewer.patch.yml'),
    readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8') + '\n' +
    readFileSync(new URL('../native-modules.patch.yml', import.meta.url), 'utf8'))
  writeFileSync(resolve(root, 'packages/web/web-fetch-http/src/desktop-network.ts'), readFileSync(new URL('../compatibility/files/desktop-network.ts', import.meta.url), 'utf8'))
  writeFileSync(resolve(root, 'packages/api/session-controller/src/chat-attachments.ts'), readFileSync(new URL('../compatibility/files/chat-attachments.ts', import.meta.url), 'utf8'))
  cpSync(new URL('../compatibility/tests/file-protection-tone.client.spec.tsx', import.meta.url), resolve(root, 'packages/client/ui-tool/tests/deepviewer-file-protection-tone.client.spec.tsx'))
  cpSync(new URL('../compatibility/tests/rpc-owner.host.spec.ts', import.meta.url), resolve(root, 'packages/client/connection/tests/deepviewer-rpc-owner.host.spec.ts'))
  cpSync(new URL('../compatibility/tests/client-artifact-metadata.host.spec.ts', import.meta.url), resolve(root, 'packages/client/hmr/tests/deepviewer-client-artifact-metadata.client.spec.ts'))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareUpstream()
