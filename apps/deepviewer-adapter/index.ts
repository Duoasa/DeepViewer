// @ts-ignore JavaScript adapter is exercised by isolated host fixtures.
import { registerSynapse } from './workflows/synapse-host.mjs'
import { registerWorkspaceOperations } from './workflows/workspace-rpc.ts'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-tool-present'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { registerAutoDelivery } from './workflows/auto-delivery.ts'
import { FILE_DELIVERY_PROMPT } from './workflows/file-delivery-prompt.ts'
export const name = 'DeepViewerAdapter'
export const inject = ['systemPrompt', 'tools', 'fs', 'sandboxPolicy', 'sessionProjections', 'connection', 'webServer', 'sessionQuery']
export function apply(ctx: Context): void {
  registerSynapse(ctx)
  registerWorkspaceOperations(ctx)
  registerAutoDelivery(ctx)
  ctx.systemPrompt.section({ name: 'deepviewer:required-file-delivery', order: ctx.systemPrompt.getSectionOrder('DELIVERABLE_FILE_REFERENCES'), text: FILE_DELIVERY_PROMPT })
}
