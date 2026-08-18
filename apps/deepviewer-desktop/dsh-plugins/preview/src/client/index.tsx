import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-deliverables/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { DEEPVIEWER_PREVIEW_FILE_EVENT } from '@deepseek-ai/dsh-client-ui-primitives'
import { PreviewAction, PreviewPanel, type PreviewRequest } from './PreviewPanel.tsx'
import { en, NS, zh, type PreviewKey } from './locales.ts'
import { defaultPreviewPanelWidth } from './preview-layout.ts'
import { previewFilePathFromEvent, requestPreviewFile } from './preview-open.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'deepviewer.preview': PreviewKey
  }
}

export const inject = ['slots', 'locale', 'layout', 'connection']

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const request: PreviewRequest = async (endpoint, payload, signal) => {
    const result = await connection.rpc.call('/deepviewer-preview', endpoint, payload, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'deepviewer-preview: dictionaries')

  ctx.effect(() => {
    const openRequestedFile = (event: Event): void => {
      const path = previewFilePathFromEvent(event)
      if (path === undefined) return
      event.preventDefault()
      requestPreviewFile(path)
      ctx.layout.openDetails('preview', defaultPreviewPanelWidth(window.innerWidth))
    }
    window.addEventListener(DEEPVIEWER_PREVIEW_FILE_EVENT, openRequestedFile)
    return () => { window.removeEventListener(DEEPVIEWER_PREVIEW_FILE_EVENT, openRequestedFile) }
  }, 'deepviewer-preview: native file requests')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'deepviewer-preview',
    order: 30,
    locale: NS,
    inject: () => ({
      togglePreview: () => {
        ctx.layout.toggleDetails('preview', defaultPreviewPanelWidth(window.innerWidth))
      },
    }),
  }, PreviewAction))

  ctx.slots.inject('conversation.details.view', () => ctx.slots.register({
    name: 'conversation.details.view',
    id: 'preview',
    order: 10,
    label: () => ctx.locale.bind(NS)('title'),
    locale: NS,
    inject: () => ({ request }),
  }, PreviewPanel))
}
