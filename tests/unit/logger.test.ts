import { describe, expect, it } from 'vitest'
import { redact } from '../../src/main/services/logger'

describe('redact', () => {
  it('removes secrets recursively without hiding ordinary fields', () => {
    const value = redact({ authorization: 'Bearer private-token', nested: { apiKey: 'sk-testsecret123', message: 'Bearer abcdefghijklmnop' }, safe: 'hello' })
    expect(value).toEqual({ authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', message: '[REDACTED]' }, safe: 'hello' })
  })
})
