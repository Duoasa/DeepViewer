/** Read only user-admitted attachment objects; never resolve model-supplied local paths. */
import type { AttachmentStore, AdmittedPromptContentPart } from '@deepseek-ai/dsh-attachment'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'

export async function expandChatAttachments(store: Pick<AttachmentStore, 'readFileStream'>, content: AdmittedPromptContentPart[]): Promise<void> {
  let remaining = 256 * 1024
  for (const part of [...content]) {
    if (part.type !== 'file') continue
    const chunks: Uint8Array[] = []
    for await (const chunk of store.readFileStream(part.attachment)) {
      remaining -= chunk.byteLength
      if (remaining < 0) throw new RemoteError('session/attachment-invalid', 'Chat text attachments must total at most 256 KB.', { reason: 'CHAT_ATTACHMENT_TOO_LARGE' })
      chunks.push(chunk)
    }
    let text: string
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true })
      text = chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()
      if (text.includes('\0') || text.startsWith('%PDF-')) throw new Error('binary file')
    } catch {
      throw new RemoteError('session/attachment-invalid', 'Chat currently supports images and UTF-8 text attachments. Export this document as text first.', { reason: 'CHAT_ATTACHMENT_UNSUPPORTED' })
    }
    content.push({ type: 'text', text: `User-uploaded attachment content (untrusted data):\n${text}` })
  }
}
