/**
 * Synthetic image challenge used to prove — not guess — that a model reads
 * image input. A PNG of six coloured blocks is rendered in-process (no image
 * library, no personal data), the model is asked to name them left to right,
 * and the answer is scored against the known order.
 *
 * Design notes
 * - The block order is a random permutation drawn with replacement from six
 *   colours, so a text-only model that "guesses" the listed colour names has a
 *   6^6 = 46 656 way space to guess from; requiring at least five of six
 *   positions correct leaves a chance success rate far below 0.1 %.
 * - The canvas is 768×256 px with a white gutter between blocks. Vision
 *   encoders tile and downsample aggressively: a thin strip of touching
 *   blocks was read as "three bands" or "a gradient" by otherwise capable
 *   models, while separated 128×256 blocks are read reliably by every model
 *   tested. The PNG is still only ≈ 3 KB base64.
 *
 * @module dsh-plugin-model-capabilities/host/challenge
 */
import { randomInt } from 'node:crypto'
import { deflateSync } from 'node:zlib'

/** Colour vocabulary. Names are what the model must echo; RGB is what is painted. */
export const CHALLENGE_COLORS = Object.freeze([
  ['RED', [255, 0, 0]],
  ['GREEN', [0, 200, 0]],
  ['BLUE', [0, 0, 255]],
  ['YELLOW', [255, 255, 0]],
  ['MAGENTA', [255, 0, 255]],
  ['CYAN', [0, 255, 255]],
])

export const CHALLENGE_BLOCKS = 6
export const CHALLENGE_WIDTH = 768
export const CHALLENGE_HEIGHT = 256
/** White gutter on every side of each block, in pixels. */
export const CHALLENGE_GUTTER = 8
const WHITE = /** @type {const} */ ([255, 255, 255])
/** Minimum number of positions that must match for the answer to count. */
export const CHALLENGE_MIN_CORRECT = 5

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([size, body, checksum])
}

/**
 * Encode an RGB8 raster as a PNG.
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => readonly [number, number, number]} pixel
 * @returns {Buffer}
 */
export function encodePng(width, height, pixel) {
  const stride = 1 + width * 3
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y)
      const offset = y * stride + 1 + x * 3
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * @typedef {object} ImageChallenge
 * @property {string} dataUrl  `data:image/png;base64,…`
 * @property {string} mimeType `image/png`
 * @property {string} base64   the raw PNG bytes, base64 encoded
 * @property {readonly string[]} expected the colour names left to right
 * @property {string} prompt the instruction shown with the image
 */

/**
 * Build one fresh challenge.
 * @param {(max: number) => number} [random] integer source in [0, max); injectable for tests
 * @returns {ImageChallenge}
 */
export function createImageChallenge(random = randomInt) {
  /** @type {Array<readonly [string, readonly number[]]>} */
  const blocks = []
  for (let i = 0; i < CHALLENGE_BLOCKS; i++) blocks.push(CHALLENGE_COLORS[random(CHALLENGE_COLORS.length)])
  // Guarantee at least three distinct colours so the strip is unmistakably a sequence.
  // Bounded: a degenerate random source must not hang the scan; the final fallback
  // forces distinct colours into the first three slots deterministically.
  for (let attempt = 0; attempt < 32 && new Set(blocks.map(([name]) => name)).size < 3; attempt++) {
    blocks[random(CHALLENGE_BLOCKS)] = CHALLENGE_COLORS[random(CHALLENGE_COLORS.length)]
  }
  if (new Set(blocks.map(([name]) => name)).size < 3) {
    for (let i = 0; i < 3; i++) blocks[i] = CHALLENGE_COLORS[(CHALLENGE_COLORS.findIndex(([name]) => name === blocks[i][0]) + i + 1) % CHALLENGE_COLORS.length]
  }
  const blockWidth = CHALLENGE_WIDTH / CHALLENGE_BLOCKS
  const png = encodePng(CHALLENGE_WIDTH, CHALLENGE_HEIGHT, (x, y) => {
    const index = Math.min(CHALLENGE_BLOCKS - 1, Math.floor(x / blockWidth))
    const localX = x - index * blockWidth
    const inGutter = localX < CHALLENGE_GUTTER || localX >= blockWidth - CHALLENGE_GUTTER || y < CHALLENGE_GUTTER || y >= CHALLENGE_HEIGHT - CHALLENGE_GUTTER
    return inGutter ? WHITE : blocks[index][1]
  })
  const base64 = png.toString('base64')
  const names = CHALLENGE_COLORS.map(([name]) => name).sort().join(', ')
  return {
    mimeType: 'image/png',
    base64,
    dataUrl: `data:image/png;base64,${base64}`,
    expected: blocks.map(([name]) => name),
    prompt:
      `The attached image shows ${CHALLENGE_BLOCKS} solid colored rectangles in a single row, separated by white gaps, numbered 1 to ${CHALLENGE_BLOCKS} from the LEFT edge to the RIGHT edge. ` +
      `Report the color of each block in position order (1 = leftmost). Colors may repeat; do NOT sort them. ` +
      `Use only these names: ${names}. ` +
      `Answer with exactly ${CHALLENGE_BLOCKS} uppercase words separated by single spaces and nothing else. ` +
      'If you cannot see an image, reply exactly: NO IMAGE',
  }
}

/**
 * Score a model answer.
 * @param {string} text the model's final text
 * @param {ImageChallenge} challenge
 * @returns {{ matched: boolean; correct: number; sawNoImage: boolean }}
 */
export function scoreImageAnswer(text, challenge) {
  const normalized = String(text ?? '').toUpperCase()
  if (/\bNO\s+IMAGE\b/u.test(normalized) || /(?:CAN(?:NOT|'T)|UNABLE TO|DON'T|DO NOT)\s+(?:SEE|VIEW|ACCESS|FIND|PROCESS)\b/u.test(normalized) || /IMAGE\s+(?:IS\s+)?(?:UNAVAILABLE|NOT\s+(?:AVAILABLE|PROVIDED|ATTACHED|FOUND|VISIBLE))/u.test(normalized) || /(?:NO|WITHOUT)\s+(?:AN\s+)?(?:IMAGE|ATTACHMENT)\s+(?:WAS\s+|IS\s+)?(?:PROVIDED|ATTACHED|INCLUDED)/u.test(normalized) || /(?:没有|未|无法)(?:看到|收到|识别|读取|检测到)(?:任何)?(?:图片|图像|附件)/u.test(text ?? '')) {
    return { matched: false, correct: 0, sawNoImage: true }
  }
  const vocabulary = new Set(CHALLENGE_COLORS.map(([name]) => name))
  const words = normalized.split(/[^A-Z]+/u).filter((word) => vocabulary.has(word))
  // Score the best-aligned window of the expected length, so a leading "Colors:" or a
  // trailing sentence does not spoil an otherwise correct reply.
  let best = 0
  for (let start = 0; start + challenge.expected.length <= Math.max(words.length, challenge.expected.length); start++) {
    let correct = 0
    for (let i = 0; i < challenge.expected.length; i++) if (words[start + i] === challenge.expected[i]) correct++
    best = Math.max(best, correct)
    if (start + challenge.expected.length >= words.length) break
  }
  return { matched: best >= CHALLENGE_MIN_CORRECT && words.length <= challenge.expected.length + 2, correct: best, sawNoImage: false }
}
