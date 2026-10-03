import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHALLENGE_BLOCKS, createImageChallenge, encodePng, scoreImageAnswer } from '../src/host/challenge.mjs'

test('challenge renders a valid PNG with six blocks', () => {
  const challenge = createImageChallenge()
  const png = Buffer.from(challenge.base64, 'base64')
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(png.readUInt32BE(16), 768)
  assert.equal(png.readUInt32BE(20), 256)
  assert.equal(challenge.expected.length, CHALLENGE_BLOCKS)
  assert.ok(new Set(challenge.expected).size >= 3)
  assert.ok(challenge.dataUrl.startsWith('data:image/png;base64,'))
  assert.ok(png.length < 4096, `png should be tiny, got ${png.length}`)
})

test('encodePng handles a one-pixel image', () => {
  const png = encodePng(1, 1, () => [1, 2, 3])
  assert.equal(png.readUInt32BE(16), 1)
})

test('scoring accepts exact and near-exact answers, tolerates decoration', () => {
  const challenge = createImageChallenge(() => 0)
  challenge.expected = ['RED', 'GREEN', 'BLUE', 'YELLOW', 'MAGENTA', 'CYAN']
  assert.equal(scoreImageAnswer('RED GREEN BLUE YELLOW MAGENTA CYAN', challenge).matched, true)
  assert.equal(scoreImageAnswer('red, green, blue, yellow, magenta, cyan.', challenge).matched, true)
  assert.equal(scoreImageAnswer('The colors are: RED GREEN BLUE YELLOW MAGENTA CYAN', challenge).matched, true)
  // one mistake is tolerated
  assert.equal(scoreImageAnswer('RED GREEN BLUE YELLOW CYAN CYAN', challenge).matched, true)
  // two mistakes are not
  assert.equal(scoreImageAnswer('RED GREEN BLUE CYAN CYAN CYAN', challenge).matched, false)
  // all six colours in the wrong order is a guess, not a read
  assert.equal(scoreImageAnswer('CYAN MAGENTA YELLOW BLUE GREEN RED', challenge).matched, false)
})

test('scoring detects "no image" answers', () => {
  const challenge = createImageChallenge()
  for (const text of ['NO IMAGE', "I can't see any image.", 'The image is unavailable to me', 'I am unable to view images']) {
    assert.equal(scoreImageAnswer(text, challenge).sawNoImage, true, text)
  }
  assert.equal(scoreImageAnswer('', challenge).sawNoImage, false)
  assert.equal(scoreImageAnswer('M', challenge).matched, false)
})
