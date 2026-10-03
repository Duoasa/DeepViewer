import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-session-query'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { workspaceOperation } from './workspace.ts'
export const WORKSPACE_CHANNEL = '/deepviewer-workspace'
export function registerWorkspaceOperations(ctx: Context): void {
  ctx.inject(['connection', 'webServer'], rpcCtx => rpcCtx.connection.rpc.handle(WORKSPACE_CHANNEL, async (method, input) => {
    try {
      if (!input || typeof input !== 'object') throw new Error('Invalid workspace request')
      const payload = input as Record<string, unknown>
      if (typeof payload.sessionId !== 'string' || payload.sessionId.length > 256) throw new Error('Select a Session')
      using observation = await ctx.sessionQuery.observeSession(payload.sessionId as SessionId)
      if (observation.header.cwd === undefined || (observation.projections?.values.agentPreset ?? observation.header.agentPreset) === 'deepviewer-chat') throw new Error('Workspace operations are unavailable in Chat')
      return { ok: true, value: await workspaceOperation(observation.header.cwd, method, payload) }
    } catch (error) { return { ok: false, error: { code: 'deepviewer/workspace', message: error instanceof Error ? error.message : String(error), details: {} } } }
  }, rpcCtx))
}
