/** Register deterministic generated outputs without relying on another model call. */
import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { Session } from '@deepseek-ai/dsh-session'
import type { PresentedFile } from '@deepseek-ai/dsh-tool-present/types'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { basename } from 'node:path'
import { prepareWorkspaceDeliveries } from './workspace-delivery.ts'

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

/** Only producer-owned contracts count; prose, file reads and shell strings do not. */
export function generatedPaths(name: string, args: unknown, value: unknown): string[] {
  const input = record(args)
  const output = record(value)
  const paths: unknown[] = name === 'image_generate' && Array.isArray(output?.paths)
    ? output.paths
    : name === 'write' && typeof input?.content === 'string'
      ? [input.file_path]
      : name === 'str_replace_editor' && input?.command === 'create' && typeof input.file_text === 'string'
        ? [input.path] : []
  return [...new Set(paths.filter((path): path is string =>
    typeof path === 'string' && path.trim().length > 0 && !path.includes('\0')))]
}

/** Normalize both producer results and explicit present calls at the same workspace boundary. */
export function registerAutoDelivery(ctx: Context): void {
  const pending = new WeakMap<ToolExecution, { session: Session; turn: number; files: PresentedFile[]; paths: string[] }>()
  ctx.on('deliverables/prepare', async (exec, _files, next) => {
    const files = await next()
    if (!exec.agent) throw new Error('File delivery requires a session')
    return prepareWorkspaceDeliveries(ctx, exec.agent.session, files, exec.signal)
  })
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (decision.kind !== 'accept' || result.isError || exec.signal.aborted || !exec.agent) return decision
    const boundary = ctx.sessionProjections.stateOf(exec.agent.session, 'turnBoundary')
    if (!boundary || boundary.openTurnStartSeq === null) return decision
    const value = decision.value === undefined ? result.value : decision.value
    const paths = generatedPaths(exec.name, exec.arguments, value)
    if (paths.length === 0) return decision
    const images = record(value)?.images
    const sources = paths.map((path, index): PresentedFile => {
      const image = Array.isArray(images) ? images[index] : undefined
      let objectPath: string | undefined
      try {
        const host = image && ctx.get('attachments')?.imageHostPath(image as ImageAttachmentRef)
        objectPath = host ? ctx.fs.processPathFromHostPath(host) : undefined
      } catch { /* Invalid optional image metadata cannot grant access to a cache object. */ }
      return { path, ...(objectPath ? { sourcePaths: [objectPath] } : {}) }
    })
    try {
      const files = await prepareWorkspaceDeliveries(ctx, exec.agent.session, sources, exec.signal)
      if (exec.signal.aborted) return decision
      const finalPaths = exec.name === 'image_generate' ? files.map(file => file.path) : paths
      pending.set(exec, { session: exec.agent.session, turn: boundary.lastTurn, files, paths: finalPaths })
      if (exec.name === 'image_generate' && record(value)) {
        // The model, the final attachment and the side preview now name one original-quality file.
        return { kind: 'accept', value: { ...record(value), paths: finalPaths,
          ...(Array.isArray(images) ? { images: images.map((image, index) => ({ ...record(image), name: basename(finalPaths[index] ?? paths[index] ?? 'image.png') })) } : {}),
        } as Extract<ToolExecutionResult, { isError: false }>['value'], ...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}) }
      }
      return decision
    } catch (error) {
      if (exec.signal.aborted) return decision
      return { kind: 'block', feedback: [{ type: 'text', text: `File generation completed, but workspace delivery failed: ${error instanceof Error ? error.message : String(error)}. Existing source files: ${paths.join(', ')}. Fix delivery with present; do not regenerate or claim successful delivery.` }] }
    }
  })
  ctx.on('tools/result', (exec, result: Readonly<ToolExecutionResult>) => {
    const delivery = pending.get(exec)
    pending.delete(exec)
    if (!delivery || result.isError || exec.signal.aborted) return
    const boundary = ctx.sessionProjections.stateOf(delivery.session, 'turnBoundary')
    if (!boundary || boundary.openTurnStartSeq === null || boundary.lastTurn !== delivery.turn) return
    const paths = generatedPaths(exec.name, exec.arguments, result.value)
    if (paths.length !== delivery.paths.length || paths.some((path, i) => path !== delivery.paths[i])) return
    delivery.session.append('deliverables/presented', { turn: delivery.turn, callId: exec.callId, files: delivery.files })
  })
}
