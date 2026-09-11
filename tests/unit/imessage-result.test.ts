import { describe, expect, it } from 'vitest'
import { parseIMessageResult } from '../../src/main/services/imessage-result'

describe('Messages permission results', () => {
  it('explains a denied helper result without leaking its database path', () => {
    const output = JSON.stringify({ ok: false, error: 'messages_database_permission_denied', database: '/private/example', detail: 'private diagnostic' })
    expect(() => parseIMessageResult(output)).toThrow('Full Disk Access')
    expect(() => parseIMessageResult(output)).not.toThrow('/private/example')
  })
  it('preserves successful checks and rejects malformed or failed output', () => {
    expect(parseIMessageResult('{"ok":true,"sent":false}')).toEqual({ ok: true, sent: false })
    for (const output of ['null', '[]', 'not json', '{"ok":false,"error":"private text"}']) expect(() => parseIMessageResult(output)).toThrow()
  })
})
