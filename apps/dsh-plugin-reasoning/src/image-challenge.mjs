import { randomInt } from 'node:crypto'
import { deflateSync } from 'node:zlib'

// A fresh visual answer per request prevents a gateway's canned text reply from
// being mistaken for image support. No user image or remote image URL is used.
const colors = [
  ['RED', [255, 0, 0]], ['GREEN', [0, 200, 0]], ['BLUE', [0, 0, 255]],
  ['YELLOW', [255, 255, 0]], ['MAGENTA', [255, 0, 255]], ['CYAN', [0, 255, 255]],
]
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff
  for (const byte of body) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([size, body, checksum])
}
export function imageChallenge() {
  const order = [...colors]
  for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]] }
  const width = 192, height = 32, pixels = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (1 + width * 3) + 1 + x * 3
    pixels.set(order[Math.floor(x / 32)][1], offset)
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
  return {
    url: 'data:image/png;base64,' + png.toString('base64'),
    expected: order.map(([name]) => name).join(' '),
    prompt: 'Read the six colored blocks in the attached image from LEFT to RIGHT. Reply with exactly six uppercase color names separated by spaces. Allowed names: BLUE, CYAN, GREEN, MAGENTA, RED, YELLOW. Do not guess if the image is unavailable.',
  }
}
export function matchesImageAnswer(text, challenge) {
  return text.trim().toUpperCase().replace(/[,.`\s]+/g, ' ').trim() === challenge.expected
}
