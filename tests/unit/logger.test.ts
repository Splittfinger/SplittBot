import { describe, expect, it } from 'vitest'
import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonLogger, redact } from '../../src/main/services/logger'

describe('redact', () => {
  it('removes secrets recursively without hiding ordinary fields', () => {
    const value = redact({ authorization: 'Bearer private-token', nested: { apiKey: 'sk-testsecret123', message: 'Bearer abcdefghijklmnop' }, safe: 'hello' })
    expect(value).toEqual({ authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', message: '[REDACTED]' }, safe: 'hello' })
  })

  it('keeps new and existing diagnostic logs private', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-log-permissions-'))
    const path = join(directory, 'logs', 'runtime.jsonl')
    const logger = new JsonLogger(path)
    await logger.write('info', 'test.created', { password: 'private' })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect((await stat(join(directory, 'logs'))).mode & 0o777).toBe(0o700)
    await chmod(path, 0o644)
    await logger.write('info', 'test.existing')
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(await readFile(path, 'utf8')).not.toContain('private')
  })
})
