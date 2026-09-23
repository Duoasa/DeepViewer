import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
// Decode actual fixture pixels, not the scanner's expected-answer string.
export function readImageProbe(body) {
  const parts = body.messages.at(-1).content
  assert.ok(Array.isArray(parts))
  const url = parts.find(p => p.type === 'image_url')?.image_url.url
  assert.ok(url?.startsWith('data:image/png;base64,'))
  const png = Buffer.from(url.split(',')[1], 'base64'), chunks = []
  assert.equal(png.readUInt32BE(16), 192); assert.equal(png.readUInt32BE(20), 32)
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(chunks)), names = { '255,0,0':'RED', '0,200,0':'GREEN', '0,0,255':'BLUE', '255,255,0':'YELLOW', '255,0,255':'MAGENTA', '0,255,255':'CYAN' }
  const answer = Array.from({length:6}, (_, i) => names[[...raw.subarray(1 + i * 96, 4 + i * 96)].join(',')]).join(' ')
  assert.equal(new Set(answer.split(' ')).size, 6)
  assert.ok(!parts.find(p => p.type === 'text').text.includes(answer), 'answer must not leak into text prompt')
  return answer
}
