import { describe, expect, it } from 'vitest'
import { computeNextRun, nextAfterNow } from '../../src/main/services/schedule'

describe('routine schedules', () => {
  it('recovers years of missed minute intervals without looping or drifting', () => {
    const recovered = nextAfterNow({ kind: 'interval', intervalMinutes: 1 }, '2020-01-01T00:00:15.000Z', new Date('2026-09-08T12:30:20.000Z'))
    expect(recovered.toISOString()).toBe('2026-09-08T12:31:15.000Z')
    expect(() => computeNextRun({ kind: 'interval', intervalMinutes: 0 }, new Date())).toThrow('positive')
    expect(() => nextAfterNow({ kind: 'interval', intervalMinutes: 1 }, 'invalid', new Date())).toThrow('invalid')
  })

  it('calculates interval, daily, and catch-up advances in local time', () => {
    const morning = new Date(2026, 7, 21, 7, 30, 0)
    expect(computeNextRun({ kind: 'interval', intervalMinutes: 45 }, morning).getTime()).toBe(morning.getTime() + 45 * 60_000)
    const daily = computeNextRun({ kind: 'daily', timeOfDay: '08:00', daysOfWeek: [1, 2, 3, 4, 5] }, morning)
    expect([daily.getHours(), daily.getMinutes()]).toEqual([8, 0])
    expect(daily.getDay()).toBe(5)

    const recovered = nextAfterNow({ kind: 'interval', intervalMinutes: 60 }, '2026-08-21T08:00:00.000Z', new Date('2026-08-21T12:30:00.000Z'))
    expect(recovered.toISOString()).toBe('2026-08-21T13:00:00.000Z')
  })
})
