import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyError, errorExcerpt } from '../src/host/classify.mjs'

const json = (message, extra = {}) => JSON.stringify({ error: { message, type: 'invalid_request_error', ...extra } })

test('developer-role refusals from real gateways are recognised', () => {
  const cases = [
    "developer is not one of ['system', 'assistant', 'user', 'tool', 'function'] - 'messages.0.role'",
    'Unknown role: developer',
    '角色信息不正确',
    "Invalid value: 'developer'. Supported values are: 'system', 'assistant', 'user', and 'tool'. (parameter: messages[0].role)",
    'messages[0].role: unsupported role "developer"',
  ]
  for (const message of cases) assert.equal(classifyError(json(message), 400).kind, 'developer_role', message)
})

test('image refusals are recognised and payload complaints are not', () => {
  const rejected = [
    "messages[1].content[1].type is invalid, allowed values: ['text']",
    'This model does not support image input',
    '该模型不支持图片输入',
    'Invalid content type. image_url is only supported by certain models.',
    'multimodal input is not supported for this model',
    "messages[1].content[1].type 参数非法，取值范围 ['text']",
  ]
  for (const message of rejected) assert.equal(classifyError(json(message), 400, { image: true }).kind, 'image_rejected', message)
  const payload = ['Image format not supported: expected jpeg', 'Unable to decode image base64 data', 'image too large, size limit 20MB']
  for (const message of payload) assert.notEqual(classifyError(json(message), 400, { image: true }).kind, 'image_rejected', message)
  // Without an image in the request, nothing is an image refusal.
  assert.notEqual(classifyError(json(rejected[0]), 400, { image: false }).kind, 'image_rejected')
})

test('effort, model-not-found, permission, rate limit and server errors', () => {
  assert.equal(classifyError(json("Invalid value: '__dsh_invalid_effort__'. Supported values are: 'low', 'medium', 'high' (parameter: reasoning_effort)"), 400, { effort: true }).kind, 'effort_rejected')
  assert.equal(classifyError(json('The model `nope` does not exist or you do not have access to it.'), 404).kind, 'model_not_found')
  assert.equal(classifyError(json('model_not_found'), 400).kind, 'model_not_found')
  assert.equal(classifyError(json('insufficient_quota'), 429).kind, 'rate_limited')
  assert.equal(classifyError(json('insufficient_quota'), 403).kind, 'permission_denied')
  assert.equal(classifyError('未提供令牌', 401).kind, 'permission_denied')
  assert.equal(classifyError(json('模型倍率或价格未配置'), 500).kind, 'server_error')
  assert.equal(classifyError('<html>bad gateway</html>', 502).kind, 'server_error')
  assert.equal(classifyError(json('something odd'), 400).kind, 'unknown')
})

test('excerpt strips secrets and collapses whitespace', () => {
  assert.equal(errorExcerpt(json('bad key sk-abcdefghijklmnop \n  here')), 'bad key [redacted] here')
  assert.equal(errorExcerpt('plain text'), 'plain text')
})
