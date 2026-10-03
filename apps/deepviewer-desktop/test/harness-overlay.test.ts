import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Shared JavaScript build entrypoint.
import { ensureHarnessSource } from '../scripts/sync-upstream-overrides.mjs'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'deepviewer-overlay-test-')); roots.push(root)
  const core = join(root, 'core'), snapshot = join(root, 'snapshot')
  mkdirSync(core); mkdirSync(snapshot)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: core, encoding: 'utf8' }).trim()
  git('init', '-q')
  writeFileSync(join(core, 'package.json'), '{"version":"0.1.7-rc.2"}\n')
  writeFileSync(join(core, 'source.txt'), 'official RC2\n')
  git('add', '--', 'package.json', 'source.txt')
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  writeFileSync(join(core, 'source.txt'), 'DeepViewer RC2 adaptation\n')
  const patch = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: core })
  writeFileSync(join(snapshot, 'harness.patch'), patch)
  writeFileSync(join(snapshot, 'manifest.json'), JSON.stringify({
    baseCommit: git('rev-parse', 'HEAD'), harnessVersion: '0.1.7-rc.2',
    patchSha256: createHash('sha256').update(patch).digest('hex'),
  }))
  writeFileSync(join(core, 'source.txt'), 'official RC2\n')
  return { core, snapshot, source: join(core, 'source.txt') }
}

describe('reviewed RC2 source overlay', () => {
  it('restores once, then preserves subsequent developer edits', () => {
    const { core, snapshot, source } = fixture()
    expect(ensureHarnessSource(core, snapshot)).toBe(true)
    expect(readFileSync(source, 'utf8')).toBe('DeepViewer RC2 adaptation\n')
    expect(ensureHarnessSource(core, snapshot)).toBe(false)
    writeFileSync(source, 'unfinished developer work\n')
    expect(ensureHarnessSource(core, snapshot)).toBe(false)
    expect(readFileSync(source, 'utf8')).toBe('unfinished developer work\n')
  })
  it('rejects overlapping edits and corrupted patches without replacing source', () => {
    const { core, snapshot, source } = fixture()
    writeFileSync(source, 'unfinished developer work\n')
    expect(() => ensureHarnessSource(core, snapshot)).toThrow(/overlapping/)
    expect(readFileSync(source, 'utf8')).toBe('unfinished developer work\n')
    writeFileSync(join(snapshot, 'harness.patch'), 'corrupt')
    expect(() => ensureHarnessSource(core, snapshot)).toThrow(/checksum/)
  })
})
