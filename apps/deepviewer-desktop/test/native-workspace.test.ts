import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, readFile, symlink, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readEditor, saveEditor, workspaceOperation } from '../../deepviewer-adapter/workflows/workspace.ts'
import { acknowledgeSave } from '../../deepviewer-adapter/client/editor-save.ts'
const fixtures: string[] = []
afterEach(async () => { for (const path of fixtures.splice(0)) await rm(path, { recursive: true, force: true }) })
async function fixture() { const path = await mkdtemp(join(tmpdir(), 'deepviewer-edit-')); fixtures.push(path); const workspace = join(path, 'workspace'); await mkdir(workspace); return { path, workspace } }
describe('native sidebar workspace operations', () => {
 it('retains text typed while a save was in flight', () => {
  const current = { path: '/file', text: 'newer draft', saved: 'original', version: 'old' }
  expect(acknowledgeSave(current, { path: '/file', text: 'submitted', version: 'new' })).toEqual({ ...current, saved: 'submitted', version: 'new' })
 })
 it('preserves external edits and rejects a second concurrent stale save', async () => {
  const { workspace } = await fixture(), path = join(workspace, 'file.txt'); await writeFile(path, 'original')
  const opened = await readEditor(workspace, path); await writeFile(path, 'external')
  await expect(saveEditor(workspace, path, 'lost update', opened.version)).rejects.toThrow('changed')
  expect(await readFile(path, 'utf8')).toBe('external')
  const current = await readEditor(workspace, path)
  const results = await Promise.allSettled([saveEditor(workspace, path, 'first', current.version), saveEditor(workspace, path, 'second', current.version)])
  expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(value => value.status === 'rejected')).toHaveLength(1)
  expect(await readFile(path,'utf8')).toBe(results[0]?.status === 'fulfilled' ? 'first' : 'second')
 })
 it('rejects escaping symlinks, binary data and oversized writes', async () => {
  const { path, workspace } = await fixture(); await writeFile(join(path,'outside'),'private'); await symlink(join(path,'outside'),join(workspace,'link'))
  await expect(readEditor(workspace,'link')).rejects.toThrow('inside')
  await writeFile(join(workspace,'binary'),Buffer.from([0,1,2])); await expect(readEditor(workspace,'binary')).rejects.toThrow('Binary')
  await writeFile(join(workspace,'file'),'hello'); const opened = await readEditor(workspace,'file'); await expect(saveEditor(workspace,'file','a'.repeat(2*1024*1024+1),opened.version)).rejects.toThrow('2 MiB')
 })
 it('stages only the selected file and rejects outside repositories and arbitrary commands', async () => {
  const { workspace, path } = await fixture(); execFileSync('git',['init','-q'],{cwd:workspace}); await writeFile(join(workspace,'chosen'),'one'); await writeFile(join(workspace,'unrelated'),'two')
  await workspaceOperation(workspace,'git.stage',{path:'chosen'})
  expect(execFileSync('git',['diff','--cached','--name-only'],{cwd:workspace,encoding:'utf8'}).trim()).toBe('chosen')
  await expect(workspaceOperation(workspace,'git.stage',{path:'../outside'})).rejects.toThrow('relative')
  await expect(workspaceOperation(workspace,'git.stage',{path:'.'})).rejects.toThrow('one changed file')
  await expect(workspaceOperation(workspace,'git.status',{repository:path})).rejects.toThrow('outside')
  await expect(workspaceOperation(workspace,'shell.exec',{command:'pwd'})).rejects.toThrow('Unsupported')
 })
 it('does not discover or mutate a parent repository outside the selected workspace', async () => {
  const { workspace, path } = await fixture(); execFileSync('git',['init','-q'],{cwd:path}); await writeFile(join(path,'outside'),'private'); await writeFile(join(workspace,'inside'),'project')
  await expect(workspaceOperation(workspace,'git.stage',{path:'outside'})).rejects.toThrow('outside this workspace')
  expect(execFileSync('git',['diff','--cached','--name-only'],{cwd:path,encoding:'utf8'})).toBe('')
 })
})
