/** Resolve V4 image occurrences before translating into the pinned subscription wire adapters. */
export async function subscriptionMessages(messages, attachments, signal, offloadedImageText) {
  const output = []
  for (const message of messages) {
    signal?.throwIfAborted()
    const content = []
    for (const block of message.content) {
      if (block.type !== 'image') { content.push(block); continue }
      if (block.offloaded === true) {
        content.push({ type: 'text', text: offloadedImageText(block.attachment) })
        continue
      }
      if (!attachments) throw new Error('Subscription image input requires the attachment service')
      const stored = await attachments.readImage(block.attachment, signal)
      content.push({ type: 'image', mediaType: stored.ref.mediaType, dataBase64: Buffer.from(stored.data).toString('base64') })
    }
    if (message.role !== 'tool') {
      output.push({ ...message, content })
      continue
    }
    // The plugin's pinned serializers accept legacy result wrappers. This is
    // request-local only: the authoritative Session remains native V4.
    output.push({ role: 'user', content: [{ type: 'tool-result', toolCallId: message.toolCallId,
      content, ...(message.isError === undefined ? {} : { isError: message.isError }) }] })
    // The pinned adapters flatten tool text; keep result images visible as an
    // adjacent user image input rather than silently discarding their bytes.
    const images = content.filter(block => block.type === 'image')
    if (images.length) output.push({ role: 'user', content: [
      { type: 'text', text: `Images returned by tool call ${String(message.toolCallId)}:` }, ...images,
    ] })
  }
  return output
}
