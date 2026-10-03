import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error Request-local adapter is shared with the JavaScript build pipeline.
import { subscriptionMessages } from '../scripts/subscriptions-v4-messages.mjs'

// Execute the pinned provider serializers themselves, without OAuth or network.
const bundle = readFileSync(resolve(import.meta.dirname, '../../../node_modules/dsh-plugin-subscriptions/lib/index.js'), 'utf8')
function region(name: string) {
  const start = bundle.indexOf(`//#region src/translate/${name}.ts`)
  if (start < 0) throw new Error(`Missing pinned serializer ${name}`)
  return bundle.slice(start, bundle.indexOf('//#endregion', start))
}
const wire = runInNewContext(region('responses') + '\n' + region('anthropic') + '\n({toResponsesInput,toAnthropicMessages})')
const ref = { id: 'fixture', mediaType: 'image/png' }
const image = { type: 'image', attachment: ref }
const attachments = () => ({ readImage: vi.fn(async () => ({ ref, data: new Uint8Array([1, 2, 3]) })) })

describe('RC2 V4 subscription message bridge', () => {
  it('preserves tool call identity, empty results and errors in both provider protocols', async () => {
    const messages = [
      { role: 'assistant', content: [{ type: 'tool-call', id: 'call-1', name: 'read', arguments: '{"path":"x"}' }] },
      { role: 'tool', toolCallId: 'call-1', isError: true, content: [{ type: 'text', text: 'denied' }] },
      { role: 'tool', toolCallId: 'call-empty', content: [] },
    ]
    const before = structuredClone(messages)
    const translated = await subscriptionMessages(messages, undefined, undefined, () => '')
    expect(messages).toEqual(before)
    expect(wire.toResponsesInput(translated).input).toEqual([
      { type: 'function_call', call_id: 'call-1', name: 'read', arguments: '{"path":"x"}' },
      { type: 'function_call_output', call_id: 'call-1', output: 'denied' },
      { type: 'function_call_output', call_id: 'call-empty', output: '' },
    ])
    expect(wire.toAnthropicMessages(translated)[1].content).toEqual([
      { type: 'tool_result', tool_use_id: 'call-1', content: 'denied', is_error: true },
      { type: 'tool_result', tool_use_id: 'call-empty', content: '' },
    ])
  })

  it('resolves user and tool-result images without losing returned image bytes', async () => {
    const service = attachments()
    const messages = [{ role: 'user', content: [image] }, { role: 'tool', toolCallId: 'call-2', content: [image] }]
    const translated = await subscriptionMessages(messages, service, undefined, () => '')
    const responses = wire.toResponsesInput(translated).input
    expect(responses.filter((row: { type: string }) => row.type === 'message').flatMap((row: { content: unknown[] }) => row.content))
      .toEqual(expect.arrayContaining([{ type: 'input_image', image_url: 'data:image/png;base64,AQID' }]))
    const anthropic = wire.toAnthropicMessages(translated)
    expect(anthropic[0].content.filter((block: { type: string }) => block.type === 'image')).toHaveLength(2)
    expect(service.readImage).toHaveBeenCalledTimes(2)
    expect(messages[0]!.content[0]).toEqual(image)
  })

  it('does not read offloaded images and fails closed on cancellation or missing attachments', async () => {
    const service = attachments()
    const translated = await subscriptionMessages([{ role: 'user', content: [{ ...image, offloaded: true }] }], service, undefined, () => '[image offloaded]')
    expect(translated[0].content).toEqual([{ type: 'text', text: '[image offloaded]' }])
    expect(service.readImage).not.toHaveBeenCalled()
    const controller = new AbortController()
    controller.abort()
    await expect(subscriptionMessages([{ role: 'user', content: [image] }], service, controller.signal, () => '')).rejects.toThrow()
    await expect(subscriptionMessages([{ role: 'user', content: [image] }], undefined, undefined, () => '')).rejects.toThrow(/attachment service/)
  })
})
