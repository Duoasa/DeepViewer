/** A user delivery is a workspace file, never an attachment-store object. */
import { constants } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { open, mkdir, lstat, realpath, link, unlink } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { PresentedFile } from '@deepseek-ai/dsh-tool-present/types'
import type {} from '@deepseek-ai/dsh-sandbox-policy'

function within(root: string, path: string): boolean {
  const part = relative(root, path)
  return part !== '..' && !part.startsWith('../') && !isAbsolute(part)
}

/** Detect formats from bytes, not an opaque storage ID or a misleading suffix. */
export function deliveryExtension(header: Buffer, name: string): string {
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png'
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) return '.jpg'
  if (/^GIF8[79]a/.test(header.toString('ascii', 0, 6))) return '.gif'
  if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') return '.webp'
  if (header.toString('ascii', 0, 5) === '%PDF-') return '.pdf'
  if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE') return '.wav'
  const suffix = extname(name).toLowerCase()
  if (header.toString('ascii', 4, 8) === 'ftyp') return ['.mp4', '.mov', '.m4a', '.avif', '.heic'].includes(suffix) ? suffix : '.mp4'
  if (header.toString('ascii', 0, 3) === 'ID3') return '.mp3'
  if (header[0] === 80 && header[1] === 75 && header[2] === 3 && header[3] === 4) {
    return ['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.epub', '.zip'].includes(suffix) ? suffix : '.zip'
  }
  return /^\.[a-z0-9]{1,10}$/.test(suffix) ? suffix : ''
}

async function digest(handle: FileHandle, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  const buffer = Buffer.alloc(64 * 1024)
  let position = 0
  for (;;) {
    signal.throwIfAborted()
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
    if (!bytesRead) break
    hash.update(buffer.subarray(0, bytesRead))
    position += bytesRead
  }
  return hash.digest('hex')
}

function outputName(source: string, extension: string, hash: string): string {
  let stem = basename(source, extname(source))
  if (/^[a-f\d]{32,}$/i.test(stem)) stem = ['.png', '.jpg', '.gif', '.webp'].includes(extension) ? 'image' : 'file'
  stem = stem.normalize('NFKC').replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '-').replace(/^\.+/, '').trim().slice(0, 72) || 'file'
  return `${stem}-${hash.slice(0, 12)}${extension || '.bin'}`
}

/** Bounded-memory copy, no replacement of any user-owned file. */
async function publish(source: FileHandle, directory: string, name: string, signal: AbortSignal): Promise<string> {
  const temporary = join(directory, `.delivery-${randomUUID()}.tmp`)
  const target = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  const hash = createHash('sha256')
  let size = 0
  try {
    const buffer = Buffer.alloc(64 * 1024)
    for (;;) {
      signal.throwIfAborted()
      const { bytesRead } = await source.read(buffer, 0, buffer.length, size)
      if (!bytesRead) break
      const bytes = buffer.subarray(0, bytesRead)
      hash.update(bytes)
      let offset = 0
      while (offset < bytesRead) {
        const written = await target.write(bytes, offset, bytesRead - offset, size + offset)
        if (written.bytesWritten === 0) throw new Error('Unable to save output file')
        offset += written.bytesWritten
      }
      size += bytesRead
    }
    await target.sync()
    await target.close()
    const sha = hash.digest('hex')
    const header = Buffer.alloc(32)
    const read = await source.read(header, 0, header.length, 0)
    const filename = outputName(name, deliveryExtension(header.subarray(0, read.bytesRead), name), sha)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      signal.throwIfAborted()
      // The parent must still be the real workspace directory at publication time.
      if ((await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Output directory changed')
      const path = join(directory, attempt === 0 ? filename : `${basename(filename, extname(filename))}-${attempt}${extname(filename)}`)
      try {
        await link(temporary, path)
        return path
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        let existing: FileHandle | undefined
        try {
          existing = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
          const info = await existing.stat()
          if (info.isFile() && info.size === size && await digest(existing, signal) === sha) return path
        } catch { signal.throwIfAborted() } finally { await existing?.close() }
      }
    }
    throw new Error('Unable to allocate a unique delivery filename')
  } finally {
    await target.close().catch(() => {})
    await unlink(temporary).catch(() => {})
  }
}

/** Resolve a previously generated cache/object path to its original-quality workspace delivery. */
function recordedDelivery(session: Session, path: string): PresentedFile | undefined {
  for (const event of session.snapshotEvents().toReversed()) {
    if (event.type !== 'deliverables/presented') continue
    const match = event.data.files.find(file => file.path === path || Array.isArray(file.sourcePaths) && file.sourcePaths.includes(path))
    if (match) return match
  }
  return undefined
}

/** Local DeepViewer boundary shared by automatic and explicit delivery. Does not mutate original files. */
export async function prepareWorkspaceDeliveries(ctx: Context, session: Session, files: readonly PresentedFile[], signal: AbortSignal): Promise<PresentedFile[]> {
  const cwd = session.header.cwd
  if (!cwd) throw new Error('File delivery requires a workspace. Select a workspace before generating files.')
  const rootTarget = await ctx.fs.resolve(cwd, { signal })
  const hostRoot = ctx.fs.processPath(rootTarget)
  if (!hostRoot) throw new Error('Workspace does not expose a local delivery directory')
  const root = await realpath(hostRoot)
  const prepared = new Map<string, PresentedFile>()
  for (const file of files) {
    signal.throwIfAborted()
    const initial = await ctx.fs.resolve(file.path, { cwd, signal })
    const previous = recordedDelivery(session, initial.displayPath) ?? recordedDelivery(session, file.path)
    const sourcePath = previous?.path ?? file.path
    const target = await ctx.fs.resolve(sourcePath, { cwd, signal })
    const entry = await ctx.fs.lstat(sourcePath, { cwd }, signal)
    const info = await ctx.fs.stat(target, signal)
    const host = ctx.fs.processPath(target)
    if (entry?.type !== 'file' || info?.type !== 'file' || !host) throw new Error('Delivery source is missing or is not a regular local file')
    const realSource = await realpath(host)
    const handle = await open(realSource, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      if (!(await handle.stat()).isFile()) throw new Error('Delivery source is not a file')
      const header = Buffer.alloc(32)
      const { bytesRead } = await handle.read(header, 0, header.length, 0)
      const extension = deliveryExtension(header.subarray(0, bytesRead), realSource)
      const currentExtension = extname(realSource).toLowerCase()
      const formatCorrect = !extension || currentExtension === extension || extension === '.jpg' && currentExtension === '.jpeg'
      let path = realSource
      if (!within(root, realSource) || !formatCorrect) {
        if (ctx.sandboxPolicy.resolve({ session }).mode === 'read-only') throw new Error('Workspace is read-only; generated file has not been delivered. Change the workspace permission before retrying present; do not regenerate the image.')
        const directory = join(root, 'outputs')
        await mkdir(directory, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error })
        if (!(await lstat(directory)).isDirectory() || await realpath(directory) !== directory) throw new Error('outputs must be a real directory inside the workspace')
        path = await publish(handle, directory, basename(realSource), signal)
      }
      signal.throwIfAborted()
      const mapped = ctx.fs.processPathFromHostPath(path)
      if (!mapped) throw new Error('Delivered file has no execution-world path')
      const sourcePaths = [...new Set([file.path, initial.displayPath, ...(file.sourcePaths ?? []), ...(previous?.sourcePaths ?? [])])].filter(source => source !== mapped)
      prepared.set(mapped, { path: mapped, ...(file.description === undefined ? {} : { description: file.description }), ...(sourcePaths.length ? { sourcePaths } : {}) })
    } finally { await handle.close() }
  }
  return [...prepared.values()]
}
