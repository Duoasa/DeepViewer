import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
export const inject = ['tools']
/** Mounted only inside the Chat preset, before its first request. */
export function apply(ctx: Context): void {
  // Native 0.2 restrictions mask inherited tools; the preset's own web tools remain visible.
  ctx.tools.restrict({ allow: [] })
  ctx.tools.guard(exec => ['web_search', 'web_fetch'].includes(exec.name) ? undefined : 'This tool is unavailable in Chat. Start a Work session to use project tools.')
}
