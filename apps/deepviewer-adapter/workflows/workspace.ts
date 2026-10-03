import { constants } from 'node:fs'
import { open, realpath, stat, rename, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import * as git from './vendor/git.ts'
const MAX_TEXT_BYTES = 2 * 1024 * 1024
const locks = new Map<string, Promise<unknown>>()
export async function workspacePath(cwd: string, input: string): Promise<string> {
  const root = await realpath(cwd), target = await realpath(resolve(root, input)), child = relative(root, target)
  if (child === '' || child === '..' || child.startsWith('../') || isAbsolute(child)) throw new Error('File must be inside this workspace')
  return target
}
const versionOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
export async function readEditor(cwd: string, input: string) {
  const path = await workspacePath(cwd, input), handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > MAX_TEXT_BYTES) throw new Error('Editor supports text files up to 2 MiB')
    const bytes = await handle.readFile()
    if (bytes.length > MAX_TEXT_BYTES || bytes.includes(0)) throw new Error('Binary or oversized file cannot be edited')
    return { path, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), version: versionOf(bytes) }
  } finally { await handle.close() }
}
export async function saveEditor(cwd: string, input: string, text: string, expected: string) {
  const path = await workspacePath(cwd, input), previous = locks.get(path) ?? Promise.resolve()
  const operation = previous.catch(() => undefined).then(async () => {
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) throw new Error('Editor supports text files up to 2 MiB')
    const current = await readEditor(cwd, path)
    if (current.version !== expected) throw new Error('File changed since it was opened. Reload before saving.')
    const info = await stat(path), temporary = join(dirname(path), `.deepviewer-edit-${randomUUID()}.tmp`)
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, info.mode & 0o777)
    try {
      await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close()
      const verified = await readEditor(cwd, path)
      if (verified.version !== expected || await workspacePath(cwd, input) !== path) throw new Error('File changed during save. Reload before saving.')
      await rename(temporary, path)
      return { path, text, version: versionOf(Buffer.from(text)) }
    } finally { await handle.close().catch(() => undefined); await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error }) }
  })
  locks.set(path, operation)
  try { return await operation } finally { if (locks.get(path) === operation) locks.delete(path) }
}
function pathArgument(input: unknown): string {
  if (typeof input !== 'string' || input === '' || isAbsolute(input) || input.split(/[\\/]/).includes('..') || input.includes('\0')) throw new Error('Select one workspace-relative path')
  return input
}
/** Fixed operations and argument vectors; no arbitrary shell or implicit broad staging. */
export async function workspaceOperation(cwd: string, method: string, payload: Record<string, unknown>): Promise<unknown> {
  if (method === 'editor.read') return readEditor(cwd, String(payload.path ?? ''))
  if (method === 'editor.save') {
    if (typeof payload.text !== 'string' || typeof payload.version !== 'string') throw new Error('Invalid save request')
    return saveEditor(cwd, String(payload.path ?? ''), payload.text, payload.version)
  }
  if (!['git.status', 'git.branches', 'git.log', 'git.diff', 'git.stage', 'git.unstage', 'git.commit', 'git.checkout'].includes(method)) throw new Error('Unsupported workspace operation')
  // Repository discovery may only select a descendant of the Session's actual workspace.
  const selected = typeof payload.repository === 'string' ? await realpath(payload.repository) : undefined
  if (selected) { const child = relative(await realpath(cwd), selected); if (child === '..' || child.startsWith('../') || isAbsolute(child)) throw new Error('Repository is outside this workspace') }
  const roots = await git.repoRoots(cwd), root = await realpath(cwd)
  for (const repository of roots) { const child = relative(root, await realpath(repository)); if (child === '..' || child.startsWith('../') || isAbsolute(child)) throw new Error('Repository is outside this workspace') }
  if (selected && !roots.includes(selected)) throw new Error('Select a discovered workspace repository')
  if (method === 'git.stage' || method === 'git.unstage') {
    const path = pathArgument(payload.path), status = await git.status(cwd, selected)
    if (!status.entries.some(entry => entry.path === path)) throw new Error('Select one changed file, not a directory')
  }
  if (method === 'git.status') return git.status(cwd, selected)
  if (method === 'git.branches') return git.branches(cwd, selected)
  if (method === 'git.log') return git.log(cwd, 30, 0, selected)
  if (method === 'git.diff') return git.diff(cwd, payload.path === undefined ? undefined : pathArgument(payload.path), payload.staged === true, selected)
  if (method === 'git.stage') return git.stage(cwd, pathArgument(payload.path), selected)
  if (method === 'git.unstage') return git.unstage(cwd, pathArgument(payload.path), selected)
  if (method === 'git.commit') {
    if (typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 8192) throw new Error('Enter a commit message')
    return git.commit(cwd, payload.message.trim(), selected)
  }
  if (method === 'git.checkout') {
    if (typeof payload.branch !== 'string') throw new Error('Select a branch')
    const branches = await git.branches(cwd, selected)
    if (!branches.names.includes(payload.branch)) throw new Error('Unknown existing branch')
    return git.checkout(cwd, payload.branch, selected)
  }
  throw new Error('Unsupported workspace operation')
}
