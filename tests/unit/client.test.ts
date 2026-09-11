import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CodexAppServerClient } from '../../src/main/codex/client'
import { JsonLogger } from '../../src/main/services/logger'

describe('CodexAppServerClient', () => {
  it('waits for shared initialization before concurrent callers send requests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-client-start-'))
    const client = new CodexAppServerClient(
      { command: process.execPath, argsPrefix: [resolve('tests/fixtures/fake-app-server.mjs'), '--slow-initialize'], source: 'test fixture' },
      new JsonLogger(join(directory, 'client.jsonl'))
    )
    try {
      await Promise.all(Array.from({ length: 10 }, async () => {
        await client.start()
        await expect(client.request('account/read')).resolves.toHaveProperty('account.type', 'chatgpt')
      }))
    } finally { await client.stop() }
  })

  it('cleans up failed launches and allows a clean retry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-client-failed-'))
    const client = new CodexAppServerClient(
      { command: join(directory, 'does-not-exist'), argsPrefix: [], source: 'test fixture' },
      new JsonLogger(join(directory, 'client.jsonl')), 1_000
    )
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(client.start()).rejects.toThrow(/ENOENT|EPIPE/)
      expect(client.running).toBe(false)
    }
    await client.stop()
  })

  it('initializes, streams a turn, handles approval, and resumes after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-client-'))
    const client = new CodexAppServerClient(
      { command: process.execPath, argsPrefix: [resolve('tests/fixtures/fake-app-server.mjs')], source: 'test fixture' },
      new JsonLogger(join(directory, 'client.jsonl'))
    )
    client.setServerRequestHandler(async () => ({ decision: 'accept' }))
    const notifications: string[] = []
    client.on('notification', (method: string) => notifications.push(method))

    await client.start()
    const account = await client.request<{ account: { type: string } }>('account/read', { refreshToken: true })
    expect(account.account.type).toBe('chatgpt')
    const started = await client.request<{ thread: { id: string } }>('thread/start', { cwd: '/tmp', sandbox: 'read-only' })
    await client.request('turn/start', { threadId: started.thread.id, input: [{ type: 'text', text: 'REQUEST_APPROVAL' }] })
    await waitFor(() => notifications.includes('turn/completed'))

    await client.restart()
    const resumed = await client.request<{ thread: { id: string } }>('thread/resume', { threadId: started.thread.id })
    expect(resumed.thread.id).toBe(started.thread.id)
    await client.stop()
  })
})

async function waitFor(predicate: () => boolean): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > 2_000) throw new Error('Timed out waiting for fake Codex event.')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
