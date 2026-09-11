import { describe, expect, it } from 'vitest'
import { KeyedSerialQueue, LatestRefresh } from '../../src/shared/async-control'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('async coordination', () => {
  it('serializes each agent without blocking other agents or poisoning failed queues', async () => {
    const queue = new KeyedSerialQueue()
    const gate = deferred()
    const events: string[] = []
    const first = queue.run('atlas', async () => { events.push('first'); await gate.promise; throw new Error('test failure') })
    const failed = expect(first).rejects.toThrow('test failure')
    const second = queue.run('atlas', async () => { events.push('second') })
    await queue.run('maya', async () => { events.push('other') })
    expect(events).toEqual(['first', 'other'])
    gate.resolve()
    await Promise.all([failed, second])
    expect(events).toEqual(['first', 'other', 'second'])
  })

  it('collapses 1,000 pending refreshes into only the latest follow-up', async () => {
    const gate = deferred()
    const calls: number[] = []
    const refresh = new LatestRefresh<number>(async (value) => { calls.push(value); if (value === 0) await gate.promise })
    const initial = refresh.request(0)
    await Promise.resolve()
    const requests = Array.from({ length: 1_000 }, (_, index) => refresh.request(index + 1))
    gate.resolve()
    await Promise.all([initial, ...requests])
    expect(calls).toEqual([0, 1_000])
    await refresh.request(1_001)
    expect(calls).toEqual([0, 1_000, 1_001])
  })

  it('allows a fresh request after a failed refresh', async () => {
    const calls: number[] = []
    const refresh = new LatestRefresh<number>(async (value) => { calls.push(value); if (!value) throw new Error('offline') })
    await expect(refresh.request(0)).rejects.toThrow('offline')
    await refresh.request(1)
    expect(calls).toEqual([0, 1])
  })
})
