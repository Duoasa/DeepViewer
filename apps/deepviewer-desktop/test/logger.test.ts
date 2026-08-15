import { describe, expect, it } from 'vitest'
import { redactLogMessage } from '../src/main/logger.js'

describe('redactLogMessage', () => {
  it('removes authorization values and DeepSeek keys', () => {
    const message = 'Authorization: Bearer hidden-token DEEPSEEK_API_KEY=secret-value key=sk-abcdefghijklmnop'
    expect(redactLogMessage(message)).toBe('Authorization: [REDACTED] DEEPSEEK_API_KEY=[REDACTED] key=[REDACTED_KEY]')
  })
})
