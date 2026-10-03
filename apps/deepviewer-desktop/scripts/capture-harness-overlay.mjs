/** Capture reviewed source only; never stage the developer's working index. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const core = resolve(root, 'upstream/deepseek-harness')
const output = resolve(root, 'upstream/snapshots/deepviewer-dsh-017rc2')
const baseCommit = '477b4f420553e8a52c2fbccc464d7561b239c443'
const hash = data => createHash('sha256').update(data).digest('hex')
const scratch = mkdtempSync(resolve(tmpdir(), 'deepviewer-source-index-'))
const git = (args, env = {}) => execFileSync('git', args, { cwd: core, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
try {
  if (git(['rev-parse', 'HEAD']).trim() !== baseCommit) throw new Error('Capture requires the pinned RC2 base')
  const paths = [...new Set([
    ...git(['diff', '--name-only', 'HEAD', '-z']).split('\0'),
    ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
  ])].filter(path => /^(packages\/|apps\/|scripts\/|docs\/|tsconfig[^/]*\.json$|pnpm-lock\.yaml$)/u.test(path)
    && !/\/(lib|dist|node_modules|\.dsh-build)\//u.test(path)).sort()
  const env = { GIT_INDEX_FILE: resolve(scratch, 'index') }
  git(['read-tree', baseCommit], env)
  for (let start = 0; start < paths.length; start += 100) git(['add', '-A', '--', ...paths.slice(start, start + 100)], env)
  const sourceTree = git(['write-tree'], env).trim()
  const patch = git(['diff', '--cached', '--binary', '--full-index', baseCommit], env)
  // Independently replay on a clean base index, including binary assets.
  mkdirSync(output, { recursive: true })
  const patchPath = resolve(output, 'harness.patch')
  writeFileSync(patchPath, patch)
  git(['read-tree', baseCommit], env)
  git(['apply', '--cached', '--whitespace=nowarn', patchPath], env)
  if (git(['write-tree'], env).trim() !== sourceTree) throw new Error('Patch replay changed the captured source tree')
  const manifest = {
    schemaVersion: 1, product: 'DeepViewer', harnessVersion: '0.1.7-rc.2', baseCommit, sourceTree,
    patchSha256: hash(patch), source: 'https://github.com/deepseek-ai/deepseek-harness',
    files: paths.map(path => ({ path, sha256: existsSync(resolve(core, path)) ? hash(readFileSync(resolve(core, path))) : null })),
  }
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Captured and replay-verified ${paths.length} source files (${Buffer.byteLength(patch)} patch bytes).`)
} finally { rmSync(scratch, { recursive: true, force: true }) }
